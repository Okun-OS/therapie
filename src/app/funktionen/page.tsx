import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { anbieter } from '@/lib/dsgvo-verzeichnis'
import { WebsiteKopf, WebsiteFuss, Gespraech } from '@/components/website/Rahmen'
import {
  FUNKTIONEN_KOPF, BEREICHE, FUNKTIONEN_SCHLUSS, SCHLUSS,
} from '@/lib/website-inhalt'

/**
 * §177 Das ganze Programm — der vollständige Funktionsumfang.
 *
 * WARUM VOLLSTÄNDIG UND NICHT „DIE WICHTIGSTEN"
 * Wer eine Software für Lohn und Dienstplan sucht, hat eine Liste im Kopf,
 * die er abhaken will: „Können die auch Pfändung? Kurzarbeit? BEM?" Fehlt
 * sein Punkt auf der Seite, nimmt er an, es gibt ihn nicht — und ruft nicht
 * an. Eine Auswahl der Höhepunkte verkauft schlechter als eine lange Liste,
 * in der jeder sein eigenes Problem findet.
 *
 * WAS HIER NICHT STEHEN DARF
 * Alles, was es nicht gibt. Die Liste ist aus der Navigation der Anwendung
 * und dem Nachweisverzeichnis zusammengetragen; jeder Punkt ist gebaut und
 * wird bei jeder Auslieferung nachgeprüft. Wer hier etwas ergänzt, das
 * geplant ist, macht aus einer Übersicht ein Versprechen.
 */

export const metadata: Metadata = {
  title: 'Das ganze Programm',
  description:
    'Alle Funktionen von OKUN Workforce: Dienstplanung mit eigenem '
    + 'Regelwerk, Zeiterfassung, Lohnabrechnung nach deutschem Recht, '
    + 'Abwesenheiten, Nachweise, Recruiting und Datenschutz.',
}

export default function Funktionen() {
  const a = anbieter()
  const anzahl = BEREICHE.reduce((s, b) => s + b.punkte.length, 0)

  return (
    <div className="min-h-screen bg-navy-900">
      <WebsiteKopf />

      <section className="relative overflow-hidden border-b border-white/5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, #26C6C633, transparent 60%)' }}
        />
        <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
            {FUNKTIONEN_KOPF.vorspann}
          </p>
          <h1 className="mt-5 text-4xl font-bold text-white text-balance sm:text-5xl">
            {FUNKTIONEN_KOPF.titel}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-navy-300">
            {FUNKTIONEN_KOPF.text}
          </p>

          {/* Sprungmarken — bei elf Bereichen findet man sonst nichts wieder. */}
          <nav className="mt-9 flex flex-wrap gap-2" aria-label="Bereiche">
            {BEREICHE.map(b => (
              <a
                key={b.titel}
                href={`#${kuerzel(b.titel)}`}
                className="rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-medium text-navy-300 transition-colors hover:border-brand/40 hover:text-white"
              >
                {b.titel}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="space-y-16">
          {BEREICHE.map((b, i) => (
            <section key={b.titel} id={kuerzel(b.titel)} className="scroll-mt-24">
              <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
                <div>
                  <span className="text-sm font-bold text-gold">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h2 className="mt-2 text-2xl font-bold text-white text-balance">
                    {b.titel}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-navy-400">
                    {b.einleitung}
                  </p>
                </div>

                <ul
                  className="grid gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/5 sm:grid-cols-2"
                  data-test={`bereich-${kuerzel(b.titel)}`}
                >
                  {b.punkte.map(p => (
                    <li key={p} className="flex gap-3 bg-navy-900 px-5 py-4">
                      <Check size={15} className="mt-0.5 shrink-0 text-brand" />
                      <span className="text-sm leading-relaxed text-navy-200">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>

        {/* ── Warum das geprüft ist ──────────────────────────────── */}
        <section className="mt-16 rounded-3xl border border-white/8 bg-navy-800/40 p-8 sm:p-10">
          <h2 className="text-2xl font-bold text-white text-balance">
            {FUNKTIONEN_SCHLUSS.titel}
          </h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-navy-300">
            {FUNKTIONEN_SCHLUSS.text}
          </p>
          <p className="mt-6 text-sm text-navy-500">
            {anzahl} einzelne Funktionen in {BEREICHE.length} Bereichen.
          </p>
        </section>
      </div>

      <Gespraech titel={SCHLUSS.titel} text={SCHLUSS.text} />
      <WebsiteFuss kontakt={a.kontakt} />
    </div>
  )
}

/** Aus „Personalakte und Nachweise" wird „personalakte-und-nachweise". */
function kuerzel(titel: string): string {
  return titel
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
