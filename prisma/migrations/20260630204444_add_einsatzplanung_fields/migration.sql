-- AlterTable
ALTER TABLE "LocationOnboarding" ADD COLUMN     "tagesablauf" TEXT;

-- AlterTable
ALTER TABLE "ScheduleEntry" ADD COLUMN     "funktion" TEXT,
ADD COLUMN     "gruppe" TEXT,
ADD COLUMN     "isSubstitution" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "substitutionFor" TEXT,
ADD COLUMN     "taskBlocks" JSONB;
