-- Multi-tenancy retrofit: every tenant-owned row gets a real customerId.
--
-- Backfill policy (defensive, must not guess across ambiguous tenants):
--   * If exactly ONE Customer row exists, all existing unscoped rows are
--     assigned to that customer (the only safe, non-guessing assignment).
--   * If zero or multiple Customer rows exist, existing rows are left
--     unscoped (NULL) rather than risk attributing one tenant's data to
--     another tenant. Unscoped rows are invisible under the new fail-closed
--     tenant scoping and require manual reconciliation.
--   * OrganizationOnboarding/OrgSettings move from a fixed 'singleton' PK to
--     a per-customer customerId PK. Since a PK cannot be NULL, any existing
--     singleton row that cannot be safely attributed (multiple/zero
--     customers) is dropped rather than guessed at. This intentionally
--     removes the exact cross-tenant leak this migration exists to fix.

-- AlterTable: Location
ALTER TABLE "Location" ADD COLUMN "customerId" TEXT;

-- AlterTable: Employee
ALTER TABLE "Employee" ADD COLUMN "customerId" TEXT;

-- AlterTable: User
ALTER TABLE "User" ADD COLUMN "customerId" TEXT;

-- AlterTable: InvitationToken
ALTER TABLE "InvitationToken" ADD COLUMN "customerId" TEXT;

-- Backfill Location/Employee/User/InvitationToken only when unambiguous
DO $$
DECLARE
  customer_count INTEGER;
  sole_customer_id TEXT;
BEGIN
  SELECT COUNT(*) INTO customer_count FROM "Customer";

  IF customer_count = 1 THEN
    SELECT "id" INTO sole_customer_id FROM "Customer" LIMIT 1;

    UPDATE "Location" SET "customerId" = sole_customer_id WHERE "customerId" IS NULL;
    UPDATE "Employee" SET "customerId" = sole_customer_id WHERE "customerId" IS NULL;
    UPDATE "User" SET "customerId" = sole_customer_id WHERE "customerId" IS NULL;
    UPDATE "InvitationToken" SET "customerId" = sole_customer_id WHERE "customerId" IS NULL;
  END IF;
END $$;

-- AlterTable: OrganizationOnboarding (singleton id -> per-customer customerId PK)
ALTER TABLE "OrganizationOnboarding" ADD COLUMN "customerId" TEXT;

DO $$
DECLARE
  customer_count INTEGER;
  sole_customer_id TEXT;
BEGIN
  SELECT COUNT(*) INTO customer_count FROM "Customer";

  IF customer_count = 1 THEN
    SELECT "id" INTO sole_customer_id FROM "Customer" LIMIT 1;
    UPDATE "OrganizationOnboarding" SET "customerId" = sole_customer_id WHERE "id" = 'singleton';
  END IF;

  -- Any row that still has no customerId cannot be safely attributed; drop it
  -- rather than leave a row whose PK would be NULL.
  DELETE FROM "OrganizationOnboarding" WHERE "customerId" IS NULL;
END $$;

ALTER TABLE "OrganizationOnboarding" DROP CONSTRAINT "OrganizationOnboarding_pkey";
ALTER TABLE "OrganizationOnboarding" DROP COLUMN "id";
ALTER TABLE "OrganizationOnboarding" ALTER COLUMN "customerId" SET NOT NULL;
ALTER TABLE "OrganizationOnboarding" ADD CONSTRAINT "OrganizationOnboarding_pkey" PRIMARY KEY ("customerId");

-- AlterTable: OrgSettings (singleton id -> per-customer customerId PK)
ALTER TABLE "OrgSettings" ADD COLUMN "customerId" TEXT;

DO $$
DECLARE
  customer_count INTEGER;
  sole_customer_id TEXT;
BEGIN
  SELECT COUNT(*) INTO customer_count FROM "Customer";

  IF customer_count = 1 THEN
    SELECT "id" INTO sole_customer_id FROM "Customer" LIMIT 1;
    UPDATE "OrgSettings" SET "customerId" = sole_customer_id WHERE "id" = 'singleton';
  END IF;

  DELETE FROM "OrgSettings" WHERE "customerId" IS NULL;
END $$;

ALTER TABLE "OrgSettings" DROP CONSTRAINT "OrgSettings_pkey";
ALTER TABLE "OrgSettings" DROP COLUMN "id";
ALTER TABLE "OrgSettings" ALTER COLUMN "customerId" SET NOT NULL;
ALTER TABLE "OrgSettings" ADD CONSTRAINT "OrgSettings_pkey" PRIMARY KEY ("customerId");
