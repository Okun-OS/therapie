/*
  Warnings:

  - You are about to drop the column `dateiId` on the `Zahllauf` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Zahllauf" DROP COLUMN "dateiId",
ADD COLUMN     "datei" BYTEA;
