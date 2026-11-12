-- AdminAuditLog: tracks OKUN admin deletions and sensitive operations
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id"         TEXT NOT NULL,
  "action"     TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId"   TEXT NOT NULL,
  "entityName" TEXT,
  "actorId"    TEXT NOT NULL,
  "actorName"  TEXT,
  "details"    TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);
