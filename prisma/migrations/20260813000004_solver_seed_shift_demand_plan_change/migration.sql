-- §44: store solver seed in PlanningSession for deterministic replay
ALTER TABLE "PlanningSession" ADD COLUMN IF NOT EXISTS "solverSeed" INTEGER;

-- §31: ShiftDemand — configurable per-shift staffing requirements
CREATE TABLE IF NOT EXISTS "ShiftDemand" (
  "id"         TEXT         NOT NULL PRIMARY KEY,
  "locationId" TEXT         NOT NULL,
  "shiftId"    TEXT         NOT NULL,
  "date"       TEXT,
  "dayOfWeek"  INTEGER,
  "minStaff"   INTEGER      NOT NULL DEFAULT 1,
  "maxStaff"   INTEGER,
  "note"       TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ShiftDemand_locationId_idx" ON "ShiftDemand"("locationId");

-- §62: PlanChange — dispatcher learning: track manual edits to surfaced patterns
CREATE TABLE IF NOT EXISTS "PlanChange" (
  "id"          TEXT         NOT NULL PRIMARY KEY,
  "locationId"  TEXT         NOT NULL,
  "customerId"  TEXT         NOT NULL,
  "sessionId"   TEXT,
  "employeeId"  TEXT         NOT NULL,
  "date"        TEXT         NOT NULL,
  "oldShiftId"  TEXT,
  "newShiftId"  TEXT,
  "changeType"  TEXT         NOT NULL,
  "changedBy"   TEXT         NOT NULL,
  "reason"      TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PlanChange_locationId_idx" ON "PlanChange"("locationId");
CREATE INDEX IF NOT EXISTS "PlanChange_employeeId_idx" ON "PlanChange"("employeeId");
