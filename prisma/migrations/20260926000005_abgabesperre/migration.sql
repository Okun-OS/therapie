-- §166 Eine Gruppe in der Eingewoehnung gibt niemanden ab
ALTER TABLE "PlanningUnit" ADD COLUMN "abgabeGesperrtBis" TEXT;
ALTER TABLE "PlanningUnit" ADD COLUMN "abgabeGrund" TEXT;
