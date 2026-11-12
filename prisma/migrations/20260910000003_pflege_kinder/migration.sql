-- §116 Angaben für die Pflegeversicherung.
-- Zwei verschiedene Dinge, die gern verwechselt werden: der Zuschlag für
-- Kinderlose entfällt dauerhaft mit dem ersten Kind, auch wenn es längst
-- erwachsen ist. Die Beitragsabschläge gibt es nur für Kinder unter 25 und
-- erst ab dem zweiten. Aus der Zahl der Kinderfreibeträge lässt sich weder
-- das eine noch das andere ableiten.
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN "hatKinder" BOOLEAN;
ALTER TABLE "EmployeePayrollProfile" ADD COLUMN "kinderUnter25" INTEGER;
