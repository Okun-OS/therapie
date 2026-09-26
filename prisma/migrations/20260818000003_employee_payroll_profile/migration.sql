-- §102 Lohn-Stammdaten am Mitarbeiter
CREATE TABLE "EmployeePayrollProfile" (
    "employeeId" TEXT NOT NULL,
    "customerId" TEXT,
    "personalnummer" TEXT,
    "eintrittsdatum" TEXT,
    "austrittsdatum" TEXT,
    "befristetBis" TEXT,
    "probezeitBis" TEXT,
    "strasse" TEXT,
    "plz" TEXT,
    "ort" TEXT,
    "steuerId" TEXT,
    "steuerklasse" INTEGER,
    "kinderfreibetraege" DOUBLE PRECISION,
    "konfession" TEXT,
    "bundesland" TEXT,
    "sozialversicherungsnummer" TEXT,
    "versicherungsart" TEXT,
    "krankenkasse" TEXT,
    "zusatzbeitrag" DOUBLE PRECISION,
    "pkvBeitrag" DOUBLE PRECISION,
    "rentenversicherungspflichtig" BOOLEAN NOT NULL DEFAULT true,
    "schwerbehindert" BOOLEAN NOT NULL DEFAULT false,
    "lohnart" TEXT,
    "stundenlohn" DOUBLE PRECISION,
    "monatsgehalt" DOUBLE PRECISION,
    "iban" TEXT,
    "bic" TEXT,
    "kontoinhaber" TEXT,
    "notiz" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePayrollProfile_pkey" PRIMARY KEY ("employeeId")
);

CREATE INDEX "EmployeePayrollProfile_customerId_idx" ON "EmployeePayrollProfile"("customerId");
