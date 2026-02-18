// src/app/api/fixpacks/use/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FREE_LIMIT = 3;

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim().toLowerCase() ?? "";
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, fixPackUses: true, subscriptionActive: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (!user.subscriptionActive && user.fixPackUses >= FREE_LIMIT) {
      return NextResponse.json(
        {
          ok: false,
          error: "Free limit reached",
          requiresSubscription: true,
          remainingFreeUses: 0,
        },
        { status: 403 }
      );
    }

    if (!user.subscriptionActive) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { fixPackUses: { increment: 1 } },
        select: { fixPackUses: true, subscriptionActive: true },
      });

      return NextResponse.json({
        ok: true,
        fixPackUses: updated.fixPackUses,
        remainingFreeUses: Math.max(0, FREE_LIMIT - updated.fixPackUses),
        subscriptionActive: updated.subscriptionActive,
      });
    }

    // Pro users: don’t increment / don’t limit
    return NextResponse.json({
      ok: true,
      fixPackUses: user.fixPackUses,
      remainingFreeUses: 999999,
      subscriptionActive: true,
    });
  } catch (err) {
    console.error("[api/fixpacks/use] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
