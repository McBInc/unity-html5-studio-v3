// src/app/api/launch-profile/compare/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeScan } from "@/lib/launch/normalizeScan";
import { scoreLaunch } from "@/lib/launch/scoring";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const buildId = String(body.buildId || "");
    const targetHostId = body.targetHostId ? String(body.targetHostId) : null;

    if (!buildId) {
      return NextResponse.json({ error: "Missing buildId" }, { status: 400 });
    }
    if (!targetHostId) {
      return NextResponse.json({ error: "Missing targetHostId" }, { status: 400 });
    }

    const build = await prisma.build.findUnique({
      where: { id: buildId },
      include: { launchProfile: true },
    });

    if (!build) {
      return NextResponse.json({ error: "Build not found" }, { status: 404 });
    }

    const scanJson = build.scanResult;
    if (!scanJson) {
      return NextResponse.json({ error: "Build has no scan JSON" }, { status: 400 });
    }

    const host = await prisma.host.findUnique({ where: { id: targetHostId } });
    if (!host) {
      return NextResponse.json({ error: "Host not found" }, { status: 404 });
    }

    const platforms = await prisma.platform.findMany({ orderBy: { name: "asc" } });

    const normalized = normalizeScan(scanJson, build);

    const results = platforms.map((platform) => {
      const acceptedCompression = safeParseJsonArray(platform.acceptedCompression);

      const score = scoreLaunch(
        normalized,
        {
          name: platform.name,
          slug: platform.slug,
          initialDownloadMaxMB: platform.initialDownloadMaxMB,
          totalBuildMaxMB: platform.totalBuildMaxMB,
          maxFileCount: platform.maxFileCount,
          maxSingleFileMB: platform.maxSingleFileMB,
          requiresCompressedBuild: platform.requiresCompressedBuild,
          acceptedCompression,
          requiresSdkInjection: platform.requiresSdkInjection,
          sdkType: platform.sdkType,
        },
        {
          name: host.name,
          slug: host.slug,
          supportsBrotli: host.supportsBrotli,
          supportsGzip: host.supportsGzip,
          requiresManualHeaderConfig: host.requiresManualHeaderConfig,
          defaultSpaFallback: host.defaultSpaFallback,
        }
      );

      return {
        platform: {
          id: platform.id,
          name: platform.name,
          slug: platform.slug,
          notes: platform.notes,
        },
        score,
      };
    });

    // Highest readiness first
    results.sort((a, b) => b.score.readinessScore - a.score.readinessScore);

    return NextResponse.json({
      ok: true,
      buildId,
      host: { id: host.id, name: host.name, slug: host.slug, notes: host.notes },
      results,
    });
  } catch (err: any) {
    console.error("/api/launch-profile/compare error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function safeParseJsonArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
