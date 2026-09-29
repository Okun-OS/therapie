'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'
import { Menu, X } from 'lucide-react'
import { FUSS } from '@/lib/website-inhalt'

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
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3.5 sm:gap-6">
        {/*
          §179 Auf dem Telefon nur das Zeichen, sonst die Wortmarke.
          Bei 390 Pixeln passten Wortmarke, Anmelde-Knopf und Menü-Symbol
          nicht nebeneinander — das Menü war angeschnitten und damit nicht
          mehr bedienbar.
        */}
        <Link href="/" className="shrink-0" aria-label="OKUN Workforce — zur Startseite">
          <span className="sm:hidden">
            <Logo variant="icon" iconSize={30} />
          </span>
          <span className="hidden sm:block">
            <Logo variant="wordmark" onDark iconSize={32} />
          </span>
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
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 px-3.5 py-2 text-sm font-semibold text-gold-light transition-colors hover:bg-gold/20 sm:px-4 md:ml-0"
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
            <p className="mt-4 font-semibold text-white">{FUSS.claim}</p>
            <p className="mt-2 text-sm leading-relaxed text-navy-400">{FUSS.text}</p>
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
          © {new Date().getFullYear()} {FUSS.rechte}
        </p>
      </div>
    </footer>
  )
}
