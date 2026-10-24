-- §231 Die Urlaubswünsche entfallen, eine Antragsfrist kommt dazu.
--
-- Gefragt wurde: „Ist es doppelt gemoppelt, wenn wir Urlaubsanträge haben und
-- dann Wünsche für den Urlaub?" Der Befund war schärfer als die Frage. In
-- `VacationPlanPreference` standen bevorzugte MONATE und eine von der Person
-- selbst gesetzte Wichtigkeit. Sagen drei Leute „Juli", weiß die Leitung
-- nicht, ob sie kollidieren — und genau das zu sehen ist der Zweck der
-- Jahresplanung. Eine Selbsteinschätzung taugt zudem nicht als Rangfolge bei
-- Streit.
--
-- WAS MIT DEN DATEN GESCHIEHT
-- Die Tabelle wird gelöscht. Darin standen unverbindliche Monatsangaben für
-- eine Planung, die es in dieser Form nicht mehr gibt; sie lassen sich in
-- keinen Antrag übersetzen, weil ihnen das Datum fehlt. Die verbindlichen
-- Angaben — die Urlaubsanträge — liegen in `VacationRequest` und bleiben
-- unberührt.
--
-- Die Frist ersetzt sie: Die Leitung sagt „bis zum 30.11. einreichen", und was
-- bis dahin da ist, wird gemeinsam geplant, statt dass der schnellste Antrag
-- den besten Zeitraum bekommt.

ALTER TABLE "VacationRules" ADD COLUMN "antragsfrist" TEXT;
ALTER TABLE "VacationRules" ADD COLUMN "antragsfristJahr" INTEGER;

DROP TABLE "VacationPlanPreference";
