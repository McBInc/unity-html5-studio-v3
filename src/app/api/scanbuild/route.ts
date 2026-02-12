import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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
  email: z.string().email(),
  projectName: z.string().min(1),
  scan: ScanSchema,

  // optional metadata (safe to accept now, useful later)
  buildSizeMB: z.number().optional(),
  source: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, projectName, scan } = BodySchema.parse(body);

    // 1) User
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
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
    });

    // 3) Build
    const build = await prisma.build.create({
      data: {
        userId: user.id,
        projectId: project.id,

        status: "scanned",

        // Your schema currently includes these fields (as seen in Neon):
        scannedAt: new Date(scan.scanned_at),
        quickScore: scan.quick_score,
        brotliPresent: scan.compression.brotli_present,
        gzipPresent: scan.compression.gzip_present,

        scanResult: scan,
      },
    });

    // 4) LaunchProfile (created empty now; wizard will fill later)
    await prisma.launchProfile.create({
      data: {
        buildId: build.id,
      },
    });

    console.log("[scanbuild] saved build", { buildId: build.id, projectId: project.id, email });

    return NextResponse.json({
      success: true,
      projectId: project.id,
      buildId: build.id,
      scan,
    });
  } catch (err: any) {
    console.error("[scanbuild] failed:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to save scan" },
      { status: 400 }
    );
  }
}
