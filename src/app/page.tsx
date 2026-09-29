import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, Check } from 'lucide-react'
import { anbieter } from '@/lib/dsgvo-verzeichnis'
import { WebsiteKopf, WebsiteFuss, Gespraech } from '@/components/website/Rahmen'
import { AngemeldeteWeiterleiten } from '@/components/website/AngemeldeteWeiterleiten'
import { KOPF, KERN, REGELARTEN, STAERKEN, ABLAUF, SCHLUSS } from '@/lib/website-inhalt'

/**
 * §177 Die Startseite — die erste Seite, die jemand von OKUN Workforce sieht.
 *
 * WAS HIER VORHER STAND
 * Eine Weiterleitung auf `/login`. Wer die Adresse aufrief, sah ein
 * Anmeldeformular und sonst nichts — für einen Interessenten eine
 * verschlossene Tür.
 *
 * WARUM SIE AUF DEM SERVER ENTSTEHT
 * Eine Verkaufsseite muss bei Google auffindbar sein und beim ersten Aufruf
 * sofort dastehen, auch auf einem alten Telefon im Zug. Deshalb ist sie eine
 * Server-Komponente: kein Nachladen, kein Flackern, und die Angaben des
 * Anbieters kommen direkt aus der Umgebung.
 *
 * Nur das bisschen, was sich bewegt, ist Client-Code: die Navigation und die
 * Weiterleitung für Angemeldete.
 */

export const metadata: Metadata = {
  title: 'Dienstplanung, die Ihre Regeln kennt',
  description:
    'Dienstplanung, Zeiterfassung und Lohnabrechnung in einem Programm — '
    + 'mit dem Regelwerk Ihres Betriebs, programmiert statt angekreuzt.',
}

export default function Startseite() {
  const a = anbieter()

  return (
    <div className="min-h-screen bg-navy-900">
      <AngemeldeteWeiterleiten />
      <WebsiteKopf />

      {/* ── Aufmacher ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-60 h-[38rem] w-[38rem] rounded-full opacity-50 blur-3xl"
          style={{ background: 'radial-gradient(circle, #26C6C633, transparent 60%)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 top-40 h-[30rem] w-[30rem] rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, #C89C5B33, transparent 60%)' }}
        />

        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 sm:pb-24 sm:pt-24">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
            {KOPF.vorspann}
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.1] text-white text-balance sm:text-6xl">
            {KOPF.zeilen[0]}
            <br />
            <span className="text-brand">{KOPF.zeilen[1]}</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-navy-300">
            {KOPF.text}
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/kontakt"
              data-test="aufmacher-gespraech"
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3.5 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.02]"
            >
              Gespräch vereinbaren
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/funktionen"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/5"
            >
              Alle Funktionen
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stärken ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:pb-24">
        <div className="grid gap-px overflow-hidden rounded-3xl border border-white/8 bg-white/5 sm:grid-cols-2 lg:grid-cols-3">
          {STAERKEN.map(s => (
            <div key={s.titel} className="bg-navy-900 p-7">
              <p className="font-bold text-white">{s.titel}</p>
              <p className="mt-2 text-sm leading-relaxed text-navy-400">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Der Unterschied ────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-navy-800/40">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
                {KERN.vorspann}
              </p>
              <h2 className="mt-4 text-3xl font-bold text-white text-balance sm:text-4xl">
                {KERN.titel}
              </h2>
              {KERN.absaetze.map((p, i) => (
                <p key={i} className="mt-4 leading-relaxed text-navy-300">{p}</p>
              ))}
            </div>

            {/*
              §178 Die ART von Regel, nicht die Regel eines Kunden.

              Hier standen zuerst sechs Regeln aus dem Regelpaket eines
              echten Betriebs. Das wirkte überzeugend und war trotzdem
              falsch: Wie ein Kunde plant, ist sein Betriebsablauf. Er
              gehört ihm, nicht uns, und schon gar nicht ins Schaufenster.
            */}
            <div className="rounded-3xl border border-white/8 bg-navy-900 p-7">
              <p className="text-xs font-bold uppercase tracking-wider text-navy-500">
                Regeln, die wir bauen
              </p>
              <ul className="mt-5 space-y-3.5">
                {REGELARTEN.map(regel => (
                  <li key={regel} className="flex gap-3">
                    <Check size={16} className="mt-0.5 shrink-0 text-brand" />
                    <span className="text-sm leading-relaxed text-navy-200">{regel}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 border-t border-white/5 pt-5 text-xs leading-relaxed text-navy-500">
                Was für Ihren Betrieb gilt, besprechen wir mit Ihnen. Jede
                vereinbarte Regel wird programmiert und bei jeder
                Auslieferung an einem wirklich gerechneten Plan nachgeprüft.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── So fangen wir an ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
          So fangen wir an
        </p>
        <h2 className="mt-4 max-w-2xl text-3xl font-bold text-white text-balance sm:text-4xl">
          Erst verstehen. Dann bauen.
        </h2>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ABLAUF.map((s, i) => (
            <div key={s.titel} className="rounded-2xl border border-white/8 bg-navy-800/40 p-6">
              <span className="text-sm font-bold text-gold">
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="mt-3 font-bold text-white">{s.titel}</p>
              <p className="mt-2 text-sm leading-relaxed text-navy-400">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <Gespraech titel={SCHLUSS.titel} text={SCHLUSS.text} />
      <WebsiteFuss kontakt={a.kontakt} />
    </div>
  )
}
