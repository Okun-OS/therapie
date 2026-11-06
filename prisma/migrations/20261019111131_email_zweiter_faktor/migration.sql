-- AlterTable
ALTER TABLE "EmployeePlanningProfile" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShiftDemand" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SmsTotpCode" ADD COLUMN     "kanal" TEXT NOT NULL DEFAULT 'sms';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailOtpEnabled" BOOLEAN NOT NULL DEFAULT false;
