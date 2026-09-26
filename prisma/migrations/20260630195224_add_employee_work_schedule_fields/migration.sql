-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "dailyTargetHours" DOUBLE PRECISION,
ADD COLUMN     "fixedOffDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "workDays" TEXT[] DEFAULT ARRAY[]::TEXT[];
