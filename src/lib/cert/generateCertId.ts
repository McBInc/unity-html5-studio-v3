import { prisma } from "@/lib/db";

export async function generateCertId() {
  return prisma.$transaction(async (tx) => {

    const seq = await tx.certSequence.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, nextValue: 1 },
    });

    const current = seq.nextValue;

    await tx.certSequence.update({
      where: { id: 1 },
      data: { nextValue: current + 1 },
    });

    const certId = `WGL-CERT-${String(current).padStart(6, "0")}`;

    return certId;
  });
}