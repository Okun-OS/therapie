import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, MapPin, Clock, CalendarDays, Banknote, FileText } from 'lucide-react'
import { karriereSeite, karriereStelle } from '@/lib/karriere'
import { UMFAENGE, verguetungText, jobPostingLd, anzeigeText } from '@/lib/recruiting'
import { KarriereFuss } from '@/components/karriere/KarriereFuss'
import { Bewerbungsformular } from '@/components/karriere/Bewerbungsformular'

export const dynamic = 'force-dynamic'

/**
 * §148 Eine einzelne Anzeige — und das Formular darunter.
 *
 * WARUM DAS FORMULAR AUF DERSELBEN SEITE STEHT
 * Jeder Klick zwischen „interessiert" und „abgeschickt" kostet Bewerber. Wer
 * die Anzeige zu Ende gelesen hat, soll den Namen eintragen können, ohne
 * vorher eine neue Seite zu laden.
 *
 * WARUM DIE STRUKTURIERTEN DATEN HIER STEHEN
 * Google for Jobs liest sie von der Detailseite, nicht von der Übersicht. Ohne
 * das `<script type="application/ld+json">` unten erscheint die Anzeige in der
 * Job-Suche nicht — und man merkt es nie, weil nichts fehlschlägt.
 *
 * DIE INITIATIVBEWERBUNG LÄUFT ÜBER DIESELBE SEITE
 * Unter der Adresse `initiativ`. Sie ist keine Stelle, deshalb gibt es dort
 * keine Anzeige und keine strukturierten Daten — nur das Formular.
 */

interface Props { params: { kunde: string; slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (params.slug === 'initiativ') {
    const seite = await karriereSeite(params.kunde)
    return seite
      ? { title: `Initiativbewerbung · ${seite.betrieb}` }
      : { title: 'Nicht gefunden' }
  }
  const treffer = await karriereStelle(params.kunde, params.slug)
  if (!treffer) return { title: 'Nicht gefunden' }
  return {
    title: `${treffer.stelle.titel} · ${treffer.seite.betrieb}`,
    description: treffer.stelle.beschreibung.slice(0, 160),
  }
}

export default async function Anzeige({ params }: Props) {
  const initiativ = params.slug === 'initiativ'
  const seite = initiativ ? await karriereSeite(params.kunde) : null
  const treffer = initiativ ? null : await karriereStelle(params.kunde, params.slug)
  if (!seite && !treffer) notFound()

  const s = treffer?.stelle ?? null
  const betrieb = treffer?.seite ?? seite!

  return (
    <div className="min-h-screen bg-gray-50">
      {s && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              jobPostingLd(s, { name: betrieb.betrieb }, betrieb.adresse),
            ),
          }}
        />
      )}

      <div className="max-w-3xl mx-auto px-5 py-8 sm:py-10">
        <Link
          href={`/karriere/${params.kunde}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 font-medium">
          <ArrowLeft size={15} /> Alle Stellen
        </Link>

        <article className="mt-5 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
          <p className="text-xs uppercase tracking-widest text-gray-400">
            {betrieb.betrieb}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy mt-1.5 text-balance">
            {s ? s.titel : 'Initiativbewerbung'}
          </h1>

          {s ? (
            <>
              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-sm text-gray-600">
                {s.ort && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={15} /> {s.ort}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Clock size={15} />
                  {UMFAENGE[s.umfang as keyof typeof UMFAENGE] ?? s.umfang}
                  {s.stundenProWoche ? ` · ${s.stundenProWoche} Std./Woche` : ''}
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText size={15} />
                  {s.befristung === 'befristet'
                    ? `befristet${s.befristetBis ? ` bis ${s.befristetBis}` : ''}`
                    : 'unbefristet'}
                </span>
                {s.beginn && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={15} /> ab {s.beginn}
                  </span>
                )}
                {verguetungText(s) && (
                  <span className="flex items-center gap-1.5 text-teal-700 font-semibold">
                    <Banknote size={15} /> {verguetungText(s)}
                  </span>
                )}
              </div>

              <div className="mt-6 text-gray-700 leading-relaxed whitespace-pre-line">
                {s.beschreibung}
              </div>

              {([
                ['Deine Aufgaben', s.aufgaben],
                ['Das bringst du mit', s.profil],
                ['Das bieten wir', s.wirBieten],
              ] as const).filter(([, l]) => l.length > 0).map(([titel, liste]) => (
                <section key={titel} className="mt-6">
                  <h2 className="font-bold text-navy">{titel}</h2>
                  <ul className="mt-2 space-y-1.5">
                    {liste.map((p, i) => (
                      <li key={i} className="flex gap-2.5 text-gray-700">
                        <span className="text-teal-600 mt-0.5">•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              {/* Für Leser ohne JavaScript und für die Vorschau in Messengern */}
              <p className="sr-only">{anzeigeText(s)}</p>
            </>
          ) : (
            <p className="mt-4 text-gray-700 leading-relaxed">
              Zurzeit passt keine unserer Anzeigen zu dir, du möchtest aber bei
              uns arbeiten? Schreib uns, was du suchst und was du mitbringst —
              wir melden uns.
            </p>
          )}
        </article>

        <Bewerbungsformular
          kunde={params.kunde}
          stelle={s?.slug ?? null}
          stellenTitel={s?.titel ?? null}
          betrieb={betrieb.betrieb}
        />
      </div>

      <KarriereFuss
        betrieb={betrieb.betrieb}
        impressum={betrieb.impressum}
        datenschutz={betrieb.datenschutz}
      />
    </div>
  )
}
