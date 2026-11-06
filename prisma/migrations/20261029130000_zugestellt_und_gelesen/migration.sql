-- §240 Zugestellt und gelesen auseinanderhalten.
--
-- `gelesenBis` wurde bisher im Zehn-Sekunden-Takt hochgesetzt, sobald ein
-- Gespräch irgendwo offen lag. Das ist Zustellung, nicht Lesen — und es hat
-- dazu geführt, dass sich Nachrichten nicht mehr zurückziehen ließen mit der
-- Begründung, sie seien gelesen.
--
-- WAS MIT DEM BESTEHENDEN STAND PASSIERT
-- Er wird als ZUSTELLUNG übernommen: Was auf dem Gerät war, war es auch.
--
-- Als gelesen bleibt er AUCH stehen, und das ist eine bewusste Abwägung gegen
-- die reine Lehre. Rückwirkend lässt sich nicht feststellen, wer wirklich
-- hingesehen hat; sauber wäre also, `gelesenBis` zu leeren. Dann stünde aber
-- bei jedem Menschen jedes alte Gespräch wieder auf ungelesen — Hunderte
-- falscher Abzeichen für ein Problem, das von morgen an nicht mehr auftritt.
-- Die Korrektur wirkt deshalb ab jetzt, nicht rückwirkend.
ALTER TABLE "ChatMitglied" ADD COLUMN "zugestelltBis" TIMESTAMP(3);
UPDATE "ChatMitglied" SET "zugestelltBis" = "gelesenBis" WHERE "gelesenBis" IS NOT NULL;
