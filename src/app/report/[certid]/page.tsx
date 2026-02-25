import ReportClient from "./ReportClient";

export default async function Page({ params }: { params: { certid: string } }) {
  return <ReportClient certId={params.certid} />;
}