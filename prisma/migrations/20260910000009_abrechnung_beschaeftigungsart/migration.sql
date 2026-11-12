-- §121 Welche Beschäftigungsart einer Abrechnung tatsächlich zugrunde lag.
--
-- Wichtig für den Nachweis: der Übergangsbereich ergibt sich aus dem Entgelt,
-- nicht aus einer Vereinbarung. Wer später prüft, warum die Beiträge so
-- ausgefallen sind, muss sehen können, welche Regeln gegolten haben.
ALTER TABLE "PayrollEntry" ADD COLUMN "beschaeftigungsart" TEXT NOT NULL DEFAULT 'regulaer';
ALTER TABLE "PayrollEntry" ADD COLUMN "pauschsteuerAG" DOUBLE PRECISION NOT NULL DEFAULT 0;
