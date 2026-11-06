-- §128 Loeschkonzept: Sperre nach Art.18 DSGVO und Nachweis der Loeschung.
--
-- Beides ist additiv. Bestehende Mitarbeiter bleiben ungesperrt (NULL), es
-- aendert sich fuer sie nichts.

ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "datenGesperrtAm" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "datenGesperrtGrund" TEXT;

CREATE TABLE IF NOT EXISTS "Loeschvorgang" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "customerId" TEXT,
    "personName" TEXT NOT NULL,
    "art" TEXT NOT NULL DEFAULT 'loeschung',
    "angestossenVon" TEXT NOT NULL,
    "angestossenVonName" TEXT,
    "bericht" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loeschvorgang_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Loeschvorgang_employeeId_idx" ON "Loeschvorgang"("employeeId");
CREATE INDEX IF NOT EXISTS "Loeschvorgang_customerId_idx" ON "Loeschvorgang"("customerId");
