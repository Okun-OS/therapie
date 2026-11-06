-- §149 Nachweise anfordern — mit Rueckweg.
--
-- Eine Aufforderung, etwas einzureichen, ist ein Vorgang und keine Nachricht:
-- Sie hat einen Zustand, sie steht bei jemandem offen, und sie endet mit einer
-- Abnahme. Der Beitrag daneben traegt das Gespraech dazu — Rueckfrage und
-- Antwort liegen am Vorgang, nicht in einem Chat zwischen zwei Menschen, von
-- denen einer in einem Jahr nicht mehr im Haus ist.

CREATE TABLE "Anforderung" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "locationId" TEXT,
    "fristId" TEXT,
    "nachweisartId" TEXT,
    "titel" TEXT NOT NULL,
    "hinweis" TEXT,
    "fristBis" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'offen',
    "statusAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "angefordertVon" TEXT,
    "angefordertVonName" TEXT,
    "eingereichtAm" TIMESTAMP(3),
    "erledigtAm" TIMESTAMP(3),
    "erledigtVon" TEXT,
    "erinnertAm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Anforderung_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Anforderung_customerId_status_idx" ON "Anforderung"("customerId", "status");
CREATE INDEX "Anforderung_employeeId_status_idx" ON "Anforderung"("employeeId", "status");
CREATE INDEX "Anforderung_fristId_idx" ON "Anforderung"("fristId");

CREATE TABLE "AnforderungBeitrag" (
    "id" TEXT NOT NULL,
    "anforderungId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seite" TEXT NOT NULL,
    "absenderName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "dateiId" TEXT,
    "dateiname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnforderungBeitrag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnforderungBeitrag_anforderungId_createdAt_idx"
    ON "AnforderungBeitrag"("anforderungId", "createdAt");
