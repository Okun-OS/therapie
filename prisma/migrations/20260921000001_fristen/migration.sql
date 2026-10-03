-- §146 Der Fristenmotor: Katalog je Kunde, Stand je Person.
--
-- Erste Hilfe, Hygienebelehrung, Fuehrungszeugnis, Masernnachweis,
-- Probezeitende, auslaufende Befristung — ein Datum laeuft ab, und jemand muss
-- es vorher wissen. Ein Motor, beliebig viele Eintraege.

CREATE TABLE "Nachweisart" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gattung" TEXT NOT NULL DEFAULT 'nachweis',
    "giltFuer" TEXT NOT NULL DEFAULT 'alle',
    "giltFuerWerte" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "faelligkeit" TEXT NOT NULL DEFAULT 'wiederkehrend',
    "abstandMonate" INTEGER,
    "vorwarnTage" INTEGER NOT NULL DEFAULT 56,
    "nachweisNoetig" BOOLEAN NOT NULL DEFAULT true,
    "sichtbarkeit" TEXT NOT NULL DEFAULT 'leitung',
    "folge" TEXT NOT NULL DEFAULT 'warnen',
    "grundlage" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "reihenfolge" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nachweisart_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Nachweisart_customerId_idx" ON "Nachweisart"("customerId");

CREATE TABLE "Frist" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "nachweisartId" TEXT,
    "bezeichnung" TEXT NOT NULL,
    "gattung" TEXT NOT NULL DEFAULT 'nachweis',
    "erfuelltAm" TIMESTAMP(3),
    "faelligAm" TIMESTAMP(3),
    "befreitAm" TIMESTAMP(3),
    "befreitGrund" TEXT,
    "dateiId" TEXT,
    "notiz" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Frist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Frist_employeeId_nachweisartId_key" ON "Frist"("employeeId", "nachweisartId");
CREATE INDEX "Frist_employeeId_idx" ON "Frist"("employeeId");
CREATE INDEX "Frist_customerId_faelligAm_idx" ON "Frist"("customerId", "faelligAm");
