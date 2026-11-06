-- §171 Wochenstunden, die im Dienstplan belegt werden (leer = Vertragsstunden)
ALTER TABLE "EmployeePlanningProfile" ADD COLUMN "planungsStundenSoll" DOUBLE PRECISION;
