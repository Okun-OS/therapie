-- §181 Das Tagesmuster zieht aus dem Regelpaket in die Stammdaten.
--
-- Nur eine neue, leere Spalte. Kein Bestand wird angefasst: Wer kein Muster
-- hat, bekommt NULL, und NULL heißt weiterhin „der Rechendienst verteilt die
-- Stunden wie bisher". Damit ist die Wanderung der Kita-Muster aus dem Paket
-- in die Profile ein getrennter, umkehrbarer Schritt — und kein Betrieb, der
-- heute plant, merkt von dieser Migration etwas.
ALTER TABLE "EmployeePlanningProfile" ADD COLUMN "tagesmuster" JSONB;
