-- §152 Schutz der Anmeldung gegen Durchprobieren.
--
-- Vorher nahm die Anmeldung beliebig viele Passwortversuche entgegen, und ein
-- Fehlversuch hinterliess keine Spur. Fuer ein Programm mit Lohndaten und
-- Gesundheitsdaten nach Art. 9 DSGVO ist das die Luecke, die man zuerst
-- zumacht: Art. 32 Abs. 1 DSGVO verlangt Massnahmen, die dem Risiko angemessen
-- sind, und ein unbegrenzter Rateversuch ist keine.
--
-- Gezaehlt wird je Konto UND je Absenderadresse. Ein Zaehler allein reicht bei
-- keinem der beiden Angriffe: Wer zehn Versuche auf vierhundert Konten
-- verteilt, bleibt unter jeder Kontogrenze; wer aus einem Botnetz kommt, hat
-- fuer jeden Versuch eine neue Adresse.

CREATE TABLE "Anmeldeversuch" (
    "id" TEXT NOT NULL,
    "art" TEXT NOT NULL,
    "kennung" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anmeldeversuch_pkey" PRIMARY KEY ("id")
);

-- Der Index, auf dem die Zaehlung bei jeder Anmeldung laeuft.
CREATE INDEX "Anmeldeversuch_art_kennung_createdAt_idx"
    ON "Anmeldeversuch"("art", "kennung", "createdAt");
-- Und der, auf dem das Aufraeumen laeuft.
CREATE INDEX "Anmeldeversuch_createdAt_idx" ON "Anmeldeversuch"("createdAt");
