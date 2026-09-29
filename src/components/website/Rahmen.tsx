'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'
import { Menu, X, ArrowRight } from 'lucide-react'

/**
 * §177 Kopf und Fuß der öffentlichen Website.
 *
 * WARUM „ANMELDEN" IMMER OBEN RECHTS STEHT
 * Wer hier landet, ist entweder Interessent oder Beschäftigter. Der
 * Interessent liest, der Beschäftigte will rein. Müsste er dafür an einer
 * Verkaufsseite vorbeiscrollen, wäre die Seite für ihn ein Hindernis. Ein
 * Knopf, der auf jeder Seite an derselben Stelle steht, kostet nichts und
 * spart ihm jeden Morgen einen Moment.
 */

const SEITEN = [
  { href: '/', label: 'Start' },
  { href: '/funktionen', label: 'Funktionen' },
  { href: '/kontakt', label: 'Kontakt' },
]

export function WebsiteKopf() {
  const [offen, setOffen] = useState(false)
  const pfad = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-navy-900/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5">
        <Link href="/" className="shrink-0" aria-label="OKUN Workforce — zur Startseite">
          <Logo variant="wordmark" onDark iconSize={32} />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {SEITEN.map(s => (
            <Link
              key={s.href}
              href={s.href}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                pfad === s.href
                  ? 'text-white'
                  : 'text-navy-300 hover:text-white'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/login"
          data-test="kopf-anmelden"
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold-light transition-colors hover:bg-gold/20 md:ml-0"
        >
          Anmelden
        </Link>

        <button
          onClick={() => setOffen(o => !o)}
          aria-label={offen ? 'Menü schließen' : 'Menü öffnen'}
          aria-expanded={offen}
          className="-mr-1 rounded-lg p-2 text-navy-200 md:hidden"
        >
          {offen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {offen && (
        <nav className="border-t border-white/5 px-5 py-2 md:hidden">
          {SEITEN.map(s => (
            <Link
              key={s.href}
              href={s.href}
              onClick={() => setOffen(false)}
              className="block rounded-lg px-3 py-3 text-sm font-medium text-navy-200"
            >
              {s.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}

export function WebsiteFuss({ kontakt }: { kontakt: string | null }) {
  return (
    <footer className="border-t border-white/5 bg-navy-900">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo variant="wordmark" onDark iconSize={32} />
            <p className="mt-4 text-sm leading-relaxed text-navy-400">
              Dienstplanung, Zeiterfassung und Lohnabrechnung für
              Einrichtungen, in denen Menschen betreut werden — und in denen
              ein falscher Dienstplan mehr kaputt macht als einen Nachmittag.
            </p>
          </div>

          <div className="flex gap-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-navy-500">
                Programm
              </p>
              <div className="mt-3 flex flex-col gap-2.5">
                <Link href="/funktionen" className="text-sm text-navy-300 hover:text-white">Funktionen</Link>
                <Link href="/kontakt" className="text-sm text-navy-300 hover:text-white">Kontakt</Link>
                <Link href="/login" className="text-sm text-navy-300 hover:text-white">Anmelden</Link>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-navy-500">
                Rechtliches
              </p>
              <div className="mt-3 flex flex-col gap-2.5">
                <Link href="/impressum" className="text-sm text-navy-300 hover:text-white">Impressum</Link>
                <Link href="/datenschutz" className="text-sm text-navy-300 hover:text-white">Datenschutz</Link>
                {kontakt && (
                  <a href={`mailto:${kontakt}`} className="text-sm text-navy-300 hover:text-white">
                    {kontakt}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-10 border-t border-white/5 pt-6 text-xs text-navy-500">
          © {new Date().getFullYear()} OKUN Workforce
        </p>
      </div>
    </footer>
  )
}

/** Der wiederkehrende Aufruf zum Gespräch. */
export function Gespraech({ titel, text }: { titel: string; text: string }) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
      <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-br from-navy-800 to-navy-900 p-8 sm:p-14">
        {/* Der Lichtbogen aus dem Entwurf — reines CSS, kein Bild. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, #C89C5B55, transparent 65%)' }}
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold text-white text-balance sm:text-3xl">{titel}</h2>
            <p className="mt-3 leading-relaxed text-navy-300">{text}</p>
          </div>
          <Link
            href="/kontakt"
            data-test="gespraech-knopf"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-gold px-6 py-3.5 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.02] md:self-auto"
          >
            Gespräch vereinbaren
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  )
}
