-- §156 Betriebliche Altersvorsorge — Entgeltumwandlung nach §1a BetrAVG.
--
-- Der Fehler, den fast jede selbstgebaute Abrechnung macht: „acht Prozent sind
-- frei". Das ist zur Haelfte richtig. Steuerfrei sind Beitraege bis 8 % der
-- Beitragsbemessungsgrenze (§3 Nr. 63 EStG), BEITRAGSFREI aber nur bis 4 %
-- (§1 Abs. 1 Satz 1 Nr. 9 SvEV). Dazwischen liegt ein Bereich, in dem der
-- Beitrag steuerfrei ist und trotzdem verbeitragt wird.
--
-- Deshalb drei Zahlen an der Abrechnung und nicht eine.

CREATE TABLE "BavVertrag" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "weg" TEXT NOT NULL DEFAULT 'direktversicherung',
    "anbieter" TEXT NOT NULL,
    "vertragsnummer" TEXT,
    "monatsbetrag" DOUBLE PRECISION NOT NULL,
    "zuschussSatz" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "zuschussAufGesamt" BOOLEAN NOT NULL DEFAULT false,
    "beginn" TEXT NOT NULL,
    "ende" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "notiz" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BavVertrag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BavVertrag_employeeId_aktiv_idx" ON "BavVertrag"("employeeId", "aktiv");
CREATE INDEX "BavVertrag_customerId_idx" ON "BavVertrag"("customerId");

ALTER TABLE "PayrollEntry" ADD COLUMN "bavUmwandlung" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "bavMinderungSteuer" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "bavMinderungSv" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "bavZuschussAG" DOUBLE PRECISION NOT NULL DEFAULT 0;
