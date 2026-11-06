-- §126/§127 Regelpaket und Freischaltung der Dienstplanung je Standort.
--
-- Das Geschäftsmodell steht in PRODUKT-NOTIZEN.md: Alles außer der
-- Dienstplanung ist Standard und läuft sofort. Die Dienstplanung wird für
-- jeden Kunden von Hand programmiert — als versioniertes Regelpaket im
-- Rechendienst, nicht als KI-erzeugter Schnipsel in einer Datenbankzeile.
--
-- Bis das Paket steht, bleibt die Dienstplanung gesperrt. Ein Kunde, der
-- ungebaute Dienstplanung ausprobiert, bekommt einen schlechten Plan und ein
-- falsches Bild vom Produkt — genau das ist im August passiert.
--
-- Bestehende Standorte werden NICHT automatisch gesperrt: sie arbeiten heute
-- damit, und ein stiller Entzug wäre schlimmer als die fehlende Sperre.
-- Neue Standorte starten gesperrt.
ALTER TABLE "Location" ADD COLUMN "rulePackId" TEXT;
ALTER TABLE "Location" ADD COLUMN "dienstplanungFrei" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Location" ADD COLUMN "dienstplanungFreiSeit" TEXT;
ALTER TABLE "Location" ADD COLUMN "dienstplanungFreiVon" TEXT;
ALTER TABLE "Location" ADD COLUMN "dienstplanungHinweis" TEXT;

-- Was heute läuft, läuft weiter.
UPDATE "Location" SET "dienstplanungFrei" = true;
