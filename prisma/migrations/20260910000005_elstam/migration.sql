-- §117 ELStAM-Stand am Lohnprofil.
--
-- Die Lohnsteuer rechnen wir seit §116 amtlich exakt — aber exakt gerechnet mit
-- einem veralteten Merkmal ist trotzdem falsch, und dafür haftet der
-- Arbeitgeber (§42d EStG). Wer heiratet und dessen Steuerklasse bei uns nicht
-- nachgeführt wird, zahlt bei 3.400 EUR brutto rund 286 EUR im Monat zu viel
-- oder zu wenig. Deshalb steht jetzt an jedem Profil, von wann sein Stand ist.
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN "elstamStand" TEXT;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN "elstamQuelle" TEXT;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN "elstamBestaetigtVon" TEXT;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN "freibetragMonat" DOUBLE PRECISION;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN "hinzurechnungMonat" DOUBLE PRECISION;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN "faktor" DOUBLE PRECISION;
