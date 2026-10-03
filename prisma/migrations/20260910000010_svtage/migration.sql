-- §122 SV-Tage an der Abrechnung.
--
-- Wer mitten im Monat kommt oder geht, bekommt anteiliges Gehalt, und die
-- Beitragsbemessungsgrenzen gelten nur anteilig. Der Anteil gehört an den
-- Eintrag: sonst kann später niemand nachvollziehen, warum die Beträge so
-- ausgefallen sind.
ALTER TABLE "PayrollEntry" ADD COLUMN "svTage" INTEGER NOT NULL DEFAULT 30;
