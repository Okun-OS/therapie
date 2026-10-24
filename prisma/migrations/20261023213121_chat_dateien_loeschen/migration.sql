-- AlterTable
ALTER TABLE "ChatMitglied" ADD COLUMN     "ausgeblendetAb" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ChatNachricht" ADD COLUMN     "dateiId" TEXT;

-- CreateTable
CREATE TABLE "ChatVerborgen" (
    "id" TEXT NOT NULL,
    "nachrichtId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatVerborgen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatVerborgen_userId_idx" ON "ChatVerborgen"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatVerborgen_nachrichtId_userId_key" ON "ChatVerborgen"("nachrichtId", "userId");

-- AddForeignKey
ALTER TABLE "ChatVerborgen" ADD CONSTRAINT "ChatVerborgen_nachrichtId_fkey" FOREIGN KEY ("nachrichtId") REFERENCES "ChatNachricht"("id") ON DELETE CASCADE ON UPDATE CASCADE;
