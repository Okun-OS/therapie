-- §148 Recruiting: Stellen, Karriereseite, Bewerber.
--
-- Die Karriereseite ist die erste Seite dieses Programms ohne Anmeldung.
-- Deshalb steht das Impressum in den Einstellungen und nicht in einem
-- Hinweiskasten: Ohne Anbieterkennzeichnung nach §5 DDG geht sie nicht online.
--
-- Bewerberdaten sind die einzigen Personendaten hier, die von selbst wieder
-- verschwinden muessen. `loeschenAb` ist der Haken, an dem der Aufraeumlauf
-- haengt — deshalb hat die Spalte einen eigenen Index.

CREATE TABLE "Stelle" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "locationId" TEXT,
    "titel" TEXT NOT NULL,
    "ort" TEXT,
    "plz" TEXT,
    "umfang" TEXT NOT NULL DEFAULT 'vollzeit',
    "stundenProWoche" INTEGER,
    "befristung" TEXT NOT NULL DEFAULT 'unbefristet',
    "befristetBis" TEXT,
    "beginn" TEXT,
    "beschreibung" TEXT NOT NULL DEFAULT '',
    "aufgaben" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "profil" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wirBieten" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verguetungVon" INTEGER,
    "verguetungBis" INTEGER,
    "verguetungZeit" TEXT NOT NULL DEFAULT 'monat',
    "status" TEXT NOT NULL DEFAULT 'entwurf',
    "slug" TEXT NOT NULL,
    "veroeffentlichtAm" TIMESTAMP(3),
    "geschlossenAm" TIMESTAMP(3),
    "kontaktName" TEXT,
    "kontaktEmail" TEXT,
    "erstelltVon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stelle_pkey" PRIMARY KEY ("id")
);

-- Zwei Kitas desselben Traegers duerfen dieselbe Adresse nicht belegen; ueber
-- Traeger hinweg ist sie egal, weil die Karriereseite je Betrieb eigen ist.
CREATE UNIQUE INDEX "Stelle_customerId_slug_key" ON "Stelle"("customerId", "slug");
CREATE INDEX "Stelle_customerId_status_idx" ON "Stelle"("customerId", "status");
CREATE INDEX "Stelle_locationId_idx" ON "Stelle"("locationId");

CREATE TABLE "Bewerbung" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "stelleId" TEXT,
    "stelleTitel" TEXT,
    "locationId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefon" TEXT,
    "nachricht" TEXT,
    "quelle" TEXT NOT NULL DEFAULT 'karriereseite',
    "status" TEXT NOT NULL DEFAULT 'neu',
    "statusAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gespraechAm" TIMESTAMP(3),
    "gespraechOrt" TEXT,
    "notiz" TEXT,
    "poolBis" TIMESTAMP(3),
    "employeeId" TEXT,
    "uebernommenAm" TIMESTAMP(3),
    "loeschenAb" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bewerbung_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Bewerbung_customerId_status_idx" ON "Bewerbung"("customerId", "status");
CREATE INDEX "Bewerbung_stelleId_idx" ON "Bewerbung"("stelleId");
CREATE INDEX "Bewerbung_loeschenAb_idx" ON "Bewerbung"("loeschenAb");
CREATE INDEX "Bewerbung_employeeId_idx" ON "Bewerbung"("employeeId");

CREATE TABLE "BewerbungEreignis" (
    "id" TEXT NOT NULL,
    "bewerbungId" TEXT NOT NULL,
    "art" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "vonName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BewerbungEreignis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BewerbungEreignis_bewerbungId_createdAt_idx"
    ON "BewerbungEreignis"("bewerbungId", "createdAt");

-- Die Karriereseite. Standardmaessig aus: Eine Seite, die ohne Zutun online
-- geht, ist eine Veroeffentlichung, die niemand beschlossen hat.
ALTER TABLE "OrgSettings" ADD COLUMN "karriereSlug" TEXT;
ALTER TABLE "OrgSettings" ADD COLUMN "karriereAktiv" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrgSettings" ADD COLUMN "karriereUeberschrift" TEXT;
ALTER TABLE "OrgSettings" ADD COLUMN "karriereText" TEXT;
ALTER TABLE "OrgSettings" ADD COLUMN "karriereEmail" TEXT;
ALTER TABLE "OrgSettings" ADD COLUMN "karriereImpressum" TEXT;
ALTER TABLE "OrgSettings" ADD COLUMN "karriereDatenschutz" TEXT;

CREATE UNIQUE INDEX "OrgSettings_karriereSlug_key" ON "OrgSettings"("karriereSlug");
