import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const id = (ctx.params?.id || "").trim();

    const url = new URL(req.url);
    const emailRaw = (url.searchParams.get("email") || "").trim();
    const email = emailRaw.toLowerCase();

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

    // 1) Find the user first (by email)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "No user found for this email",
          debug: { email },
        },
        { status: 404 }
      );
    }

    // 2) Now fetch the build by id + userId (more reliable than nested email filter)
    const build = await prisma.build.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        project: { select: { id: true, name: true } },
        launchProfile: true,
        fixPacks: {
          select: {
            id: true,
            createdAt: true,
            hostProvider: true,
            destinationPlatform: true,
            version: true,
          },
        },
      },
    });

    if (!build) {
      return NextResponse.json(
        {
          success: false,
          error: "Build not found for this email",
          debug: { buildId: id, email, userId: user.id },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      build,
    });
  } catch (err: any) {
    console.error("[api/build/[id]] failed:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to load build" },
      { status: 500 }
    );
  }
}
