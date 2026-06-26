-- AlterTable
ALTER TABLE "EmployeeHumanContext" ADD COLUMN     "preferredActivities" TEXT[] DEFAULT ARRAY[]::TEXT[];
