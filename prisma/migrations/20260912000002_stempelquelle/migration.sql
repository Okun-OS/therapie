-- §137 Woher ein Zeiteintrag stammt.
--
-- Rein additiv. Bestehende Eintraege bleiben ohne Angabe (NULL) — das ist
-- ehrlich: Fuer sie wurde nicht festgehalten, wie sie entstanden sind.

ALTER TABLE "TimeLog" ADD COLUMN IF NOT EXISTS "quelle" TEXT;
