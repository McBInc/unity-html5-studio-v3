-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_email_key" ON "Entitlement"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_stripeCustomerId_key" ON "Entitlement"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_stripeSubId_key" ON "Entitlement"("stripeSubId");
