-- §236 Die dauerhafte Dienstvorliebe entfällt.
--
-- Gemeldet: „Ich möchte, dass diese Dienstpräferenz rausfliegt, weil ich nicht
-- möchte, dass dann auf einmal jemand dauernd Spätdienste bekommt, obwohl das
-- dann halt nicht mehr mit der Fairness kollidiert. Es gibt ja Regeln."
--
-- `shiftPreference` sagte, welche Schichtart jemand dauerhaft bevorzugt. §229
-- hatte den Wunsch erst erfüllbar gemacht — und genau das ist der Grund, warum
-- er jetzt geht: Ein Wunsch, der an JEDEM Tag gilt, verschiebt die Verteilung
-- über Monate. Wer ihn bekommt, bekommt ihn immer, und was dabei bei den
-- anderen ankommt, stand in keinem Feld.
--
-- WAS BLEIBT
-- Wünsche für EINZELNE Tage (Wunschfrei, Tageswünsche) — die konkurrieren mit
-- anderen Wünschen desselben Tages und nicht mit der Verteilung über Monate.
-- Und was den Plan wirklich bestimmt: das Regelpaket, das Tagesmuster, die
-- festen freien Tage und die Fairness über den Zeitraum.

ALTER TABLE "EmployeePlanningProfile" DROP COLUMN "shiftPreference";
