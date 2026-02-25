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
  const mode = scan?.compression_mode;
  if (mode === "brotli" || mode === "gzip" || mode === "none" || mode === "mixed") return mode;

  const brotli = !!scan?.compression?.brotli_present;
  const gzip = !!scan?.compression?.gzip_present;

  if (brotli && gzip) return "mixed";
  if (brotli) return "brotli";
  if (gzip) return "gzip";
  return "none";
}

function detectStructure(scan: ScanLike) {
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

  const fileNames: string[] = Array.isArray(scan?.files)
    ? scan.files.map((f: any) => String(f?.name || ""))
    : [];

  const hasLoader = fileNames.some((n) => n.toLowerCase().endsWith(".loader.js"));
  const hasFramework = fileNames.some((n) => n.toLowerCase().includes(".framework.js"));
  const hasData = fileNames.some(
    (n) => n.endsWith(".data") || n.endsWith(".data.br") || n.endsWith(".data.gz")
  );
  const hasWasm = fileNames.some(
    (n) => n.endsWith(".wasm") || n.endsWith(".wasm.br") || n.endsWith(".wasm.gz")
  );

  return {
    hasIndex: false,
    hasTemplateData: false,
    hasLoader,
    hasFramework,
    hasData,
    hasWasm,
    deployable: hasLoader && hasData && hasWasm,
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

  function make(
    slug: HostSlug,
    base: number,
    reasons: string[],
    compatible: boolean,
    fixpackRequired: boolean
  ) {
    const compliant = !needsHeaders || fixpackRequired;
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

  const recommended = [...scores].sort((a, b) => b.score - a.score)[0];

  recommended.reasons.push(
    hasBrotli ? "Brotli detected (best performance when hosted correctly)." : hasGzip ? "Gzip detected." : "No compression detected."
  );

  if (structure.notes.length) recommended.reasons.push(...structure.notes.slice(0, 3));

  return { scores, recommended };
}

function getContentType(req: NextRequest) {
  return (req.headers.get("content-type") || "").toLowerCase();
}

function decodeBase64ToBuffer(b64: string): Buffer {
  // Allow data:...;base64,xxxx
  const comma = b64.indexOf(",");
  const raw = comma >= 0 ? b64.slice(comma + 1) : b64;
  return Buffer.from(raw, "base64");
}

async function parseUpload(req: NextRequest): Promise<{
  buffer: Buffer;
  projectName: string;
  originalName: string;
}> {
  const ct = getContentType(req);

  // 1) multipart/form-data (normal browser upload)
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      throw new Error("Missing ZIP file (expected form field: file)");
    }

    const projectName = (form.get("projectName") as string) || "Default Project";
    const originalName = (file as any)?.name ? String((file as any).name) : "build.zip";

    const buffer = Buffer.from(await file.arrayBuffer());
    return { buffer, projectName, originalName };
  }

  // 2) JSON (support base64 ZIP posts)
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => null);
    const zipBase64 = body?.zipBase64 || body?.zip_b64 || body?.zip;

    if (!zipBase64 || typeof zipBase64 !== "string") {
      throw new Error(
        'Invalid JSON body. Expected { "zipBase64": "<base64>" } (optionally with "projectName").'
      );
    }

    const projectName = typeof body?.projectName === "string" && body.projectName.trim()
      ? body.projectName.trim()
      : "Default Project";

    const originalName = typeof body?.filename === "string" && body.filename.trim()
      ? body.filename.trim()
      : "build.zip";

    const buffer = decodeBase64ToBuffer(zipBase64);
    return { buffer, projectName, originalName };
  }

  // 3) Raw bytes (application/octet-stream)
  if (ct.includes("application/octet-stream") || ct.includes("application/zip")) {
    const ab = await req.arrayBuffer();
    const buffer = Buffer.from(ab);

    const projectName = req.nextUrl.searchParams.get("projectName") || "Default Project";
    const originalName = req.headers.get("x-filename") || "build.zip";

    if (!buffer.length) throw new Error("Empty request body (expected ZIP bytes).");
    return { buffer, projectName, originalName };
  }

  // Unsupported
  throw new Error(
    `Unsupported Content-Type: "${ct || "missing"}". Use multipart/form-data (recommended), or application/json (base64), or application/octet-stream.`
  );
}

export async function POST(req: NextRequest) {
  try {
    // ---------- AUTH ----------
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const email = session.user.email;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    // ---------- FILE ----------
    const { buffer, projectName } = await parseUpload(req);

    // ---------- RUN SCAN ----------
    const scan = await scanWebglBuildZip(buffer);

    // ---------- HOST SCORING ----------
    const hostScoring = scoreHosts(scan);
    const recommendedHost = hostScoring.recommended.slug;

    // ---------- FIND / CREATE PROJECT ----------
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

    // ---------- CERT ID ----------
    const certId = await generateCertId();

    // Safe guards for scan fields
    const quickScore = Number.isFinite(scan?.quick_score) ? Number(scan.quick_score) : 0;
    const brotliPresent = !!scan?.compression?.brotli_present;
    const gzipPresent = !!scan?.compression?.gzip_present;

    // ---------- CREATE BUILD ----------
    const build = await prisma.build.create({
      data: {
        userId: user.id,
        projectId: project.id,

        status: "scanned",
        scanResult: scan as any,
        scannedAt: new Date(),

        quickScore,
        brotliPresent,
        gzipPresent,

        certId,
        reportStatus: "draft",
        certifiedAt: new Date(),
      },
    });

    // ---------- OPTIONAL Host table linkage ----------
    const hostRow = await prisma.host
      .findUnique({ where: { slug: recommendedHost } })
      .catch(() => null);

    // ---------- UPSERT LaunchProfile ----------
    await prisma.launchProfile.upsert({
      where: { buildId: build.id },
      update: {
        hostProvider: recommendedHost,
        readinessScore: clamp(quickScore),
        platformFitScore: clamp(quickScore),
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
        readinessScore: clamp(quickScore),
        platformFitScore: clamp(quickScore),
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

    return NextResponse.json({
      ok: true,
      buildId: build.id,
      certId: build.certId,
      reportUrl: `/report/${build.certId}`,
      scan,

      quickScore: build.quickScore,
      recommendedHost,
      hostCompatibilityScore: hostScoring.recommended.score,
    });
  } catch (err: any) {
    const msg = err?.message || "Scan failed";
    console.error("SCAN ERROR", err);

    // If it's the content-type mismatch, return 415 (Unsupported Media Type) to be explicit
    const ct = msg.toLowerCase().includes("unsupported content-type");
    return NextResponse.json({ ok: false, error: msg }, { status: ct ? 415 : 500 });
  }
}