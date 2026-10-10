-- §175 Der Katalog der Umlagesaetze je Kasse, Stufe und Stichtag.
CREATE TABLE "UmlageKatalog" (
    "id" TEXT NOT NULL,
    "kasse" TEXT NOT NULL,
    "u1Erstattung" DOUBLE PRECISION NOT NULL,
    "u1Satz" DOUBLE PRECISION NOT NULL,
    "u2Satz" DOUBLE PRECISION,
    "gueltigAb" TEXT NOT NULL,
    "quelle" TEXT,
    "geprueft" BOOLEAN NOT NULL DEFAULT false,
    "notiz" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UmlageKatalog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UmlageKatalog_kasse_u1Erstattung_gueltigAb_key"
    ON "UmlageKatalog"("kasse", "u1Erstattung", "gueltigAb");
CREATE INDEX "UmlageKatalog_kasse_idx" ON "UmlageKatalog"("kasse");

-- §175 Die Wahl des Kunden bekommt einen Zeitverlauf. Wer zum 1. Januar die
-- Erstattungsstufe wechselt, muss den Dezember trotzdem nachrechnen koennen.
-- Aufweiten ist gefahrlos: Jede bestehende Zeile bleibt eindeutig.
DROP INDEX IF EXISTS "Krankenkassensatz_customerId_kasse_key";
CREATE UNIQUE INDEX "Krankenkassensatz_customerId_kasse_gueltigAb_key"
    ON "Krankenkassensatz"("customerId", "kasse", "gueltigAb");
