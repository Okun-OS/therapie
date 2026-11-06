import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MapPin, Clock, CalendarDays, Banknote } from 'lucide-react'
import { karriereSeite } from '@/lib/karriere'
import { UMFAENGE, verguetungText } from '@/lib/recruiting'
import { KarriereFuss } from '@/components/karriere/KarriereFuss'

export const dynamic = 'force-dynamic'

/**
 * §148 Die Karriereseite eines Betriebs — ohne Anmeldung erreichbar.
 *
 * WARUM SIE NICHT AUSSIEHT WIE DER REST DES PROGRAMMS
 * Weil sie kein Programm ist, sondern eine Werbeseite. Wer hier landet,
 * kommt aus einer Google-Suche und entscheidet in zehn Sekunden, ob er
 * weiterliest. Eine Seitenleiste mit Dienstplan-Menüpunkten wäre an dieser
 * Stelle nur verwirrend.
 *
 * WARUM SIE ABSICHTLICH SCHLICHT IST
 * Der Betrieb hat meist schon eine Webseite mit eigenem Aussehen. Diese Seite
 * soll dort nicht konkurrieren, sondern das erledigen, was die eigene Seite
 * fast nie kann: aktuelle Stellen zeigen, von Google gefunden werden und eine
 * Bewerbung entgegennehmen, die im System landet statt in einem Postfach.
 */

interface Props { params: { kunde: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const seite = await karriereSeite(params.kunde)
  if (!seite) return { title: 'Nicht gefunden' }
  return {
    title: `Stellenangebote · ${seite.betrieb}`,
    description: seite.text?.slice(0, 160)
      ?? `Offene Stellen bei ${seite.betrieb}.`,
    // Die Übersicht soll gefunden werden; die einzelnen Anzeigen tragen ihre
    // strukturierten Daten selbst.
    robots: { index: true, follow: true },
  }
}

export default async function Karriere({ params }: Props) {
  const seite = await karriereSeite(params.kunde)
  if (!seite) notFound()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-navy text-white">
        <div className="max-w-3xl mx-auto px-5 py-12 sm:py-16">
          <p className="text-xs uppercase tracking-widest text-white/50">
            {seite.betrieb}
          </p>
          <h1 className="text-2xl sm:text-4xl font-bold mt-2 text-balance">
            {seite.ueberschrift}
          </h1>
          {seite.text && (
            <p className="mt-4 text-white/75 leading-relaxed whitespace-pre-line max-w-2xl">
              {seite.text}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 sm:py-10">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {seite.stellen.length === 0 ? 'Offene Stellen'
            : seite.stellen.length === 1 ? 'Eine offene Stelle'
              : `${seite.stellen.length} offene Stellen`}
        </h2>

        {seite.stellen.length === 0 ? (
          <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-6">
            <p className="text-gray-600">
              Zurzeit ist nichts ausgeschrieben. Eine Initiativbewerbung ist
              trotzdem willkommen — schreib uns einfach.
            </p>
            <Link
              href={`/karriere/${params.kunde}/initiativ`}
              className="inline-block mt-4 bg-teal-600 text-white text-sm font-semibold
                         px-5 py-2.5 rounded-xl">
              Initiativ bewerben
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {seite.stellen.map(s => (
              <li key={s.id}>
                <Link
                  href={`/karriere/${params.kunde}/${s.slug}`}
                  className="block bg-white border border-gray-200 rounded-2xl p-5
                             hover:border-teal-500 transition-colors">
                  <h3 className="font-bold text-navy text-lg text-balance">{s.titel}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                    {s.ort && (
                      <span className="flex items-center gap-1.5">
                        <MapPin size={14} /> {s.ort}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} />
                      {UMFAENGE[s.umfang as keyof typeof UMFAENGE] ?? s.umfang}
                      {s.stundenProWoche ? ` · ${s.stundenProWoche} Std./Woche` : ''}
                    </span>
                    {s.beginn && (
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={14} /> ab {s.beginn}
                      </span>
                    )}
                    {verguetungText(s) && (
                      <span className="flex items-center gap-1.5 text-teal-700 font-medium">
                        <Banknote size={14} /> {verguetungText(s)}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {seite.stellen.length > 0 && (
          <p className="mt-6 text-sm text-gray-500">
            Nichts Passendes dabei?{' '}
            <Link
              href={`/karriere/${params.kunde}/initiativ`}
              className="text-teal-700 font-semibold underline">
              Bewirb dich initiativ.
            </Link>
          </p>
        )}
      </main>

      <KarriereFuss
        betrieb={seite.betrieb}
        impressum={seite.impressum}
        datenschutz={seite.datenschutz}
      />
    </div>
  )
}
