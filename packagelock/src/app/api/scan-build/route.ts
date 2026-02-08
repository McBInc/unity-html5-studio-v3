import { NextResponse } from "next/server";
import { scanWebglBuildZip } from "@/lib/scanners/scanWebglBuildZip";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("zip");
  if (!file || !(file instanceof File)) {
    return new NextResponse("Missing zip file", { status: 400 });
  }
  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  try {
    const result = await scanWebglBuildZip(buf);
    return NextResponse.json(result);
  } catch (e: any) {
    return new NextResponse(e?.message || "Scan failed", { status: 500 });
  }
}
