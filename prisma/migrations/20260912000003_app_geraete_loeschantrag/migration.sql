-- §139 Native Huelle: Geraete fuer echte Push-Nachrichten, und der Antrag auf
-- Loeschung, den Apple in der App verlangt (Richtlinie 5.1.1 v) und Art. 17
-- DSGVO ohnehin.

CREATE TABLE "Geraet" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kennung" TEXT NOT NULL,
    "plattform" TEXT NOT NULL,
    "erstelltAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "zuletztAm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Geraet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Geraet_kennung_key" ON "Geraet"("kennung");
CREATE INDEX "Geraet_employeeId_idx" ON "Geraet"("employeeId");

CREATE TABLE "Loeschantrag" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "customerId" TEXT,
    "personName" TEXT NOT NULL,
    "begruendung" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offen',
    "antwort" TEXT,
    "bearbeitetVon" TEXT,
    "bearbeitetAm" TIMESTAMP(3),
    "loeschungId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loeschantrag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Loeschantrag_employeeId_idx" ON "Loeschantrag"("employeeId");
CREATE INDEX "Loeschantrag_customerId_idx" ON "Loeschantrag"("customerId");
CREATE INDEX "Loeschantrag_status_idx" ON "Loeschantrag"("status");
