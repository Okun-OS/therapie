-- §133 Aus dem Fehlermelder wird die Fundstelle.
--
-- Rein additiv. Bestehende Meldungen bleiben, wie sie sind: Art "fehler",
-- Bereich "sonstiges", Meldequalitaet "gelb" — was der Wahrheit entspricht,
-- denn sie wurden ohne die neuen Fragen erfasst.

ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "art"            TEXT NOT NULL DEFAULT 'fehler';
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "bereich"        TEXT NOT NULL DEFAULT 'sonstiges';
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "ebene"          TEXT;
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "schritte"       TEXT;
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "erwartet"       TEXT;
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "haeufigkeit"    TEXT;
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "heikel"         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "version"        TEXT;
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "meldeQualitaet" TEXT NOT NULL DEFAULT 'gelb';
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "freigabe"       TEXT;
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "freigabeVon"    TEXT;
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "freigabeAm"     TIMESTAMP(3);
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "freigabeNotiz"  TEXT;
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "rueckfrage"     TEXT;
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "antwort"        TEXT;
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "vorschlag"      TEXT;
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "erledigtAm"     TIMESTAMP(3);
ALTER TABLE "BugReport" ADD COLUMN IF NOT EXISTS "erledigtNotiz"  TEXT;

CREATE INDEX IF NOT EXISTS "BugReport_status_idx"      ON "BugReport"("status");
CREATE INDEX IF NOT EXISTS "BugReport_art_bereich_idx" ON "BugReport"("art", "bereich");
