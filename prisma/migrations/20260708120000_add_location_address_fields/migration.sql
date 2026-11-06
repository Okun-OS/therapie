-- Add missing address fields to Location table
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "zip"         TEXT;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "street"      TEXT;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "houseNumber" TEXT;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "country"     TEXT;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "bundesland"  TEXT;

-- Add missing avatarUrl field to Employee table
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "avatarUrl"   TEXT;
