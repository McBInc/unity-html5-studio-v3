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

    // certId is @unique in your schema, so findUnique is the right call
    const build = await prisma.build.findUnique({
      where: { certId },
      include: { project: true, launchProfile: true },
    });

    if (!build) {
      // Helpful debug: show latest builds from THIS database (safe fields only)
      const latest = await prisma.build.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, certId: true, createdAt: true, reportStatus: true },
      });

      return NextResponse.json(
        {
          ok: false,
          error: "Report not found",
          hint: {
            requestedCertId: certId,
            latestBuilds: latest,
            note:
              "If requestedCertId is not present in latestBuilds, scan writes are likely going to a different DB/env.",
          },
        },
        { status: 404 }
      );
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

        // UI expects scanResult
        scanResult: build.scanResult ?? null,

        liveUrl: build.liveUrl ?? null,

        // publishEvidence exists in your newer flow (may not exist in DB yet)
        publishEvidence: (build as any).publishEvidence ?? null,

        project: build.project ? { id: build.project.id, name: build.project.name } : null,
        launchProfile: build.launchProfile ?? null,

        createdAt: build.createdAt,
        updatedAt: build.updatedAt,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load report" },
      { status: 500 }
    );
  }
}