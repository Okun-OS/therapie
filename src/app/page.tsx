import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, Check } from 'lucide-react'
import { anbieter } from '@/lib/dsgvo-verzeichnis'
import { WebsiteKopf, WebsiteFuss } from '@/components/website/Rahmen'
import { AngemeldeteWeiterleiten } from '@/components/website/AngemeldeteWeiterleiten'
import Image from 'next/image'
import {
  KOPF, STAERKEN, KERN, KERN_PUNKTE, ABLAUF, SCHLUSS, BESCHREIBUNG, SCHAUFENSTER,
} from '@/lib/website-inhalt'

/**
 * §177/§179 Die Startseite — die erste Seite, die jemand von OKUN Workforce
 * sieht.
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
  title: 'Vom Bewerber bis zum Lohn',
  description: BESCHREIBUNG,
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
          {/*
            §179 Der Vorspann ist ein ganzer Satz, kein Schlagwort — deshalb
            darf er umbrechen und bekommt eine Breite. Mit `tracking-[0.2em]`
            wie bei einem kurzen Wort wäre er auf dem Telefon unlesbar.
          */}
          <p className="max-w-2xl font-display text-xs font-bold uppercase leading-relaxed tracking-[0.12em] text-gold">
            {KOPF.vorspann}
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold leading-[1.1] text-white text-balance sm:text-6xl">
            {KOPF.zeilen[0]}
            <br />
            <span className="text-brand">{KOPF.zeilen[1]}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-navy-300">
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

      {/* ── Die sechs Kacheln ──────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:pb-24">
        <div className="grid gap-px overflow-hidden rounded-3xl border border-white/8 bg-white/5 sm:grid-cols-2 lg:grid-cols-3">
          {STAERKEN.map(s => (
            <div key={s.titel} className="bg-navy-900 p-7">
              <p className="font-display font-bold leading-snug text-white text-balance">{s.titel}</p>
              <p className="mt-2.5 text-sm leading-relaxed text-navy-400">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Drei Bildschirme, ein Vorgang ──────────────────────────── */}
      {/*
        §184 Bildschirmfotos aus dem laufenden Programm, nicht nachgebaut.
        Sie stehen VOR dem Abschnitt „Der Unterschied", weil sie ihn belegen:
        Wer gerade gelesen hat, dass alles zusammenhängt, soll es sehen, bevor
        er es noch einmal erklärt bekommt.
      */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:pb-24">
        <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-gold">
          {SCHAUFENSTER.vorspann}
        </p>
        <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-white text-balance sm:text-4xl">
          {SCHAUFENSTER.zeilen[0]}
          <br />
          <span className="text-brand">{SCHAUFENSTER.zeilen[1]}</span>
        </h2>
        <p className="mt-5 max-w-2xl leading-relaxed text-navy-300">
          {SCHAUFENSTER.text}
        </p>

        <div className="mt-10 space-y-5">
          {SCHAUFENSTER.schritte.map((s, i) => {
            // Das Telefonbild ist hochkant — es bekommt eine eigene, schmale
            // Spalte neben seinem Text, statt über die ganze Breite gezogen zu
            // werden.
            const hochkant = s.hoehe > s.breite
            return (
              <div
                key={s.bild}
                data-test={`schaufenster-${i + 1}`}
                className={`overflow-hidden rounded-3xl border border-white/8 bg-navy-800/40 ${
                  hochkant ? 'grid gap-6 p-6 sm:grid-cols-[1fr_minmax(0,16rem)] sm:p-8' : 'p-6 sm:p-8'
                }`}
              >
                <div className={hochkant ? 'order-2 sm:order-1 sm:self-center' : ''}>
                  <p className="font-display text-sm font-bold text-gold">
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <p className="mt-2 font-display text-xl font-bold text-white text-balance">
                    {s.titel}
                  </p>
                  <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-navy-300">
                    {s.text}
                  </p>
                </div>
                <div
                  className={`${hochkant ? 'order-1 sm:order-2' : 'mt-6'} overflow-hidden rounded-2xl border border-white/10 bg-navy-900`}
                >
                  <Image
                    src={s.bild}
                    alt={`${s.titel} in OKUN Workforce`}
                    width={s.breite}
                    height={s.hoehe}
                    sizes={hochkant ? '(max-width: 640px) 100vw, 16rem' : '(max-width: 1024px) 100vw, 64rem'}
                    className="h-auto w-full"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Der Unterschied ────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-navy-800/40">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-gold">
                {KERN.vorspann}
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-white text-balance sm:text-4xl">
                {KERN.zeilen[0]}
                <br />
                <span className="text-brand">{KERN.zeilen[1]}</span>
              </h2>
              {KERN.absaetze.map((p, i) => (
                <p key={i} className="mt-4 leading-relaxed text-navy-300">{p}</p>
              ))}
            </div>

            {/*
              §178 Die Liste nennt, was das System zusammenhält — keine
              Regeln aus einem echten Kundenbetrieb. Wie ein Kunde plant,
              gehört ihm, nicht ins Schaufenster.
            */}
            <div className="self-start rounded-3xl border border-white/8 bg-navy-900 p-7 lg:sticky lg:top-24">
              <ul className="space-y-4">
                {KERN_PUNKTE.map(punkt => (
                  <li key={punkt} className="flex gap-3">
                    <Check size={17} className="mt-0.5 shrink-0 text-brand" />
                    <span className="leading-relaxed text-navy-200">{punkt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── So fangen wir an ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-gold">
          So fangen wir an
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ABLAUF.map((s, i) => (
            <div key={s.titel} className="rounded-2xl border border-white/8 bg-navy-800/40 p-6">
              <span className="text-sm font-bold text-gold">
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="mt-3 font-display font-bold leading-snug text-white text-balance">{s.titel}</p>
              <p className="mt-2.5 text-sm leading-relaxed text-navy-400">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Schlussaufruf ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-br from-navy-800 to-navy-900 p-8 sm:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-40 blur-3xl"
            style={{ background: 'radial-gradient(circle, #C89C5B55, transparent 65%)' }}
          />
          <div className="relative flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl font-bold leading-tight text-white text-balance sm:text-3xl">
                {SCHLUSS.titel}
              </h2>
              <p className="mt-4 text-lg font-semibold text-brand">{SCHLUSS.betont}</p>
              <p className="mt-2 leading-relaxed text-navy-300">{SCHLUSS.text}</p>
            </div>
            <Link
              href="/kontakt"
              data-test="schluss-knopf"
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-gold px-6 py-3.5 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.02] md:self-auto"
            >
              {SCHLUSS.knopf}
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <WebsiteFuss kontakt={a.kontakt} />
    </div>
  )
}
