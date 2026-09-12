-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "workDaysPerWeek" INTEGER;

-- AlterTable
ALTER TABLE "ScheduleEntry" ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "startTime" TEXT;
