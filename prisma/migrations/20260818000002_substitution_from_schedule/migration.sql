-- §101 Vertretung entsteht aus einem ausgefallenen Dienst im Plan
ALTER TABLE "SubstitutionRequest" ADD COLUMN "scheduleEntryId" TEXT;
ALTER TABLE "SubstitutionRequest" ADD COLUMN "originalEmployeeId" TEXT;
ALTER TABLE "SubstitutionRequest" ADD COLUMN "shiftId" TEXT;
ALTER TABLE "SubstitutionRequest" ADD COLUMN "grund" TEXT;
