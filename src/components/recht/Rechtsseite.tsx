import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'

/**
 * §153 Der Rahmen für Impressum und Datenschutzerklärung.
 *
 * WARUM OHNE ANMELDUNG
 * Ein Impressum muss „leicht erkennbar, unmittelbar erreichbar und ständig
 * verfügbar" sein (§5 DDG). Hinter einer Anmeldung ist es keines von dreien.
 *
 * WARUM DIE LÜCKEN OBEN STEHEN
 * Solange Pflichtangaben fehlen, sieht das jeder — auch derjenige, der die
 * Seite freigeschaltet hat. Ein Impressum, das seine eigene Unvollständigkeit
 * verschweigt, wiegt in falscher Sicherheit; genau dafür werden Abmahnungen
 * geschrieben.
 */
export function Rechtsseite({ titel, untertitel, fehlt, children }: {
  titel: string
  untertitel?: string
  fehlt?: string[]
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-5 py-8 sm:py-12">
        <Link href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500
                     font-medium print:hidden">
          <ArrowLeft size={15} /> Zur Anmeldung
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold text-navy mt-4 text-balance">
          {titel}
        </h1>
        {untertitel && (
          <p className="text-sm text-gray-500 mt-1.5">{untertitel}</p>
        )}

        {fehlt && fehlt.length > 0 && (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5
                          print:hidden">
            <p className="flex items-center gap-2 font-bold text-amber-900">
              <AlertTriangle size={16} />
              Diese Seite ist noch nicht vollständig
            </p>
            <p className="text-sm text-amber-800 mt-1.5">
              Solange diese Angaben fehlen, genügt die Seite ihrer gesetzlichen
              Pflicht nicht. Sie werden über Umgebungsvariablen gesetzt.
            </p>
            <ul className="mt-3 space-y-1.5">
              {fehlt.map((f, i) => (
                <li key={i} className="text-sm text-amber-900 flex gap-2">
                  <span>•</span><span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 space-y-8">{children}</div>

        <footer className="mt-12 pt-6 border-t border-gray-200 flex flex-wrap
                           gap-4 text-sm print:hidden">
          <Link href="/impressum" className="text-gray-500 font-medium">
            Impressum
          </Link>
          <Link href="/datenschutz" className="text-gray-500 font-medium">
            Datenschutz
          </Link>
        </footer>
      </div>
    </div>
  )
}

/** Eine Zeile „Bezeichnung — Wert", die Fehlendes als Fehlendes zeigt. */
export function Angabe({ k, w }: { k: string; w: string | null }) {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <dt className="text-gray-400 w-48 shrink-0">{k}</dt>
      <dd className={w ? 'text-gray-700 whitespace-pre-line' : 'text-amber-700 italic'}>
        {w ?? 'noch nicht hinterlegt'}
      </dd>
    </div>
  )
}
