// src/app/api/scanbuild/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

import { scanWebglBuildZip } from "@/lib/scanners/scanWebglBuildZip";
import { generateCertId } from "@/lib/cert/generateCertId";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ScanLike = any;

type HostSlug = "netlify" | "vercel" | "apache" | "nginx" | "github_pages";

type HostScore = {
  slug: HostSlug;
  score: number; // 0..100
  certified: boolean;
  compliant: boolean;
  compatible: boolean;
  reasons: string[];
  fixpackRequired: boolean;
};

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function detectCompressionMode(scan: ScanLike): "brotli" | "gzip" | "none" | "mixed" {
  // Prefer new field if you adopt upgraded scanner
  const mode = scan?.compression_mode;
  if (mode === "brotli" || mode === "gzip" || mode === "none" || mode === "mixed") return mode;

  // Fallback to old fields
  const brotli = !!scan?.compression?.brotli_present;
  const gzip = !!scan?.compression?.gzip_present;
  if (brotli && gzip) return "mixed";
  if (brotli) return "brotli";
  if (gzip) return "gzip";
  return "none";
}

function detectStructure(scan: ScanLike) {
  // Prefer new field (upgraded scanner)
  const s = scan?.structure;
  if (s && typeof s === "object") {
    const hasIndex = !!s.has_index_html;
    const hasTemplateData = !!s.has_template_data;
    const hasLoader = !!s.has_loader;
    const hasFramework = !!s.has_framework;
    const hasData = !!s.has_data;
    const hasWasm = !!s.has_wasm;

    return {
      hasIndex,
      hasTemplateData,
      hasLoader,
      hasFramework,
      hasData,
      hasWasm,
      deployable: hasIndex && hasTemplateData && hasLoader && hasData && hasWasm,
      notes: Array.isArray(s.notes) ? s.notes : [],
    };
  }

  // Minimal fallback when structure fields are not present:
  // Your original scan only inspects Build folder and returns files[]
  const fileNames: string[] = Array.isArray(scan?.files) ? scan.files.map((f: any) => String(f.name || "")) : [];
  const hasLoader = fileNames.some((n) => n.toLowerCase().endsWith(".loader.js"));
  const hasFramework = fileNames.some((n) => n.toLowerCase().includes(".framework.js"));
  const hasData = fileNames.some((n) => n.endsWith(".data") || n.endsWith(".data.br") || n.endsWith(".data.gz"));
  const hasWasm = fileNames.some((n) => n.endsWith(".wasm") || n.endsWith(".wasm.br") || n.endsWith(".wasm.gz"));

  // index.html + TemplateData can't be detected from old output.
  // We assume “unknown” and do not block deployable purely on that.
  return {
    hasIndex: false,
    hasTemplateData: false,
    hasLoader,
    hasFramework,
    hasData,
    hasWasm,
    deployable: hasLoader && hasData && hasWasm, // fallback definition
    notes: ["Structure fields not present in scan output; using Build-folder heuristics only."],
  };
}

function scoreHosts(scan: ScanLike): { scores: HostScore[]; recommended: HostScore } {
  const quick = Number.isFinite(scan?.quick_score) ? Number(scan.quick_score) : 60;
  const compressionMode = detectCompressionMode(scan);
  const structure = detectStructure(scan);

  const needsHeaders = compressionMode === "brotli" || compressionMode === "gzip" || compressionMode === "mixed";
  const hasBrotli = compressionMode === "brotli" || compressionMode === "mixed";
  const hasGzip = compressionMode === "gzip" || compressionMode === "mixed";

  const baseReadiness = clamp(quick);

  function make(slug: HostSlug, base: number, reasons: string[], compatible: boolean, fixpackRequired: boolean) {
    const compliant = !needsHeaders || fixpackRequired; // if compressed, compliance is achieved via fixpack/config
    const certified = compatible && structure.deployable;

    const score = clamp(
      base +
        (structure.deployable ? 10 : -25) +
        (needsHeaders ? 0 : 8) +
        (slug === "github_pages" && needsHeaders ? -40 : 0) +
        (slug === "github_pages" && !needsHeaders ? 10 : 0)
    );

    return {
      slug,
      score,
      certified,
      compliant,
      compatible,
      reasons,
      fixpackRequired,
    } satisfies HostScore;
  }

  const scores: HostScore[] = [];

  // NETLIFY
  scores.push(
    make(
      "netlify",
      baseReadiness + 6,
      [
        structure.deployable ? "Build structure looks deployable." : "Build structure may be incomplete.",
        needsHeaders ? "Compressed assets detected; headers required (FixPack)." : "No pre-compression detected; standard hosting ok.",
        "Strong fit for static WebGL hosting + easy deployment.",
      ],
      structure.deployable,
      needsHeaders
    )
  );

  // VERCEL
  scores.push(
    make(
      "vercel",
      baseReadiness + 4,
      [
        structure.deployable ? "Build structure looks deployable." : "Build structure may be incomplete.",
        needsHeaders ? "Compressed assets detected; headers required (FixPack)." : "No pre-compression detected; standard hosting ok.",
        "Good fit when paired with your Neon-backed Studio workflow.",
      ],
      structure.deployable,
      needsHeaders
    )
  );

  // APACHE
  scores.push(
    make(
      "apache",
      baseReadiness,
      [
        structure.deployable ? "Build structure looks deployable." : "Build structure may be incomplete.",
        needsHeaders ? "Compressed assets detected; server config required (FixPack)." : "No pre-compression detected; standard config ok.",
        "Great when client controls server config.",
      ],
      structure.deployable,
      needsHeaders
    )
  );

  // NGINX
  scores.push(
    make(
      "nginx",
      baseReadiness,
      [
        structure.deployable ? "Build structure looks deployable." : "Build structure may be incomplete.",
        needsHeaders ? "Compressed assets detected; server config required (FixPack)." : "No pre-compression detected; standard config ok.",
        "Excellent performance for WebGL with proper config.",
      ],
      structure.deployable,
      needsHeaders
    )
  );

  // GITHUB PAGES
  scores.push(
    make(
      "github_pages",
      baseReadiness - (needsHeaders ? 15 : 0),
      [
        needsHeaders
          ? "Compressed assets detected; GitHub Pages cannot reliably serve Content-Encoding headers."
          : "Uncompressed builds can work on GitHub Pages.",
        "Use only for simple demos unless you control headers elsewhere.",
      ],
      structure.deployable && !needsHeaders,
      false
    )
  );

  // Pick best score
  const recommended = [...scores].sort((a, b) => b.score - a.score)[0];

  // Add a couple extra reasons to recommended
  recommended.reasons.push(
    hasBrotli ? "Brotli detected (best performance when hosted correctly)." : hasGzip ? "Gzip detected." : "No compression detected."
  );
  if (structure.notes.length) recommended.reasons.push(...structure.notes.slice(0, 3));

  return { scores, recommended };
}

export async function POST(req: NextRequest) {
  try {
    // ---------- AUTH ----------
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const email = session.user.email;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ---------- FILE ----------
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Missing ZIP file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // ---------- RUN SCAN ----------
    const scan = await scanWebglBuildZip(buffer);

    // ---------- AUTO HOST SCORING ----------
    const hostScoring = scoreHosts(scan);
    const recommendedHost = hostScoring.recommended.slug;

    // ---------- FIND / CREATE PROJECT ----------
    const projectName = (form.get("projectName") as string) || "Default Project";

    let project = await prisma.project.findUnique({
      where: {
        userId_name: {
          userId: user.id,
          name: projectName,
        },
      },
    });

    if (!project) {
      project = await prisma.project.create({
        data: {
          userId: user.id,
          name: projectName,
        },
      });
    }

    // ---------- GENERATE CERT ID ----------
    const certId = await generateCertId();

    // ---------- CREATE BUILD ----------
    const build = await prisma.build.create({
      data: {
        userId: user.id,
        projectId: project.id,

        status: "scanned",
        scanResult: scan as any,
        scannedAt: new Date(),

        quickScore: scan.quick_score,
        brotliPresent: scan.compression.brotli_present,
        gzipPresent: scan.compression.gzip_present,

        certId,
        reportStatus: "draft",
        certifiedAt: new Date(),
      },
    });

    // ---------- LINK TO Host table (optional, safe) ----------
    // If Host rows exist, attach targetHostId; if not, we still save strings + JSON
    const hostRow = await prisma.host
      .findUnique({ where: { slug: recommendedHost } })
      .catch(() => null);

    // ---------- UPSERT LaunchProfile WITH SCORES ----------
    // This makes History + Launch Wizard show scores immediately
    await prisma.launchProfile.upsert({
      where: { buildId: build.id },
      update: {
        hostProvider: recommendedHost,
        // Keep destinationPlatform unchanged for now
        readinessScore: clamp(scan.quick_score),
        platformFitScore: clamp(scan.quick_score), // v1 = same as readiness; can evolve later
        hostCompatibilityScore: clamp(hostScoring.recommended.score),
        recommendationsJson: {
          v: 1,
          recommendedHost,
          recommended: hostScoring.recommended,
          allHosts: hostScoring.scores,
        },
        targetHostId: hostRow?.id ?? null,
      },
      create: {
        buildId: build.id,
        hostProvider: recommendedHost,
        destinationPlatform: "unknown",
        goal: "test",
        monetization: "unknown",
        readinessScore: clamp(scan.quick_score),
        platformFitScore: clamp(scan.quick_score),
        hostCompatibilityScore: clamp(hostScoring.recommended.score),
        recommendationsJson: {
          v: 1,
          recommendedHost,
          recommended: hostScoring.recommended,
          allHosts: hostScoring.scores,
        },
        targetHostId: hostRow?.id ?? null,
      },
    });

    // ---------- RESPONSE ----------
    return NextResponse.json({
      ok: true,
      buildId: build.id,
      certId: build.certId,
      reportUrl: `/report/${build.certId}`,

      quickScore: build.quickScore,

      // expose scoring summary to UI immediately if you want
      recommendedHost,
      hostCompatibilityScore: hostScoring.recommended.score,
    });
  } catch (err: any) {
    console.error("SCAN ERROR", err);
    return NextResponse.json({ error: err?.message || "Scan failed" }, { status: 500 });
  }
}