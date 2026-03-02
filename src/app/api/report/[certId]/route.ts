// src/app/api/report/[certId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: { certId: string } }) {
  try {
    const certId = ctx.params?.certId;

    if (!certId || typeof certId !== "string") {
      return NextResponse.json({ ok: false, error: "Missing certId" }, { status: 400 });
    }

    // Prefer findUnique because certId is @unique in schema
    const build = await prisma.build.findUnique({
      where: { certId },
      include: { project: true, launchProfile: true },
    });

    if (!build) {
      // Helpful debug: show latest builds (safe-ish: no scanResult)
      const latest = await prisma.build.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, certId: true, createdAt: true },
      });

      return NextResponse.json(
        {
          ok: false,
          error: "Report not found",
          hint: {
            requestedCertId: certId,
            latestBuilds: latest,
            note:
              "If the requested certId is not in latestBuilds, your scan wrote to a different DB or certId did not persist.",
          },
        },
        { status: 404 }
      );
    }

    // Return a shape that your report page can display directly
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

        // IMPORTANT: match UI expectations
        scanResult: build.scanResult ?? null,

        liveUrl: build.liveUrl ?? null,
        publishEvidence: (build as any).publishEvidence ?? null,

        project: build.project ? { id: build.project.id, name: build.project.name } : null,
        launchProfile: build.launchProfile ?? null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load report" },
      { status: 500 }
    );
  }
}