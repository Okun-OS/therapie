-- §147 Betriebliches Eingliederungsmanagement (§167 Abs. 2 SGB IX).
--
-- Die Schwelle rechnet das System aus den Fehlzeiten, die ohnehin schon da
-- sind. Dieser Eintrag haelt fest, was daraufhin geschah — niemals eine
-- Diagnose, nur das Verfahren.

CREATE TABLE "BemVorgang" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tageBeiAusloesung" INTEGER NOT NULL DEFAULT 0,
    "ausgeloestAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "angebotenAm" TIMESTAMP(3),
    "angebotenVon" TEXT,
    "antwort" TEXT NOT NULL DEFAULT 'offen',
    "antwortAm" TIMESTAMP(3),
    "ergebnis" TEXT,
    "abgeschlossenAm" TIMESTAMP(3),
    "abgeschlossenVon" TEXT,
    "notiz" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BemVorgang_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BemVorgang_employeeId_idx" ON "BemVorgang"("employeeId");
CREATE INDEX "BemVorgang_customerId_idx" ON "BemVorgang"("customerId");

-- Standardmaessig sieht die Standortleitung BEM NICHT: Gesundheitsdaten nach
-- Art. 9 DSGVO, der Kreis der Mitwissenden gehoert klein.
ALTER TABLE "OrgSettings" ADD COLUMN "bemSichtbarLeitung" BOOLEAN NOT NULL DEFAULT false;
