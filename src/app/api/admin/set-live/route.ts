import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

export async function POST(req: NextRequest) {

  const session = await getServerSession(authOptions);

  if (!session?.user?.email)
    return NextResponse.json({ ok:false, error:"Not authenticated" }, { status:401 });

  if (session.user.email !== ADMIN_EMAIL)
    return NextResponse.json({ ok:false, error:"Not admin" }, { status:403 });

  const body = await req.json();

  const certId = body.certId;
  const liveUrl = body.liveUrl;

  if (!certId || !liveUrl)
    return NextResponse.json({ ok:false, error:"Missing data" }, { status:400 });

  const build = await prisma.build.findFirst({
    where:{ certId },
    orderBy:{ scannedAt:"desc" }
  });

  if (!build)
    return NextResponse.json({ ok:false, error:"Build not found" }, { status:404 });

  await prisma.build.update({
    where:{ id:build.id },
    data:{
      liveUrl,
      reportStatus:"issued",
      certifiedAt:new Date()
    }
  });

  return NextResponse.json({ ok:true });

}