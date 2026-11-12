-- §233 Ein Dienst kann Tätigkeiten verlangen.
--
-- Bis hierher stand die Kette still: `/admin/tasks` legte Tätigkeiten an und
-- ordnete sie Menschen zu, `Employee.allowedTasks` wurde geschrieben — und der
-- Rechendienst bekam eine leere Liste, deren Feld er ohnehin nie las. Eine
-- Seite zum Zuordnen, eine Anzeige für das Ergebnis, und zwischen beiden
-- nichts.
--
-- Mit dieser Spalte kann ein Dienst sagen, was er verlangt. Wer eine davon
-- nicht darf, bekommt ihn nicht — dieselbe Form wie bei den Qualifikationen.
--
-- WARUM DIE VOREINSTELLUNG LEER IST
-- Eine leere Liste heißt „verlangt nichts" und schränkt niemanden ein. Jeder
-- bestehende Standort plant damit unverändert weiter. Die Umkehrung — ein
-- Dienst verlangt im Zweifel alles — hätte jedem Betrieb, der die Seite nie
-- benutzt hat, über Nacht den Plan genommen.

ALTER TABLE "Shift" ADD COLUMN "requiredTasks" TEXT[] DEFAULT ARRAY[]::TEXT[];
