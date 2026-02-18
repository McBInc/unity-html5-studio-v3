-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fixPackUses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subscriptionActive" BOOLEAN NOT NULL DEFAULT false;
