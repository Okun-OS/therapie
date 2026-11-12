-- Add legalContractDate and legalContractNotes to Customer
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "legalContractDate" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "legalContractNotes" TEXT;

-- Create AuditLog table (DSGVO-focused event log)
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "customerId" TEXT,
    "details" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
