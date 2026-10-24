ALTER TABLE "PlanningSession"
  ADD COLUMN "freigabeEmpfehlung" TEXT,
  ADD COLUMN "bewertungSnap"      JSONB,
  ADD COLUMN "solverDiagnosis"    TEXT;
