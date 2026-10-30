-- §177 Anfragen von der Website.
--
-- Sie werden zuerst abgelegt und dann verschickt: Eine E-Mail kann im Spam
-- landen oder beim Versand scheitern, und eine Anfrage, die niemand
-- beantwortet, weil sie nie ankam, ist ein verlorener Kunde, von dem man
-- nicht einmal weiss.

CREATE TABLE "Kontaktanfrage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "einrichtung" TEXT,
    "telefon" TEXT,
    "nachricht" TEXT NOT NULL,
    "zugestellt" BOOLEAN NOT NULL DEFAULT false,
    "fehler" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Kontaktanfrage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Kontaktanfrage_createdAt_idx" ON "Kontaktanfrage"("createdAt");
