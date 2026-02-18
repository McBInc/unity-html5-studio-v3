// src/app/build/[id]/launch/page.tsx
import LaunchWizard from "./wizard-client";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LaunchPage({ params }: { params: { id: string } }) {
  const buildId = params.id;

  const [platforms, hosts, existing] = await Promise.all([
    prisma.platform.findMany({ orderBy: { name: "asc" } }),
    prisma.host.findMany({ orderBy: { name: "asc" } }),
    prisma.launchProfile.findUnique({ where: { buildId } }),
  ]);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Launch Wizard</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Choose your target platform + host. We’ll compute Launch Readiness and generate targeted guidance.
      </p>

      <LaunchWizard buildId={buildId} platforms={platforms} hosts={hosts} existing={existing} />
    </div>
  );
}
