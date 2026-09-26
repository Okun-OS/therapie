-- §119 Rückwirkende Aufrollung.
--
-- Wenn sich für einen bereits freigegebenen Monat nachträglich etwas ändert
-- (nachgereichter Krankenschein, korrigierte Zeit, rückwirkende ELStAM-Änderung,
-- Gehaltserhöhung ab einem vergangenen Datum), muss dieser Monat neu gerechnet
-- und die Differenz ausgeglichen werden. Bisher wurde ein freigegebener Monat
-- schlicht nicht mehr angefasst — die Abrechnung blieb dauerhaft falsch.
--
-- Lohnsteuer und Sozialversicherung folgen dabei verschiedenen Prinzipien:
-- die Steuer dem Zufluss (Differenz wird im Auszahlungsmonat versteuert),
-- die Beiträge beim laufenden Entgelt dem Entstehen (sie gehören in den
-- Ursprungsmonat). Deshalb hält der Datensatz beide Monate fest.
CREATE TABLE "PayrollCorrection" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT,
    "customerId" TEXT NOT NULL,
    "locationId" TEXT,
    "jahr" INTEGER NOT NULL,
    "monat" INTEGER NOT NULL,
    "ausgleichJahr" INTEGER NOT NULL,
    "ausgleichMonat" INTEGER NOT NULL,
    "grund" TEXT NOT NULL,
    "werteAlt" JSONB NOT NULL,
    "werteNeu" JSONB NOT NULL,
    "differenzBrutto" DOUBLE PRECISION NOT NULL,
    "differenzNetto" DOUBLE PRECISION NOT NULL,
    "differenzLohnsteuer" DOUBLE PRECISION NOT NULL,
    "differenzSvAN" DOUBLE PRECISION NOT NULL,
    "differenzSvAG" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offen',
    "ausgeglichenIn" TEXT,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "erstelltVon" TEXT,
    CONSTRAINT "PayrollCorrection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PayrollCorrection_customerId_ausgleichJahr_ausgleichMonat_idx"
  ON "PayrollCorrection"("customerId", "ausgleichJahr", "ausgleichMonat");
CREATE INDEX "PayrollCorrection_employeeId_jahr_monat_idx"
  ON "PayrollCorrection"("employeeId", "jahr", "monat");

-- Was wirklich überwiesen wird: Netto plus offene Korrekturen. SEPA, DATEV und
-- der Beleg lesen dieses eine Feld, damit sie nicht auseinanderlaufen können.
ALTER TABLE "PayrollEntry" ADD COLUMN "korrekturNetto" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "auszahlungsbetrag" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Bestehende Abrechnungen: Auszahlung entspricht dem Netto.
UPDATE "PayrollEntry" SET "auszahlungsbetrag" = "netto";
