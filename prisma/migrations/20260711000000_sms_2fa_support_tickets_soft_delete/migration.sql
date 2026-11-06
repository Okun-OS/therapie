-- Customer soft delete
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- User SMS 2FA fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone"          TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerified"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "smsOtpEnabled"  BOOLEAN NOT NULL DEFAULT false;

-- SMS OTP codes (hashed, never plaintext)
CREATE TABLE IF NOT EXISTS "SmsTotpCode" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "codeHash"  TEXT         NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "attempts"  INTEGER      NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsTotpCode_pkey" PRIMARY KEY ("id")
);

-- Support tickets
CREATE TABLE IF NOT EXISTS "SupportTicket" (
    "id"            TEXT         NOT NULL,
    "ticketId"      TEXT         NOT NULL,
    "status"        TEXT         NOT NULL DEFAULT 'new',
    "priority"      TEXT         NOT NULL DEFAULT 'normal',
    "category"      TEXT,
    "userId"        TEXT,
    "userName"      TEXT,
    "userRole"      TEXT,
    "customerId"    TEXT,
    "customerName"  TEXT,
    "locationId"    TEXT,
    "locationName"  TEXT,
    "currentPage"   TEXT,
    "title"         TEXT         NOT NULL,
    "description"   TEXT,
    "browser"       TEXT,
    "os"            TEXT,
    "screenSize"    TEXT,
    "consoleErrors" TEXT,
    "lastActions"   TEXT,
    "adminNotes"    TEXT,
    "assignedTo"    TEXT,
    "resolvedAt"    TIMESTAMP(3),
    "closedAt"      TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SupportTicket_ticketId_key" ON "SupportTicket"("ticketId");

-- Support ticket messages
CREATE TABLE IF NOT EXISTS "SupportTicketMessage" (
    "id"         TEXT         NOT NULL,
    "ticketId"   TEXT         NOT NULL,
    "authorId"   TEXT,
    "authorName" TEXT         NOT NULL,
    "authorRole" TEXT         NOT NULL,
    "body"       TEXT         NOT NULL,
    "internal"   BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE
);

-- Support access grants (time-limited, scope-limited, per-ticket)
CREATE TABLE IF NOT EXISTS "SupportAccessGrant" (
    "id"         TEXT         NOT NULL,
    "ticketId"   TEXT         NOT NULL,
    "customerId" TEXT         NOT NULL,
    "grantedBy"  TEXT         NOT NULL,
    "grantedTo"  TEXT,
    "scope"      TEXT         NOT NULL DEFAULT 'readonly',
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "revokedAt"  TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportAccessGrant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupportAccessGrant_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE
);

-- Audit log for every action taken under a support access grant
CREATE TABLE IF NOT EXISTS "SupportAccessLog" (
    "id"        TEXT         NOT NULL,
    "grantId"   TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "action"    TEXT         NOT NULL,
    "resource"  TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportAccessLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupportAccessLog_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "SupportAccessGrant"("id") ON DELETE CASCADE
);
