// src/app/api/build/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ ok: false, error: "Missing build id" }, { status: 400 });
    }

    const build = await prisma.build.findUnique({
      where: { id },
      include: { project: true, launchProfile: true },
    });

    if (!build) {
      return NextResponse.json({ ok: false, error: "Build not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      build: {
        id: build.id,
        certId: build.certId,

        reportStatus: build.reportStatus,
        scannedAt: build.scannedAt,
        quickScore: build.quickScore ?? 0,

        brotliPresent: !!build.brotliPresent,
        gzipPresent: !!build.gzipPresent,

        scanResult: build.scanResult ?? null,

        liveUrl: build.liveUrl ?? null,
        publishEvidence: (build as any).publishEvidence ?? null,

        project: build.project ? { id: build.project.id, name: build.project.name } : null,
        launchProfile: build.launchProfile ?? null,

        createdAt: build.createdAt,
        updatedAt: build.updatedAt,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load build" },
      { status: 500 }
    );
  }
}