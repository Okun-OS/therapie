-- AddTable: PlanningPolicy
CREATE TABLE "PlanningPolicy" (
    "locationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "defaultOvertimeHandling" TEXT NOT NULL DEFAULT 'normal',
    "minAutoApproveScore" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "failFastOnInfeasible" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningPolicy_pkey" PRIMARY KEY ("locationId")
);

-- CreateIndex
CREATE INDEX "PlanningPolicy_customerId_idx" ON "PlanningPolicy"("customerId");

-- AddTable: EmployeeRequest
CREATE TABLE "EmployeeRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "date" TEXT,
    "dateFrom" TEXT,
    "dateTo" TEXT,
    "shiftId" TEXT,
    "reason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "respondedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeRequest_employeeId_idx" ON "EmployeeRequest"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeRequest_locationId_idx" ON "EmployeeRequest"("locationId");

-- CreateIndex
CREATE INDEX "EmployeeRequest_customerId_idx" ON "EmployeeRequest"("customerId");
