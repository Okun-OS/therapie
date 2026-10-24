import Link from 'next/link'
import { Compass } from 'lucide-react'

/**
 * §234 Die Seite für eine Adresse, die es nicht gibt.
 *
 * WARUM ES SIE GEBEN MUSS
 * Ohne sie zeigt Next.js seine eigene Vorlage: eine weiße Seite mit
 * „404 — This page could not be found." Auf Englisch, ohne Logo, ohne Weg
 * zurück. Für ein Programm, das sonst durchgehend Deutsch spricht, ist das ein
 * Bruch mitten im Betrieb — und wer dort landet, weiß nicht, ob er sich
 * vertippt hat oder ob das Programm kaputt ist.
 *
 * Gefunden nicht durch eine Meldung, sondern durch die GEGENPROBE einer
 * anderen Prüfung: `alle-seiten-ohne-fehler.mjs` ruft bewusst eine Seite auf,
 * die es nicht gibt, um sicher zu sein, dass sie einen Fehler überhaupt
 * erkennen kann. Im Protokoll stand dann der englische Satz.
 *
 * WARUM SIE NICHT VON „SCHIEFGELAUFEN" SPRICHT
 * Eine falsche Adresse ist keine Panne. `error.tsx` daneben ist für den Fall,
 * dass etwas abgestürzt ist — hier ist nur nichts da, und der Satz soll das
 * sagen, ohne jemanden zu beunruhigen.
 */
export default function NichtGefunden() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <Compass size={28} className="text-gray-500" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Diese Seite gibt es nicht</h1>
        <p className="mt-2 text-sm text-gray-500">
          Die Adresse führt ins Leere — vielleicht ein Tippfehler oder ein alter
          Link. Mit deinem Zugang kommst du von der Startseite aus überall hin,
          wo du hingehörst.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-navy px-4 py-2.5
                       text-sm font-semibold text-brand transition-opacity hover:opacity-90"
          >
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  )
}
