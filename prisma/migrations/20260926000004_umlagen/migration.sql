-- §159 Umlagen U1, U2 und Insolvenzgeld

CREATE TABLE "Krankenkassensatz" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kasse" TEXT NOT NULL,
    "u1Satz" DOUBLE PRECISION,
    "u1Erstattung" DOUBLE PRECISION,
    "u2Satz" DOUBLE PRECISION,
    "gueltigAb" TEXT NOT NULL,
    "notiz" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Krankenkassensatz_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Krankenkassensatz_customerId_kasse_key" ON "Krankenkassensatz"("customerId", "kasse");
CREATE INDEX "Krankenkassensatz_customerId_idx" ON "Krankenkassensatz"("customerId");

ALTER TABLE "PayrollEntry" ADD COLUMN "umlageU1" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "umlageU2" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEntry" ADD COLUMN "insolvenzgeldUmlage" DOUBLE PRECISION NOT NULL DEFAULT 0;
