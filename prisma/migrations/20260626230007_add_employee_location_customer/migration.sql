-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "adminId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "locationId" TEXT,
    "weeklyHours" DOUBLE PRECISION NOT NULL,
    "position" TEXT NOT NULL,
    "hoursBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vacationDaysTotal" INTEGER NOT NULL DEFAULT 30,
    "vacationDaysUsed" INTEGER NOT NULL DEFAULT 0,
    "preferences" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TEXT NOT NULL,
    "hasChildren" BOOLEAN,
    "phone" TEXT,
    "birthDate" TEXT,
    "roleType" TEXT,
    "employmentType" TEXT,
    "gruppe" TEXT,
    "bereich" TEXT,
    "multiGroupCapable" BOOLEAN,
    "fixedLocations" TEXT,
    "qualifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedTasks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "seatsLicensed" INTEGER NOT NULL,
    "seatsUsed" INTEGER NOT NULL DEFAULT 0,
    "locationsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TEXT NOT NULL,
    "renewalDate" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
