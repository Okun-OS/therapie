-- DropForeignKey
ALTER TABLE "SupportAccessGrant" DROP CONSTRAINT "SupportAccessGrant_ticketId_fkey";

-- DropForeignKey
ALTER TABLE "SupportAccessLog" DROP CONSTRAINT "SupportAccessLog_grantId_fkey";

-- DropForeignKey
ALTER TABLE "SupportTicketMessage" DROP CONSTRAINT "SupportTicketMessage_ticketId_fkey";

-- AlterTable
ALTER TABLE "BugReport" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LocationOnboarding" ADD COLUMN     "chatMessages" JSONB;

-- AlterTable
ALTER TABLE "OrganizationOnboarding" ADD COLUMN     "chatMessages" JSONB;

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
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT;

-- CreateTable
CREATE TABLE "CompanyModelRecord" (
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
CREATE TABLE "LocationRuleModelRecord" (
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
CREATE TABLE "PlanningSession" (
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
CREATE TABLE "PlanningIteration" (
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
CREATE TABLE "PlanningRuleFeedback" (
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

-- CreateIndex
CREATE UNIQUE INDEX "CompanyModelRecord_customerId_key" ON "CompanyModelRecord"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationRuleModelRecord_locationId_key" ON "LocationRuleModelRecord"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningIteration_sessionId_nummer_key" ON "PlanningIteration"("sessionId", "nummer");

-- AddForeignKey
ALTER TABLE "PlanningIteration" ADD CONSTRAINT "PlanningIteration_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlanningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAccessGrant" ADD CONSTRAINT "SupportAccessGrant_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAccessLog" ADD CONSTRAINT "SupportAccessLog_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "SupportAccessGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
