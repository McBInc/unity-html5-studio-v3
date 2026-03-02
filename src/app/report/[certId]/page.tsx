// src/app/report/[certId]/page.tsx
import ReportClient from "./report-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveParams<T>(p: T | Promise<T>): Promise<T> {
  return typeof (p as any)?.then === "function" ? await (p as any) : (p as any);
}

export default async function Page({
  params,
}: {
  params: { certId: string } | Promise<{ certId: string }>;
}) {
  const resolved = await resolveParams(params);
  const certId = String(resolved?.certId || "").trim();

  // IMPORTANT: do not SSR-fetch here; keep it minimal so it cannot crash the route
  return <ReportClient certId={certId} initial={{ ok: false, error: "loading" }} />;
}