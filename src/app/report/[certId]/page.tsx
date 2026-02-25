import { prisma } from "@/lib/db";
import ReportClient, { ReportPayload } from "./ReportClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page({ params }: { params: { certId: string } }) {
  const certId = params?.certId;

  if (!certId) {
    return <div style={{ padding: 20 }}>Missing certId in URL.</div>;
  }

  const build = await prisma.build.findFirst({
    where: { certId },
    orderBy: { scannedAt: "desc" },
    include: { project: true, launchProfile: true },
  });

  if (!build || !build.certId) {
    return <div style={{ padding: 20 }}>Report not found.</div>;
  }

  // Pass the draft report to the client component (instant render)
  const initial = {
    ok: true as const,
    certId: (build.certId || certId), 
    buildId: build.id,
    projectName: build.project?.name ?? "Untitled Project",
    scannedAt: build.scannedAt,
    quickScore: build.quickScore ?? 0,
    brotliPresent: !!build.brotliPresent,
    gzipPresent: !!build.gzipPresent,
    reportStatus: build.reportStatus,
    certifiedAt: build.certifiedAt,
    liveUrl: (build as any).liveUrl ?? null,
    clipUrl: (build as any).clipUrl ?? null,
    scan: build.scanResult ?? null,
    launchProfile: build.launchProfile ?? null,
  };

  return <ReportClient certId={certId} initial={initial} />;
}