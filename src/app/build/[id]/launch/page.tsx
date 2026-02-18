// src/app/build/[id]/launch/page.tsx

import { PrismaClient } from "@/generated/prisma";
import LaunchWizard from "./wizard-client";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function LaunchPage({
  params,
}: {
  params: { id: string };
}) {
  const buildId = params.id;

  // ✅ Require login
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/signin");
  }

  // ✅ Fetch build AND verify ownership
  const build = await prisma.build.findUnique({
    where: { id: buildId },
    select: { userId: true },
  });

  if (!build) {
    redirect("/history");
  }

  // ✅ Ensure this build belongs to logged-in user
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user || build.userId !== user.id) {
    redirect("/history");
  }

  // ✅ Safe to load wizard
  const [platforms, hosts, existing] = await Promise.all([
    prisma.platform.findMany({ orderBy: { name: "asc" } }),
    prisma.host.findMany({ orderBy: { name: "asc" } }),
    prisma.launchProfile.findUnique({ where: { buildId } }),
  ]);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">
        Launch Wizard
      </h1>

      <p className="text-sm text-muted-foreground mb-6">
        Choose your target platform and hosting provider.
        We compute readiness and generate deployment guidance.
      </p>

      <LaunchWizard
        buildId={buildId}
        platforms={platforms}
        hosts={hosts}
        existing={existing}
      />
    </div>
  );
}
