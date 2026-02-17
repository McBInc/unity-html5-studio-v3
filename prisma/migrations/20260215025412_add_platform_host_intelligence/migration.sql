-- AlterTable
ALTER TABLE "LaunchProfile" ADD COLUMN     "distributionStrategy" TEXT,
ADD COLUMN     "hostCompatibilityScore" INTEGER,
ADD COLUMN     "monetizationIntent" TEXT,
ADD COLUMN     "platformFitScore" INTEGER,
ADD COLUMN     "readinessScore" INTEGER,
ADD COLUMN     "recommendationsJson" JSONB,
ADD COLUMN     "targetHostId" TEXT,
ADD COLUMN     "targetPlatformId" TEXT;

-- CreateTable
CREATE TABLE "Platform" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "initialDownloadMaxMB" INTEGER,
    "totalBuildMaxMB" INTEGER,
    "maxFileCount" INTEGER,
    "maxSingleFileMB" INTEGER,
    "requiresCompressedBuild" BOOLEAN NOT NULL DEFAULT false,
    "acceptedCompression" TEXT NOT NULL,
    "requiresSdkInjection" BOOLEAN NOT NULL DEFAULT false,
    "sdkType" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Host" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "supportsBrotli" BOOLEAN NOT NULL DEFAULT false,
    "supportsGzip" BOOLEAN NOT NULL DEFAULT true,
    "requiresManualHeaderConfig" BOOLEAN NOT NULL DEFAULT false,
    "defaultSpaFallback" BOOLEAN NOT NULL DEFAULT true,
    "maxFileSizeMB" INTEGER,
    "edgeNetwork" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Host_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Platform_slug_key" ON "Platform"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Host_slug_key" ON "Host"("slug");

-- CreateIndex
CREATE INDEX "LaunchProfile_targetPlatformId_idx" ON "LaunchProfile"("targetPlatformId");

-- CreateIndex
CREATE INDEX "LaunchProfile_targetHostId_idx" ON "LaunchProfile"("targetHostId");

-- AddForeignKey
ALTER TABLE "LaunchProfile" ADD CONSTRAINT "LaunchProfile_targetPlatformId_fkey" FOREIGN KEY ("targetPlatformId") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchProfile" ADD CONSTRAINT "LaunchProfile_targetHostId_fkey" FOREIGN KEY ("targetHostId") REFERENCES "Host"("id") ON DELETE SET NULL ON UPDATE CASCADE;
