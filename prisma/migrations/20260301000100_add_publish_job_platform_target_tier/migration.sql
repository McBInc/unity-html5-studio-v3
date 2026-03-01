-- Add enums
DO $$ BEGIN
  CREATE TYPE "PlatformTarget" AS ENUM (
    'WEB','MOBILE_WEB','TELEGRAM','META','DISCORD','TIKTOK','YOUTUBE_PLAYABLES','LINKEDIN_GAMES'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PublishMode" AS ENUM ('WE_PUBLISH','ASSISTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PublishStatus" AS ENUM ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Build table columns
ALTER TABLE "Build"
  ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'BASIC';

ALTER TABLE "Build"
  ADD COLUMN IF NOT EXISTS "platformTarget" "PlatformTarget" NOT NULL DEFAULT 'WEB';

ALTER TABLE "Build"
  ADD COLUMN IF NOT EXISTS "publishStatus" "PublishStatus";

ALTER TABLE "Build"
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

ALTER TABLE "Build"
  ADD COLUMN IF NOT EXISTS "publishEvidence" JSONB;

-- PublishJob table
CREATE TABLE IF NOT EXISTS "PublishJob" (
  "id" TEXT NOT NULL,
  "buildId" TEXT NOT NULL,
  "platformTarget" "PlatformTarget" NOT NULL,
  "mode" "PublishMode" NOT NULL DEFAULT 'ASSISTED',
  "liveUrl" TEXT,
  "provider" TEXT,
  "providerMeta" JSONB,
  "status" "PublishStatus" NOT NULL DEFAULT 'QUEUED',
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "error" TEXT,
  "evidence" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublishJob_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "PublishJob"
    ADD CONSTRAINT "PublishJob_buildId_fkey"
    FOREIGN KEY ("buildId") REFERENCES "Build"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "Build_platformTarget_idx" ON "Build"("platformTarget");
CREATE INDEX IF NOT EXISTS "Build_publishStatus_idx" ON "Build"("publishStatus");

CREATE INDEX IF NOT EXISTS "PublishJob_buildId_idx" ON "PublishJob"("buildId");
CREATE INDEX IF NOT EXISTS "PublishJob_status_idx" ON "PublishJob"("status");
CREATE INDEX IF NOT EXISTS "PublishJob_platformTarget_idx" ON "PublishJob"("platformTarget");