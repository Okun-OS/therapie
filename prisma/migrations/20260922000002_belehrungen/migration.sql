-- §150 Belehrungen digital.
--
-- In einer Kita liegen jeden Monat vier, fuenf Seiten Belehrungen zur
-- Unterschrift. Sie werden an jede Einrichtung geschickt, ausgedruckt,
-- herumgereicht, eingesammelt und abgeheftet — und drei Wochen spaeter weiss
-- niemand mehr, wer fehlt.
--
-- Der Beleg traegt Kopien und keine Verweise: Name, Wortlaut und Fingerabdruck
-- des Dokuments aus dem Zeitpunkt des Klicks. Ein Beleg, der auf die heutige
-- Fassung verweist, belegt nichts.

CREATE TABLE "Belehrung" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "titel" TEXT NOT NULL,
    "beschreibung" TEXT,
    "dateiId" TEXT,
    "dateiname" TEXT,
    "pruefsumme" TEXT,
    "bestaetigungstext" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'entwurf',
    "fristBis" TIMESTAMP(3),
    "wiederholung" TEXT,
    "vorlageVon" TEXT,
    "oeffnenNoetig" BOOLEAN NOT NULL DEFAULT true,
    "verteiltAm" TIMESTAMP(3),
    "geschlossenAm" TIMESTAMP(3),
    "erstelltVon" TEXT,
    "erstelltVonName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Belehrung_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Belehrung_customerId_status_idx" ON "Belehrung"("customerId", "status");

CREATE TABLE "BelehrungBestaetigung" (
    "id" TEXT NOT NULL,
    "belehrungId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "locationId" TEXT,
    "personName" TEXT NOT NULL,
    "wortlaut" TEXT,
    "pruefsumme" TEXT,
    "zugestelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "angesehenAm" TIMESTAMP(3),
    "bestaetigtAm" TIMESTAMP(3),
    "geraet" TEXT,
    "erinnertAm" TIMESTAMP(3),

    CONSTRAINT "BelehrungBestaetigung_pkey" PRIMARY KEY ("id")
);

-- Eine Person bestaetigt dieselbe Runde genau einmal. Ohne diese Eindeutigkeit
-- entstuenden bei zwei schnellen Klicks zwei Belege mit verschiedenen Zeiten —
-- und dann ist keiner mehr etwas wert.
CREATE UNIQUE INDEX "BelehrungBestaetigung_belehrungId_employeeId_key"
    ON "BelehrungBestaetigung"("belehrungId", "employeeId");
CREATE INDEX "BelehrungBestaetigung_employeeId_bestaetigtAm_idx"
    ON "BelehrungBestaetigung"("employeeId", "bestaetigtAm");
CREATE INDEX "BelehrungBestaetigung_customerId_idx"
    ON "BelehrungBestaetigung"("customerId");
