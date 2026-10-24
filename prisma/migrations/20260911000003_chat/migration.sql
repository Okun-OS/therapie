-- §129 Nachrichten zwischen Mitarbeitern.
--
-- Rein additiv: drei neue Tabellen, an bestehenden Daten aendert sich nichts.

CREATE TABLE IF NOT EXISTS "ChatRaum" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "art" TEXT NOT NULL,
    "name" TEXT,
    "beschreibung" TEXT,
    "schluessel" TEXT,
    "erstelltVon" TEXT,
    "archiviertAm" TIMESTAMP(3),
    "letzteAktivitaet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRaum_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChatRaum_schluessel_key" ON "ChatRaum"("schluessel");
CREATE INDEX IF NOT EXISTS "ChatRaum_customerId_idx" ON "ChatRaum"("customerId");
CREATE INDEX IF NOT EXISTS "ChatRaum_locationId_art_idx" ON "ChatRaum"("locationId", "art");

CREATE TABLE IF NOT EXISTS "ChatMitglied" (
    "id" TEXT NOT NULL,
    "raumId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "rolle" TEXT NOT NULL DEFAULT 'mitglied',
    "gelesenBis" TIMESTAMP(3),
    "beigetretenAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMitglied_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChatMitglied_raumId_employeeId_key" ON "ChatMitglied"("raumId", "employeeId");
CREATE INDEX IF NOT EXISTS "ChatMitglied_employeeId_idx" ON "ChatMitglied"("employeeId");

CREATE TABLE IF NOT EXISTS "ChatNachricht" (
    "id" TEXT NOT NULL,
    "raumId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "absenderName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "art" TEXT NOT NULL DEFAULT 'text',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatNachricht_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChatNachricht_raumId_createdAt_idx" ON "ChatNachricht"("raumId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatNachricht_employeeId_idx" ON "ChatNachricht"("employeeId");

-- Wird ein Raum geloescht, gehen Mitglieder und Nachrichten mit. Sonst bliebe
-- ein Verlauf ohne Raum liegen — unerreichbar, aber gespeichert.
ALTER TABLE "ChatMitglied" DROP CONSTRAINT IF EXISTS "ChatMitglied_raumId_fkey";
ALTER TABLE "ChatMitglied" ADD CONSTRAINT "ChatMitglied_raumId_fkey"
  FOREIGN KEY ("raumId") REFERENCES "ChatRaum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatNachricht" DROP CONSTRAINT IF EXISTS "ChatNachricht_raumId_fkey";
ALTER TABLE "ChatNachricht" ADD CONSTRAINT "ChatNachricht_raumId_fkey"
  FOREIGN KEY ("raumId") REFERENCES "ChatRaum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
