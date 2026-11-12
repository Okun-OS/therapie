-- §158 Mehrfachbeschaeftigung (§22 Abs. 2 SGB IV)
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN "weiteresEntgelt" DOUBLE PRECISION;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN "weitererArbeitgeber" TEXT;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN "nebenbeschaeftigung" BOOLEAN;
