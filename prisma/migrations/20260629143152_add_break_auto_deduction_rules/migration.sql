-- AlterTable
ALTER TABLE "LocationPlanningRules" ADD COLUMN     "autoBreakDeduction" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "breakDeductionMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "breakRulesExtractedAt" TIMESTAMP(3),
ADD COLUMN     "breakThresholdMinutes" INTEGER NOT NULL DEFAULT 360;
