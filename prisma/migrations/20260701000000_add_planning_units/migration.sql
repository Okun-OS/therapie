-- CreateTable
CREATE TABLE "PlanningUnit" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'bereich',
    "description" TEXT,
    "capacity" INTEGER,
    "address" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanningUnit_locationId_idx" ON "PlanningUnit"("locationId");
