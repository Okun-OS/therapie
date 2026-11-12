-- CreateTable
CREATE TABLE "CustomConstraint" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomConstraint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomConstraint_locationId_idx" ON "CustomConstraint"("locationId");

-- CreateIndex
CREATE INDEX "CustomConstraint_customerId_idx" ON "CustomConstraint"("customerId");
