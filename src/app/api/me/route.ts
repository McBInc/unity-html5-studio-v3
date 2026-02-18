// src/app/api/me/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FREE_LIMIT = 3;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim().toLowerCase() ?? "";
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { email },
      select: { email: true, fixPackUses: true, subscriptionActive: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const remainingFreeUses = user.subscriptionActive ? 999999 : Math.max(0, FREE_LIMIT - user.fixPackUses);

    return NextResponse.json({
      ok: true,
      email: user.email,
      fixPackUses: user.fixPackUses,
      remainingFreeUses,
      subscriptionActive: user.subscriptionActive,
    });
  } catch (err) {
    console.error("[api/me] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
