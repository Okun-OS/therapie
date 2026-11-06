-- §169 Vorgeschlagene und entschiedene Massnahmen der Dienstplanung

CREATE TABLE "PlanungsMassnahme" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "typ" TEXT NOT NULL,
    "ziel" TEXT NOT NULL,
    "zielName" TEXT,
    "tag" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offen',
    "kommentar" TEXT,
    "entschiedenVon" TEXT,
    "entschiedenVonId" TEXT,
    "entschiedenAm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanungsMassnahme_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanungsMassnahme_locationId_typ_ziel_tag_key" ON "PlanungsMassnahme"("locationId", "typ", "ziel", "tag");
CREATE INDEX "PlanungsMassnahme_customerId_tag_idx" ON "PlanungsMassnahme"("customerId", "tag");
CREATE INDEX "PlanungsMassnahme_entschiedenVonId_idx" ON "PlanungsMassnahme"("entschiedenVonId");
