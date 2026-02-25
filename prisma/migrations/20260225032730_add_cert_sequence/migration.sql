-- CreateTable
CREATE TABLE "CertSequence" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertSequence_pkey" PRIMARY KEY ("id")
);
