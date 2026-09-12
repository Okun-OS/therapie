-- DropForeignKey (IF EXISTS so retries are safe)
ALTER TABLE "SupportAccessGrant" DROP CONSTRAINT IF EXISTS "SupportAccessGrant_ticketId_fkey";

-- DropForeignKey
ALTER TABLE "SupportAccessLog" DROP CONSTRAINT IF EXISTS "SupportAccessLog_grantId_fkey";

-- DropForeignKey
ALTER TABLE "SupportTicketMessage" DROP CONSTRAINT IF EXISTS "SupportTicketMessage_ticketId_fkey";

-- AlterTable
ALTER TABLE "BugReport" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LocationOnboarding" ADD COLUMN IF NOT EXISTS "chatMessages" JSONB;

-- AlterTable
ALTER TABLE "OrganizationOnboarding" ADD COLUMN IF NOT EXISTS "chatMessages" JSONB;

-- AlterTable
ALTER TABLE "PayrollEntry" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SupportTicket" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SurchargeRule" ALTER COLUMN "daysOfWeek" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SurchargeRuleSet" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TimesheetApproval" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CompanyModelRecord" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "model" JSONB NOT NULL,
    "generatedBy" TEXT NOT NULL DEFAULT 'ai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyModelRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LocationRuleModelRecord" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "ruleModel" JSONB NOT NULL,
    "companyModelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationRuleModelRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlanningSession" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "zeitraumVon" TEXT NOT NULL,
    "zeitraumBis" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "ruleModelSnap" JSONB NOT NULL,
    "finalPlan" JSONB,
    "finalScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PlanningSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlanningIteration" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "nummer" INTEGER NOT NULL,
    "planJson" JSONB NOT NULL,
    "bewertung" JSONB NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningIteration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlanningRuleFeedback" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "regelTyp" TEXT NOT NULL,
    "regelId" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "kommentar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningRuleFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (IF NOT EXISTS so retries are safe)
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyModelRecord_customerId_key" ON "CompanyModelRecord"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LocationRuleModelRecord_locationId_key" ON "LocationRuleModelRecord"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlanningIteration_sessionId_nummer_key" ON "PlanningIteration"("sessionId", "nummer");

-- AddForeignKey (DO blocks used so duplicate-constraint errors are silently ignored)
DO $$ BEGIN
  ALTER TABLE "PlanningIteration" ADD CONSTRAINT "PlanningIteration_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlanningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupportAccessGrant" ADD CONSTRAINT "SupportAccessGrant_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupportAccessLog" ADD CONSTRAINT "SupportAccessLog_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "SupportAccessGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
