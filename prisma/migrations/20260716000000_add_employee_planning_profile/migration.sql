-- CreateTable
CREATE TABLE IF NOT EXISTS "EmployeePlanningProfile" (
    "employeeId"         TEXT        NOT NULL,
    "shiftPreference"    TEXT        NOT NULL DEFAULT 'keine',
    "childPickupTimes"   JSONB       NOT NULL DEFAULT '[]',
    "maxConsecutiveDays" INTEGER     NOT NULL DEFAULT 0,
    "weekendRule"        TEXT,
    "planningNote"       TEXT,
    "surchargeMode"      TEXT        NOT NULL DEFAULT 'unternehmensregel',
    "surchargeOverrides" JSONB,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeePlanningProfile_pkey" PRIMARY KEY ("employeeId")
);
