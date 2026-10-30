-- §232 Zwei Schattenfelder im „Persönlichen" entfallen.
--
-- In `EmployeeHumanContext` standen `preferredGroups` („bevorzugte Gruppen")
-- und `shiftPreferences` („Schicht-Vorlieben", Freitext). Beide gab es ein
-- zweites Mal an einer Stelle, die den Dienstplan wirklich ändert:
--
--   Gruppe   → `Employee.gruppe` / `bereich` / `multiGroupCapable`
--   Schicht  → `EmployeePlanningProfile.shiftPreference`
--
-- §229 hat gezeigt, was ein Schattenfeld kostet: Dort zeigte die Vorliebe auf
-- einen Dienst, den die Person nicht haben darf, und der Wunsch war jeden Tag
-- rot, ohne dass irgendwo stand warum. Hier ist es schlimmer: Wer „lieber
-- Frühdienst" in das freiwillige Feld schrieb, hatte es gesagt und nichts
-- erreicht — und die Maske versprach ihm, es helfe der Planung.
--
-- WAS MIT DEN DATEN GESCHIEHT
-- Die beiden Spalten werden gelöscht. Es sind Freitextangaben, die kein
-- Rechenkern gelesen hat; in die planenden Felder lassen sie sich nicht
-- übertragen, weil „lieber Frühdienst" nicht sagt, welcher der drei
-- Frühdienste gemeint ist. Stärken, Lebenssituation, bevorzugte Tätigkeiten
-- und die Absprachen bleiben: Die hält kein anderes Feld.

ALTER TABLE "EmployeeHumanContext" DROP COLUMN "preferredGroups";
ALTER TABLE "EmployeeHumanContext" DROP COLUMN "shiftPreferences";
