// src/app/api/scanbuild/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ScanSchema = z.object({
  kind: z.literal("webgl_build_scan"),
  quick_score: z.number(),
  compression: z.object({
    brotli_present: z.boolean(),
    gzip_present: z.boolean(),
  }),
  scanned_at: z.string(),
});

const BodySchema = z.object({
  projectName: z.string().min(1),
  scan: ScanSchema,

  // optional metadata (safe to accept now, useful later)
  buildSizeMB: z.number().optional(),
  source: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    // ✅ session-locked
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim().toLowerCase() ?? "";
    if (!email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectName, scan } = BodySchema.parse(body);

    // 1) User (should exist already via NextAuth, but upsert is safe)
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
      select: { id: true, email: true },
    });

    // 2) Project (unique per user+name)
    const project = await prisma.project.upsert({
      where: {
        userId_name: {
          userId: user.id,
          name: projectName,
        },
      },
      update: {},
      create: {
        userId: user.id,
        name: projectName,
      },
      select: { id: true, name: true },
    });

    // 3) Build
    const build = await prisma.build.create({
      data: {
        userId: user.id,
        projectId: project.id,
        status: "scanned",
        scannedAt: new Date(scan.scanned_at),
        quickScore: scan.quick_score,
        brotliPresent: scan.compression.brotli_present,
        gzipPresent: scan.compression.gzip_present,
        scanResult: scan,
      },
      select: { id: true, projectId: true },
    });

    // 4) LaunchProfile (created empty now; wizard fills later)
    await prisma.launchProfile.create({
      data: { buildId: build.id },
      select: { id: true },
    });

    console.log("[scanbuild] saved build", {
      buildId: build.id,
      projectId: project.id,
      email: user.email,
    });

    return NextResponse.json({
      success: true,
      projectId: project.id,
      buildId: build.id,
      scan,
    });
  } catch (err: any) {
    console.error("[scanbuild] failed:", err);
    const message =
      err?.name === "ZodError"
        ? "Invalid request body"
        : err?.message || "Failed to save scan";

    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
