// src/app/build/[id]/compare/page.tsx
import { prisma } from "@/lib/db";
import CompareClient from "./compare-client";

export default async function ComparePage({ params }: { params: { id: string } }) {
  const buildId = params.id;

  const [hosts, platforms, existing] = await Promise.all([
    prisma.host.findMany({ orderBy: { name: "asc" } }),
    prisma.platform.findMany({ orderBy: { name: "asc" } }),
    prisma.launchProfile.findUnique({ where: { buildId } }),
  ]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Platform Comparison</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Choose a host, then compare this build across platforms. You can apply the best match to your Launch Profile.
      </p>

      <CompareClient
        buildId={buildId}
        hosts={hosts}
        platforms={platforms}
        existing={existing}
      />
    </div>
  );
}
