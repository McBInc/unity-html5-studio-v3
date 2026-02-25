import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Props {
  params: {
    certId: string;
  };
}

export default async function Page({ params }: Props) {

  const build = await prisma.build.findUnique({
    where: {
      certId: params.certId,
    },
    include: {
      project: true,
      launchProfile: true,
      fixPacks: true,
    },
  });

  if (!build) {

    return (

      <div style={{ padding: 40 }}>

        <h1>Report Not Found</h1>

      </div>

    );

  }

  const allocationPassed =
    build.allocationAt &&
    new Date() >= build.allocationAt;

  const reveal =
    build.reportStatus === "revealed" ||
    allocationPassed;

  return (

    <div style={{ padding: 40, fontFamily: "sans-serif" }}>

      <h1>WebGLive Certification Report</h1>

      <p>

        Certificate ID: <b>{build.certId}</b>

      </p>

      <hr />

      <h2>Project</h2>

      <p>{build.project.name}</p>

      <h2>Scan Summary</h2>

      <p>Quick Score: {build.quickScore}</p>

      <p>Brotli: {String(build.brotliPresent)}</p>

      <p>Gzip: {String(build.gzipPresent)}</p>

      <h2>Launch Readiness</h2>

      <p>

        Readiness Score:

        {" "}

        {build.launchProfile?.readinessScore}

      </p>

      <h2>Time To Live Allocation</h2>

      <p>

        Allocation:

        {" "}

        {build.allocationAt?.toISOString()}

      </p>

      <h2>Play Now</h2>

      {

        reveal && build.liveUrl

          ? (

            <a href={build.liveUrl}>

              Play Live Game

            </a>

          )

          : (

            <p>

              Link revealed after deployment

            </p>

          )

      }

    </div>

  );

}