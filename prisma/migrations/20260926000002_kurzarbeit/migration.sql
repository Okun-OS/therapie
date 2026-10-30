-- §157 Kurzarbeitergeld

CREATE TABLE "Kurzarbeit" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "locationId" TEXT,
    "bezeichnung" TEXT NOT NULL,
    "grund" TEXT NOT NULL DEFAULT 'wirtschaftlich',
    "angezeigtAm" TEXT NOT NULL,
    "aktenzeichen" TEXT,
    "von" TEXT NOT NULL,
    "bis" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "notiz" TEXT,
    "angelegtVon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kurzarbeit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Kurzarbeit_customerId_aktiv_idx" ON "Kurzarbeit"("customerId", "aktiv");

CREATE TABLE "KurzarbeitMonat" (
    "id" TEXT NOT NULL,
    "kurzarbeitId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "jahr" INTEGER NOT NULL,
    "monat" INTEGER NOT NULL,
    "sollStunden" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "istStunden" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sollEntgelt" DOUBLE PRECISION NOT NULL,
    "istEntgelt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kugAusTabelle" DOUBLE PRECISION,
    "nettoSoll" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nettoIst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leistungssatz" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "kug" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fiktivEntgelt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "svAgFiktiv" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hinweis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KurzarbeitMonat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KurzarbeitMonat_employeeId_jahr_monat_key" ON "KurzarbeitMonat"("employeeId", "jahr", "monat");
CREATE INDEX "KurzarbeitMonat_kurzarbeitId_idx" ON "KurzarbeitMonat"("kurzarbeitId");
CREATE INDEX "KurzarbeitMonat_customerId_jahr_monat_idx" ON "KurzarbeitMonat"("customerId", "jahr", "monat");

ALTER TABLE "PayrollEntry" ADD COLUMN "kugBetrag" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "kugFiktivEntgelt" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "kugSvAG" DOUBLE PRECISION NOT NULL DEFAULT 0;
