-- AlterTable
ALTER TABLE "PayrollEntry" ADD COLUMN     "zahllaufId" TEXT;

-- CreateTable
CREATE TABLE "Zahllauf" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "locationId" TEXT,
    "jahr" INTEGER NOT NULL,
    "monat" INTEGER NOT NULL,
    "kennung" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'erzeugt',
    "statusAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anzahl" INTEGER NOT NULL,
    "summe" DOUBLE PRECISION NOT NULL,
    "ausfuehrung" TEXT NOT NULL,
    "dateiId" TEXT,
    "erzeugtVon" TEXT NOT NULL,
    "erzeugtVonName" TEXT,
    "notiz" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zahllauf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Zahllauf_customerId_jahr_monat_idx" ON "Zahllauf"("customerId", "jahr", "monat");

-- CreateIndex
CREATE UNIQUE INDEX "Zahllauf_customerId_kennung_key" ON "Zahllauf"("customerId", "kennung");

-- CreateIndex
CREATE INDEX "PayrollEntry_zahllaufId_idx" ON "PayrollEntry"("zahllaufId");
