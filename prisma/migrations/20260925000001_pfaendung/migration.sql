-- §155 Lohnpfaendung (§§850 ff. ZPO).
--
-- Mehrere Pfaendungen koennen gleichzeitig laufen, und die Reihenfolge zaehlt:
-- die aeltere geht vor (§804 Abs. 3 ZPO), Unterhalt steht noch davor
-- (§850d ZPO). Deshalb eine eigene Tabelle und kein Feld am Mitarbeiter.
--
-- Der einbehaltene Betrag mindert den AUSZAHLUNGSBETRAG, nicht das Netto:
-- Steuerlich und sozialversicherungsrechtlich ist das Geld verdient, es geht
-- nur an jemand anderen.

CREATE TABLE "Pfaendung" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "art" TEXT NOT NULL DEFAULT 'normal',
    "glaeubiger" TEXT NOT NULL,
    "aktenzeichen" TEXT,
    "zugestelltAm" TEXT NOT NULL,
    "forderung" DOUBLE PRECISION,
    "getilgt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notwendigerUnterhalt" DOUBLE PRECISION,
    "unterhaltspflichten" INTEGER,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "erledigtAm" TIMESTAMP(3),
    "notiz" TEXT,
    "angelegtVon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pfaendung_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Pfaendung_employeeId_aktiv_idx" ON "Pfaendung"("employeeId", "aktiv");
CREATE INDEX "Pfaendung_customerId_idx" ON "Pfaendung"("customerId");

CREATE TABLE "PfaendungsAbzug" (
    "id" TEXT NOT NULL,
    "pfaendungId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "jahr" INTEGER NOT NULL,
    "monat" INTEGER NOT NULL,
    "betrag" DOUBLE PRECISION NOT NULL,
    "glaeubiger" TEXT NOT NULL,
    "hinweis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PfaendungsAbzug_pkey" PRIMARY KEY ("id")
);

-- Je Pfaendung und Monat genau eine Zeile. Ohne diese Eindeutigkeit entstuende
-- beim zweiten Lauf der Abrechnung ein doppelter Abzug.
CREATE UNIQUE INDEX "PfaendungsAbzug_pfaendungId_jahr_monat_key"
    ON "PfaendungsAbzug"("pfaendungId", "jahr", "monat");
CREATE INDEX "PfaendungsAbzug_employeeId_jahr_monat_idx"
    ON "PfaendungsAbzug"("employeeId", "jahr", "monat");

ALTER TABLE "PayrollEntry" ADD COLUMN "pfaendungBetrag" DOUBLE PRECISION NOT NULL DEFAULT 0;
