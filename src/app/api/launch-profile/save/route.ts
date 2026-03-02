// src/app/api/launch-profile/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(msg: string, extra?: any) {
  return NextResponse.json({ ok: false, error: msg, ...extra }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    const buildId = typeof body?.buildId === "string" ? body.buildId.trim() : "";
    if (!buildId || buildId === "undefined" || buildId === "null") {
      return bad("Missing buildId");
    }

    // Optional fields (keep strings consistent with your schema)
    const hostProvider = typeof body?.hostProvider === "string" ? body.hostProvider : undefined;
    const destinationPlatform = typeof body?.destinationPlatform === "string" ? body.destinationPlatform : undefined;
    const goal = typeof body?.goal === "string" ? body.goal : undefined;
    const monetization = typeof body?.monetization === "string" ? body.monetization : undefined;

    const targetPlatformId = typeof body?.targetPlatformId === "string" ? body.targetPlatformId : undefined;
    const targetHostId = typeof body?.targetHostId === "string" ? body.targetHostId : undefined;

    const monetizationIntent = typeof body?.monetizationIntent === "string" ? body.monetizationIntent : undefined;
    const distributionStrategy = typeof body?.distributionStrategy === "string" ? body.distributionStrategy : undefined;

    const readinessScore =
      Number.isFinite(body?.readinessScore) ? Number(body.readinessScore) : undefined;
    const platformFitScore =
      Number.isFinite(body?.platformFitScore) ? Number(body.platformFitScore) : undefined;
    const hostCompatibilityScore =
      Number.isFinite(body?.hostCompatibilityScore) ? Number(body.hostCompatibilityScore) : undefined;

    const recommendationsJson = body?.recommendationsJson ?? undefined;

    // Ensure Build exists
    const build = await prisma.build.findUnique({ where: { id: buildId } });
    if (!build) return NextResponse.json({ ok: false, error: "Build not found" }, { status: 404 });

    const lp = await prisma.launchProfile.upsert({
      where: { buildId },
      update: {
        ...(hostProvider ? { hostProvider } : {}),
        ...(destinationPlatform ? { destinationPlatform } : {}),
        ...(goal ? { goal } : {}),
        ...(monetization ? { monetization } : {}),

        ...(typeof targetPlatformId === "string" ? { targetPlatformId } : {}),
        ...(typeof targetHostId === "string" ? { targetHostId } : {}),

        ...(monetizationIntent !== undefined ? { monetizationIntent } : {}),
        ...(distributionStrategy !== undefined ? { distributionStrategy } : {}),

        ...(readinessScore !== undefined ? { readinessScore } : {}),
        ...(platformFitScore !== undefined ? { platformFitScore } : {}),
        ...(hostCompatibilityScore !== undefined ? { hostCompatibilityScore } : {}),

        ...(recommendationsJson !== undefined ? { recommendationsJson } : {}),
      },
      create: {
        buildId,
        hostProvider: hostProvider || "unknown",
        destinationPlatform: destinationPlatform || "unknown",
        goal: goal || "test",
        monetetization: undefined as any, // safeguard if typo exists elsewhere
        monetization: monetization || "unknown",

        targetPlatformId: targetPlatformId ?? null,
        targetHostId: targetHostId ?? null,

        monetizationIntent: monetizationIntent ?? null,
        distributionStrategy: distributionStrategy ?? null,

        readinessScore: readinessScore ?? null,
        platformFitScore: platformFitScore ?? null,
        hostCompatibilityScore: hostCompatibilityScore ?? null,
        recommendationsJson: recommendationsJson ?? null,
      } as any,
    });

    return NextResponse.json({ ok: true, launchProfile: lp });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Save failed" }, { status: 500 });
  }
}