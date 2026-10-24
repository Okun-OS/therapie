-- §116 Nach welchem Stand eine Abrechnung gerechnet wurde.
-- Wer eine alte Abrechnung prüft, muss ohne Rückfrage sehen, welche
-- Rechengrößen und welcher Programmablaufplan gegolten haben.
ALTER TABLE "PayrollEntry" ADD COLUMN "grundlage" TEXT;
