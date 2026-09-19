-- §142 Stufe 3: die Spur jeder automatischen Behebung.
--
-- Man kann nicht zurueckdrehen, was man nicht sieht. Jede Aenderung, die der
-- Lauf selbst vornimmt, hinterlaesst deshalb hier einen Eintrag: welche
-- Dateien, wie viele Zeilen, was geprueft wurde, auf welchem Weg es rausging.

CREATE TABLE "Behebung" (
    "id" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "kennung" TEXT,
    "titel" TEXT NOT NULL DEFAULT '',
    "klasse" TEXT NOT NULL,
    "ausgang" TEXT NOT NULL,
    "grund" TEXT NOT NULL DEFAULT '',
    "dateien" JSONB NOT NULL,
    "zeilen" INTEGER NOT NULL DEFAULT 0,
    "begruendung" TEXT,
    "pruefstand" JSONB,
    "zweig" TEXT,
    "commit" TEXT,
    "status" TEXT NOT NULL DEFAULT 'wartet',
    "entschiedenVon" TEXT,
    "entschiedenAm" TIMESTAMP(3),
    "entscheidNotiz" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Behebung_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Behebung_fundId_idx" ON "Behebung"("fundId");
CREATE INDEX "Behebung_status_idx" ON "Behebung"("status");
