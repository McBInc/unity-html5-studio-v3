// src/app/api/launch-profile/save/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { normalizeScan } from "@/lib/launch/normalizeScan";
import { scoreLaunch } from "@/lib/launch/scoring";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const buildId = String(body.buildId || "");
    const targetPlatformId = body.targetPlatformId ? String(body.targetPlatformId) : null;
    const targetHostId = body.targetHostId ? String(body.targetHostId) : null;
    const monetizationIntent = body.monetizationIntent ? String(body.monetizationIntent) : null;
    const distributionStrategy = body.distributionStrategy ? String(body.distributionStrategy) : null;

    if (!buildId) {
      return NextResponse.json({ error: "Missing buildId" }, { status: 400 });
    }
    if (!targetPlatformId || !targetHostId) {
      return NextResponse.json(
        { error: "Missing targetPlatformId or targetHostId" },
        { status: 400 }
      );
    }

    const build = await prisma.build.findUnique({
      where: { id: buildId },
      include: { launchProfile: true },
    });

    if (!build) {
      return NextResponse.json({ error: "Build not found" }, { status: 404 });
    }

    // ✅ Your schema uses Build.scanResult
    const scanJson = build.scanResult;

    if (!scanJson) {
      return NextResponse.json({ error: "Build has no scan JSON" }, { status: 400 });
    }

    const [platform, host] = await Promise.all([
      prisma.platform.findUnique({ where: { id: targetPlatformId } }),
      prisma.host.findUnique({ where: { id: targetHostId } }),
    ]);

    if (!platform || !host) {
      return NextResponse.json({ error: "Platform or Host not found" }, { status: 404 });
    }

    const acceptedCompression = safeParseJsonArray(platform.acceptedCompression);

    const normalized = normalizeScan(scanJson, build);

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

    const recommendationsJson = {
      platform: { id: platform.id, name: platform.name, slug: platform.slug },
      host: { id: host.id, name: host.name, slug: host.slug },
      scores: score,
      generatedAt: new Date().toISOString(),
    };

    const launchProfile = await prisma.launchProfile.upsert({
      where: { buildId },
      update: {
        // new intelligence fields
        targetPlatformId,
        targetHostId,
        monetizationIntent,
        distributionStrategy,
        readinessScore: score.readinessScore,
        platformFitScore: score.platformFit.score,
        hostCompatibilityScore: score.hostCompatibility.score,
        recommendationsJson,
      },
      create: {
        buildId,

        // keep old fields stable (optional defaults)
        // hostProvider/destinationPlatform remain whatever defaults you set in schema

        // new intelligence fields
        targetPlatformId,
        targetHostId,
        monetizationIntent,
        distributionStrategy,
        readinessScore: score.readinessScore,
        platformFitScore: score.platformFit.score,
        hostCompatibilityScore: score.hostCompatibility.score,
        recommendationsJson,
      },
    });

    return NextResponse.json({ ok: true, launchProfile, score });
  } catch (err: any) {
    console.error("launch-profile/save error:", err);
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
