-- CreateTable: Bereich (organizational grouping Company → Bereich → Location)
CREATE TABLE "Bereich" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bereich_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bereich_customerId_idx" ON "Bereich"("customerId");

-- AlterTable: Location — add optional bereichId
ALTER TABLE "Location" ADD COLUMN "bereichId" TEXT;

-- AlterTable: User — add bereichIds for Bereichsleiter scoping
ALTER TABLE "User" ADD COLUMN "bereichIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
