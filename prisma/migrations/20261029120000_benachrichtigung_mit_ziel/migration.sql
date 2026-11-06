-- §239 Wohin eine Benachrichtigung führt.
--
-- Die Adresse ging schon immer an die Push-Meldung, wurde aber nie gespeichert.
-- In der Glocke stand deshalb ein Text ohne Ziel.
--
-- Wahlfrei und ohne Vorgabe: Alle bestehenden Zeilen bleiben leer. Für die
-- rechnet `benachrichtigungsziel.ts` ein Ziel aus der Art aus — eine Vorgabe
-- hier einzutragen hieße, allen alten Benachrichtigungen dasselbe falsche Ziel
-- zu geben.
ALTER TABLE "Notification" ADD COLUMN "url" TEXT;
