-- §130 Krankenschein und Fehlzeit verbinden.
--
-- Rein additiv: eine Spalte. Bestehende Dateien bleiben ohne Zuordnung (NULL),
-- sie lassen sich nachtraeglich von Hand verknuepfen.

ALTER TABLE "StoredFile" ADD COLUMN IF NOT EXISTS "absenceId" TEXT;

CREATE INDEX IF NOT EXISTS "StoredFile_absenceId_idx" ON "StoredFile"("absenceId");

-- Ab welchem Kalendertag der Betrieb die Bescheinigung verlangt (§5 Abs.1
-- Satz 3 EntgFG). Leer = die gesetzlichen vier Tage.
ALTER TABLE "OrgSettings" ADD COLUMN IF NOT EXISTS "auNachweisAbTag" INTEGER;
