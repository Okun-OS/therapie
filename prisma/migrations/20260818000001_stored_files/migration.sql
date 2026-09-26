-- §100 Dateiablage: Fundament fuer Personalakte, Krankenscheine, Lohnbelege
-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "locationId" TEXT,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kategorie" TEXT NOT NULL DEFAULT 'sonstiges',
    "dateiname" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "groesse" INTEGER NOT NULL,
    "treiber" TEXT NOT NULL DEFAULT 'db',
    "inhalt" BYTEA,
    "objektSchluessel" TEXT,
    "sichtbarFuerMitarbeiter" BOOLEAN NOT NULL DEFAULT false,
    "hochgeladenVon" TEXT NOT NULL,
    "hochgeladenVonName" TEXT,
    "notiz" TEXT,
    "gueltigVon" TEXT,
    "gueltigBis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoredFile_ownerType_ownerId_idx" ON "StoredFile"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "StoredFile_customerId_idx" ON "StoredFile"("customerId");

-- CreateIndex
CREATE INDEX "StoredFile_locationId_idx" ON "StoredFile"("locationId");
