-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "bgColor" TEXT NOT NULL,
    "minStaff" INTEGER NOT NULL DEFAULT 1,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "note" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeLog" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "clockIn" TEXT NOT NULL,
    "clockOut" TEXT,
    "totalMinutes" INTEGER,
    "breakMinutes" INTEGER,
    "breakStart" TEXT,
    "note" TEXT,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VacationRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedAt" TEXT NOT NULL,
    "respondedAt" TEXT,
    "respondedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VacationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwapRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterDate" TEXT NOT NULL,
    "requesterShiftId" TEXT NOT NULL,
    "targetEmployeeId" TEXT NOT NULL,
    "targetEmployeeName" TEXT NOT NULL,
    "targetDate" TEXT NOT NULL,
    "targetShiftId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedAt" TEXT NOT NULL,
    "respondedAt" TEXT,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "SwapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishSubmission" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "preferredShiftType" TEXT NOT NULL,
    "reason" TEXT,
    "importance" TEXT NOT NULL DEFAULT 'normal',
    "submittedAt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "conflictInfo" JSONB,

    CONSTRAINT "WishSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VacationPlanPreference" (
    "employeeId" TEXT NOT NULL,
    "hasChildren" BOOLEAN NOT NULL DEFAULT false,
    "schoolHolidayPriority" TEXT,
    "preferredMonths" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "preferredPeriod" TEXT,
    "notes" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VacationPlanPreference_pkey" PRIMARY KEY ("employeeId")
);

-- CreateTable
CREATE TABLE "VacationRules" (
    "locationId" TEXT NOT NULL,
    "facilityDescription" TEXT NOT NULL,
    "maxConcurrent" INTEGER NOT NULL,
    "customRules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "schoolHolidayPriorityMode" TEXT NOT NULL DEFAULT 'none',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VacationRules_pkey" PRIMARY KEY ("locationId")
);

-- CreateTable
CREATE TABLE "TaskType" (
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskType_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "TestAccount" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "converted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TestAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "customerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TEXT NOT NULL,

    CONSTRAINT "PlatformInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportAccessLogEntry" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "grantedAt" TEXT NOT NULL,
    "revokedAt" TEXT,

    CONSTRAINT "SupportAccessLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "organizationName" TEXT NOT NULL,
    "defaultWeeklyHours" INTEGER NOT NULL,
    "defaultVacationDaysPerYear" INTEGER NOT NULL,
    "autoApproveVacationUnderDays" INTEGER NOT NULL,
    "notificationEmail" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "timeLogId" TEXT NOT NULL,
    "overtimeMinutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedMinutes" INTEGER,
    "adminComment" TEXT,
    "respondedAt" TEXT,
    "respondedBy" TEXT,
    "submittedAt" TEXT NOT NULL,

    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Absence" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "note" TEXT,
    "proofProvided" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" TEXT NOT NULL DEFAULT 'offen',
    "verifiedBy" TEXT,
    "verifiedAt" TEXT,
    "submittedAt" TEXT NOT NULL,

    CONSTRAINT "Absence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyClosing" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offen',
    "arbeitstage" INTEGER NOT NULL,
    "sollMinutes" INTEGER NOT NULL,
    "istMinutes" INTEGER NOT NULL,
    "breakMinutes" INTEGER NOT NULL,
    "overtimeMinutes" INTEGER NOT NULL,
    "undertimeMinutes" INTEGER NOT NULL,
    "vacationDays" INTEGER NOT NULL,
    "sickDays" INTEGER NOT NULL,
    "otherAbsenceDays" INTEGER NOT NULL,
    "approvalsCount" INTEGER NOT NULL,
    "comments" JSONB NOT NULL DEFAULT '[]',
    "reviewedBy" TEXT,
    "reviewedAt" TEXT,
    "releasedBy" TEXT,
    "releasedAt" TEXT,

    CONSTRAINT "MonthlyClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyClosing_employeeId_year_month_key" ON "MonthlyClosing"("employeeId", "year", "month");
