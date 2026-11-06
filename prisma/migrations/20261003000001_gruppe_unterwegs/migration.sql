-- §182 „Diese Gruppe ist unterwegs" — vor der Planung sagbar.
--
-- Bisher gab es dafür nur die Maßnahme „aufteilen", und die entsteht erst,
-- NACHDEM der Rechendienst gemeldet hat, dass er eine Gruppe nicht besetzen
-- kann. Eine Leitung, die schon weiß, dass Gruppe 3 nächste Woche auf Fahrt
-- ist, konnte es ihm nicht sagen.
--
-- Drei neue, leere Spalten. Kein Bestand wird angefasst: Ohne Zeitraum ändert
-- sich für jeden heute planenden Betrieb nichts.
ALTER TABLE "PlanningUnit" ADD COLUMN "unterwegsVon" TEXT;
ALTER TABLE "PlanningUnit" ADD COLUMN "unterwegsBis" TEXT;
ALTER TABLE "PlanningUnit" ADD COLUMN "unterwegsGrund" TEXT;
