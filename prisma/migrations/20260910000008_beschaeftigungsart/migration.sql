-- §121 Beschäftigungsart am Lohnprofil.
--
-- In Kita und Reha sind geringfügig Beschäftigte der Normalfall. Bisher hat das
-- Programm bei kleinen Beträgen nur gewarnt und ansonsten wie bei einem
-- regulären Arbeitsverhältnis gerechnet — also falsch in beide Richtungen: dem
-- Minijobber wurden Beiträge abgezogen, die er nicht schuldet, und der
-- Arbeitgeber zahlte nicht die Pauschalen, die er schuldet.
--
-- Der Übergangsbereich steht bewusst NICHT in dieser Spalte: er ist keine
-- Vereinbarung, sondern folgt aus dem Entgelt (§20 Abs.2a SGB IV).
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN "beschaeftigungsart" TEXT;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN "rvBefreiung" BOOLEAN;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN "pauschalsteuer" BOOLEAN;
