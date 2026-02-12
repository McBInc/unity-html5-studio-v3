import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const QuerySchema = z.object({
  email: z.string().email(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email") || "";
    const { email: parsedEmail } = QuerySchema.parse({ email });

    // Find the user (optional — we can still show builds even if user row missing,
    // but in your system it should exist now)
    const user = await prisma.user.findUnique({
      where: { email: parsedEmail },
      select: { id: true, email: true, createdAt: true },
    });

    // Pull builds for that email via user relation.
    // (We store userId on Build, so this is reliable.)
    const builds = user
      ? await prisma.build.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          include: {
            project: { select: { id: true, name: true } },
            launchProfile: { select: { id: true } },
            fixPacks: { select: { id: true } },
          },
          take: 200,
        })
      : [];

    return NextResponse.json({
      success: true,
      user,
      builds: builds.map((b) => ({
        id: b.id,
        createdAt: b.createdAt,
        scannedAt: (b as any).scannedAt ?? null, // if present in schema
        status: b.status,
        project: b.project,
        quickScore: (b as any).quickScore ?? null,
        brotliPresent: (b as any).brotliPresent ?? null,
        gzipPresent: (b as any).gzipPresent ?? null,
        hasLaunchProfile: !!b.launchProfile,
        fixPackCount: b.fixPacks?.length ?? 0,
        scanResult: b.scanResult ?? null,
      })),
    });
  } catch (err: any) {
    console.error("[history] GET failed:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to load history" },
      { status: 400 }
    );
  }
}
