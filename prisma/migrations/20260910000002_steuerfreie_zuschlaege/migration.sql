-- §115 Steuerfreie Zuschläge nach §3b EStG getrennt ausweisen.
-- Ohne diese Felder steht auf der Abrechnung nicht, welcher Teil der Zuschläge
-- steuer- und beitragsfrei war — und der Steuerberater kann es nicht prüfen.
ALTER TABLE "PayrollEntry" ADD COLUMN "steuerfreieZuschlaege" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "svfreieZuschlaege" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "steuerBrutto" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "svBrutto" DOUBLE PRECISION NOT NULL DEFAULT 0;
