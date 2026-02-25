import { prisma } from "@/lib/db";
import ReportClient, { ReportPayload } from "./ReportClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page({ params }: { params: { certId: string } }) {

  const certId = params.certId;

  const build = await prisma.build.findFirst({
    where: { certId },
    orderBy: { scannedAt: "desc" },
    include: { project: true, launchProfile: true },
  });

  if (!build) {
    return <div style={{ padding: 20 }}>Report not found.</div>;
  }

  const initial: ReportPayload = {
    ok: true,
    certId: build.certId || certId,
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