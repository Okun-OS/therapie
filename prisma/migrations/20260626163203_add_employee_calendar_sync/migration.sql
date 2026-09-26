-- CreateTable
CREATE TABLE "EmployeeCalendarSync" (
    "employeeId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCalendarSync_pkey" PRIMARY KEY ("employeeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeCalendarSync_token_key" ON "EmployeeCalendarSync"("token");
