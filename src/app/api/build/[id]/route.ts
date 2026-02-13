import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    const url = new URL(req.url);
    const email = (url.searchParams.get("email") || "").trim().toLowerCase();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing build id" },
        { status: 400 }
      );
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid email" },
        { status: 400 }
      );
    }

    // Soft auth until Auth is implemented:
    // Only return the build if it belongs to the user (by email).
    const build = await prisma.build.findFirst({
      where: {
        id,
        user: { email },
      },
      include: {
        project: { select: { id: true, name: true } },
        launchProfile: true,
        fixPacks: { select: { id: true, createdAt: true, hostProvider: true, destinationPlatform: true, version: true } },
      },
    });

    if (!build) {
      return NextResponse.json(
        { success: false, error: "Build not found for this email" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      build: {
        id: build.id,
        status: build.status,
        createdAt: build.createdAt,
        updatedAt: build.updatedAt,

        scannedAt: (build as any).scannedAt ?? null,
        quickScore: (build as any).quickScore ?? null,
        brotliPresent: (build as any).brotliPresent ?? null,
        gzipPresent: (build as any).gzipPresent ?? null,

        scanResult: (build as any).scanResult ?? null,

        project: build.project,
        launchProfile: build.launchProfile,
        fixPacks: build.fixPacks,
      },
    });
  } catch (err: any) {
    console.error("[api/build/:id] failed:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to load build" },
      { status: 500 }
    );
  }
}
