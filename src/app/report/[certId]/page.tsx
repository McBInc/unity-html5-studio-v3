// src/app/report/[certId]/page.tsx
import ReportClient, { type ReportPayload } from "./report-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getInitial(certId: string): Promise<ReportPayload> {
  try {
    // Server-side fetch to our own route — use absolute URL if available
    const host =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_BASE_URL || "";

    const url = host
      ? `${host}/api/report/${encodeURIComponent(certId)}`
      : `/api/report/${encodeURIComponent(certId)}`;

    const res = await fetch(url, { cache: "no-store" });
    return (await res.json()) as ReportPayload;
  } catch (e: any) {
    return { ok: false, error: e?.message || "Failed to load report" };
  }
}

export default async function Page({
  params,
}: {
  params: { certId: string };
}) {
  const certId = String(params?.certId || "").trim();

  const initial = certId
    ? await getInitial(certId)
    : ({ ok: false, error: "Missing certId" } as ReportPayload);

  return <ReportClient certId={certId} initial={initial} />;
}