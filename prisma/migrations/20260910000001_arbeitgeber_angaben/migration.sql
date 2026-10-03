-- §113 Angaben des Arbeitgebers fuer Entgeltabrechnung, SEPA und DATEV
ALTER TABLE "OrgSettings" ADD COLUMN "strasse" TEXT;
ALTER TABLE "OrgSettings" ADD COLUMN "plz" TEXT;
ALTER TABLE "OrgSettings" ADD COLUMN "ort" TEXT;
ALTER TABLE "OrgSettings" ADD COLUMN "betriebsnummer" TEXT;
ALTER TABLE "OrgSettings" ADD COLUMN "steuernummer" TEXT;
ALTER TABLE "OrgSettings" ADD COLUMN "iban" TEXT;
ALTER TABLE "OrgSettings" ADD COLUMN "bic" TEXT;
ALTER TABLE "OrgSettings" ADD COLUMN "kontoinhaber" TEXT;
ALTER TABLE "OrgSettings" ADD COLUMN "datevBeraternummer" TEXT;
ALTER TABLE "OrgSettings" ADD COLUMN "datevMandantennummer" TEXT;
