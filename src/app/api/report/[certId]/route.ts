// src/app/api/report/[certId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ certId: string }> }) {
  try {
    const { certId } = await ctx.params;

    if (!certId || typeof certId !== "string") {
      return NextResponse.json({ ok: false, error: "Missing certId" }, { status: 400 });
    }

    const build = await prisma.build.findUnique({
      where: { certId },
      include: {
        project: true,
        launchProfile: true,
      },
    });

    if (!build) {
      return NextResponse.json({ ok: false, error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      certId: build.certId,
      buildId: build.id,
      projectName: build.project?.name ?? "Untitled Project",
      scannedAt: build.scannedAt,
      quickScore: build.quickScore ?? 0,
      brotliPresent: !!build.brotliPresent,
      gzipPresent: !!build.gzipPresent,
      scan: build.scanResult ?? null,
      launchProfile: build.launchProfile ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to load report" }, { status: 500 });
  }
}