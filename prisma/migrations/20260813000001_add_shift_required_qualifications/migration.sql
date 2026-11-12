-- Add requiredQualifications to Shift model
ALTER TABLE "Shift" ADD COLUMN "requiredQualifications" TEXT[] NOT NULL DEFAULT '{}';
