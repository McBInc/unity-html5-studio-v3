/*
  Warnings:

  - A unique constraint covering the columns `[certId]` on the table `Build` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Build" ADD COLUMN     "allocationAt" TIMESTAMP(3),
ADD COLUMN     "certId" TEXT,
ADD COLUMN     "certifiedAt" TIMESTAMP(3),
ADD COLUMN     "clipUrl" TEXT,
ADD COLUMN     "liveUrl" TEXT,
ADD COLUMN     "reportStatus" TEXT NOT NULL DEFAULT 'draft';

-- CreateIndex
CREATE UNIQUE INDEX "Build_certId_key" ON "Build"("certId");
