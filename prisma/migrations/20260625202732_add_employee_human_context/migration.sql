-- CreateTable
CREATE TABLE "EmployeeHumanContext" (
    "employeeId" TEXT NOT NULL,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lifeCircumstances" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "agreements" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeHumanContext_pkey" PRIMARY KEY ("employeeId")
);
