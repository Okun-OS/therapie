-- §120 Einmalzahlungen (sonstige Bezüge).
--
-- Weihnachtsgeld, Urlaubsgeld, Prämien und Abfindungen werden anders besteuert
-- als laufender Lohn: nach der Jahreslohnsteuer-Methode (§39b Abs.3 EStG). In
-- der Sozialversicherung gilt die anteilige Jahres-Beitragsbemessungsgrenze
-- statt der monatlichen. Bisher gab es sie gar nicht — wer Weihnachtsgeld
-- gezahlt hat, konnte es nur als erhöhtes Monatsgehalt eintragen, und dann
-- stimmte weder die Steuer noch der Beitrag.
CREATE TABLE "PayrollBonus" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT,
    "customerId" TEXT NOT NULL,
    "locationId" TEXT,
    "jahr" INTEGER NOT NULL,
    "monat" INTEGER NOT NULL,
    "art" TEXT NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "betrag" DOUBLE PRECISION NOT NULL,
    "beitragsfrei" BOOLEAN NOT NULL DEFAULT false,
    "notiz" TEXT,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "erstelltVon" TEXT,
    CONSTRAINT "PayrollBonus_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PayrollBonus_customerId_jahr_monat_idx" ON "PayrollBonus"("customerId", "jahr", "monat");
CREATE INDEX "PayrollBonus_employeeId_jahr_idx" ON "PayrollBonus"("employeeId", "jahr");

-- Getrennt ausgewiesen, weil getrennt berechnet — und weil der Steuerberater
-- sie getrennt braucht.
ALTER TABLE "PayrollEntry" ADD COLUMN "sonstigeBezuege" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "lohnsteuerSonstige" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "kirchensteuerSonstige" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "soliSonstige" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "svANSonstige" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "svAGSonstige" DOUBLE PRECISION NOT NULL DEFAULT 0;
