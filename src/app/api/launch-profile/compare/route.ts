// src/app/api/launch-profile/compare/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const buildId = req.nextUrl.searchParams.get("buildId")?.trim();

    if (!buildId || buildId === "undefined" || buildId === "null") {
      return NextResponse.json({ ok: false, error: "Missing buildId" }, { status: 400 });
    }

    const lp = await prisma.launchProfile.findUnique({
      where: { buildId },
      include: { targetPlatform: true, targetHost: true },
    });

    return NextResponse.json({ ok: true, launchProfile: lp });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Compare failed" }, { status: 500 });
  }
}