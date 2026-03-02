// src/app/report/[certId]/page.tsx
import ReportClient, { ReportPayload } from "./report-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: { certId: string };
}) {
  const certId = decodeURIComponent(params.certId || "").trim();

  let initial: ReportPayload = { ok: false, error: "Missing certId" };

  if (certId) {
    const base = process.env.NEXT_PUBLIC_BASE_URL || "";
    // Use relative fetch if base isn't provided (works on Vercel too)
    const url = base
      ? `${base}/api/report/${encodeURIComponent(certId)}`
      : `/api/report/${encodeURIComponent(certId)}`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      initial = (await res.json()) as ReportPayload;
    } catch (e: any) {
      initial = { ok: false, error: e?.message || "Failed to load report" };
    }
  }

  return <ReportClient certId={certId} initial={initial} />;
}