-- §131 Der Chat haengt am Benutzerkonto, nicht am Mitarbeiterdatensatz.
--
-- Der Fehler zeigte sich sofort im Betrieb: Standortleitung und
-- Geschaeftsfuehrung haben ein Konto, aber nicht zwingend einen
-- Mitarbeiterdatensatz. Sie bekamen deshalb den Hinweis "Dieser Zugang ist
-- keinem Mitarbeiter zugeordnet" und konnten niemanden anschreiben — genau die
-- beiden Rollen, die am meisten zu kommunizieren haben.
--
-- Die employeeId bleibt als Nebenfeld erhalten: nur darueber findet eine
-- Loeschung nach Art.17 DSGVO die Nachrichten einer Person wieder.

ALTER TABLE "ChatMitglied"  ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "ChatNachricht" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Bestehende Zeilen nachziehen: die Kennung war bisher die des Mitarbeiters.
UPDATE "ChatMitglied" m
   SET "userId" = u."id"
  FROM "User" u
 WHERE u."employeeId" = m."employeeId" AND m."userId" IS NULL;

UPDATE "ChatNachricht" n
   SET "userId" = u."id"
  FROM "User" u
 WHERE u."employeeId" = n."employeeId" AND n."userId" IS NULL;

-- Systemhinweise im Verlauf gehoeren keinem Konto.
UPDATE "ChatNachricht" SET "userId" = 'system'
 WHERE "userId" IS NULL AND "employeeId" = 'system';

-- Was sich nicht zuordnen laesst, gehoerte zu einem Mitarbeiter ohne Zugang —
-- der konnte den Chat nie oeffnen. Solche Zeilen sind unerreichbar und gehen.
DELETE FROM "ChatMitglied"  WHERE "userId" IS NULL;
DELETE FROM "ChatNachricht" WHERE "userId" IS NULL;

ALTER TABLE "ChatMitglied"  ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "ChatNachricht" ALTER COLUMN "userId" SET NOT NULL;

-- Die employeeId ist ab jetzt optional.
ALTER TABLE "ChatMitglied"  ALTER COLUMN "employeeId" DROP NOT NULL;
ALTER TABLE "ChatNachricht" ALTER COLUMN "employeeId" DROP NOT NULL;
UPDATE "ChatNachricht" SET "employeeId" = NULL WHERE "employeeId" = 'system';

-- Ein Standort ist nicht mehr Pflicht: eine Geschaeftsfuehrung sitzt an keinem.
ALTER TABLE "ChatRaum" ALTER COLUMN "locationId" DROP NOT NULL;

DROP INDEX IF EXISTS "ChatMitglied_raumId_employeeId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ChatMitglied_raumId_userId_key"
    ON "ChatMitglied"("raumId", "userId");
CREATE INDEX IF NOT EXISTS "ChatMitglied_userId_idx" ON "ChatMitglied"("userId");

-- Die Direktchat-Schluessel bestanden aus Mitarbeiterkennungen. Sie jetzt
-- umzurechnen waere Rateraetsel; die wenigen Raeume bekommen stattdessen einen
-- neuen Schluessel beim naechsten Oeffnen.
UPDATE "ChatRaum" r
   SET "schluessel" = sub."neu"
  FROM (
    SELECT m."raumId", string_agg(m."userId", '|' ORDER BY m."userId") AS "neu"
      FROM "ChatMitglied" m
     GROUP BY m."raumId"
  ) sub
 WHERE r."id" = sub."raumId" AND r."art" = 'direkt';
