-- BugReport: integrated bug reporting system
CREATE TABLE IF NOT EXISTS "BugReport" (
    "id"             TEXT NOT NULL,
    "ticketId"       TEXT NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'open',
    "priority"       TEXT NOT NULL DEFAULT 'normal',
    "severity"       TEXT NOT NULL DEFAULT 'normal',
    "userId"         TEXT,
    "userName"       TEXT,
    "userRole"       TEXT,
    "customerId"     TEXT,
    "customerName"   TEXT,
    "title"          TEXT NOT NULL DEFAULT '',
    "description"    TEXT,
    "page"           TEXT,
    "browser"        TEXT,
    "os"             TEXT,
    "screenSize"     TEXT,
    "consoleErrors"  TEXT,
    "lastActions"    TEXT,
    "adminNotes"     TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BugReport_ticketId_key" ON "BugReport"("ticketId");

-- TimesheetApproval: employer approval of monthly time records
CREATE TABLE IF NOT EXISTS "TimesheetApproval" (
    "id"               TEXT NOT NULL,
    "employeeId"       TEXT NOT NULL,
    "employeeName"     TEXT,
    "locationId"       TEXT,
    "year"             INTEGER NOT NULL,
    "month"            INTEGER NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'pending',
    "approvedBy"       TEXT,
    "approvedAt"       TEXT,
    "rejectionReason"  TEXT,
    "notes"            TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimesheetApproval_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TimesheetApproval_employeeId_year_month_key" ON "TimesheetApproval"("employeeId","year","month");

-- PayrollEntry: monthly payroll calculation per employee
CREATE TABLE IF NOT EXISTS "PayrollEntry" (
    "id"              TEXT NOT NULL,
    "employeeId"      TEXT NOT NULL,
    "employeeName"    TEXT,
    "locationId"      TEXT,
    "customerId"      TEXT NOT NULL,
    "year"            INTEGER NOT NULL,
    "month"           INTEGER NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'draft',
    -- Wage
    "hourlyWage"      DOUBLE PRECISION,
    "monthlyWage"     DOUBLE PRECISION,
    -- Labour hours
    "regularHours"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimeHours"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nightHours"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sundayHours"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "holidayHours"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saturdayHours"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vacationDays"    INTEGER NOT NULL DEFAULT 0,
    "sickDays"        INTEGER NOT NULL DEFAULT 0,
    -- Tax & insurance
    "taxClass"        INTEGER NOT NULL DEFAULT 1,
    "childCount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "insuranceType"   TEXT NOT NULL DEFAULT 'GKV',
    "pkv"             DOUBLE PRECISION,
    "churchTax"       BOOLEAN NOT NULL DEFAULT false,
    "bundesland"      TEXT,
    -- Calculated results
    "brutto"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "surchargesTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lohnsteuer"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kirchensteuer"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "soli"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rvAN"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kvAN"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pvAN"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avAN"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netto"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rvAG"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kvAG"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pvAG"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avAG"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAgCost"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    -- Meta
    "approvedBy"      TEXT,
    "approvedAt"      TEXT,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollEntry_employeeId_year_month_key" ON "PayrollEntry"("employeeId","year","month");
