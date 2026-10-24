import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, MapPin } from 'lucide-react'
import { anbieter } from '@/lib/dsgvo-verzeichnis'
import { WebsiteKopf, WebsiteFuss } from '@/components/website/Rahmen'
import { Kontaktformular } from '@/components/website/Kontaktformular'
import { KONTAKT } from '@/lib/website-inhalt'

export const metadata: Metadata = {
  title: 'Kontakt',
  description:
    'Sprechen Sie mit uns über Dienstplanung, Zeiterfassung und Lohn in '
    + 'Ihrer Einrichtung.',
}

/**
 * §177 Die Kontaktseite.
 *
 * Neben dem Formular steht die E-Mail-Adresse im Klartext. Nicht jeder mag
 * Formulare, und wer vom Telefon aus schreibt, hat seine Signatur schon im
 * Mailprogramm. Ein Formular, das der einzige Weg ist, kostet Anfragen.
 */
export default function Kontakt() {
  const a = anbieter()

  return (
    <div className="min-h-screen bg-navy-900">
      <WebsiteKopf />

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, #C89C5B33, transparent 60%)' }}
        />

        <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="font-display text-xs font-bold uppercase leading-relaxed tracking-[0.12em] text-gold">
                {KONTAKT.vorspann}
              </p>
              <h1 className="mt-5 font-display text-3xl font-bold leading-tight text-white text-balance sm:text-4xl">
                {KONTAKT.zeilen[0]}
                <br />
                <span className="text-brand">{KONTAKT.zeilen[1]}</span>
              </h1>
              <p className="mt-5 leading-relaxed text-navy-300">{KONTAKT.text}</p>

              <div className="mt-9 space-y-4">
                {a.kontakt && (
                  <a
                    href={`mailto:${a.kontakt}`}
                    className="flex items-start gap-3 rounded-2xl border border-white/8 bg-navy-800/40 p-4 transition-colors hover:border-white/15"
                  >
                    <Mail size={17} className="mt-0.5 shrink-0 text-brand" />
                    <span>
                      <span className="block text-xs text-navy-500">Lieber direkt schreiben?</span>
                      <span className="block text-sm font-medium text-white">{a.kontakt}</span>
                    </span>
                  </a>
                )}
                {a.anschrift && (
                  <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-navy-800/40 p-4">
                    <MapPin size={17} className="mt-0.5 shrink-0 text-navy-500" />
                    <span>
                      <span className="block text-xs text-navy-500">{a.name}</span>
                      <span className="block whitespace-pre-line text-sm text-navy-200">
                        {a.anschrift}
                      </span>
                    </span>
                  </div>
                )}
              </div>

              <p className="mt-8 text-xs leading-relaxed text-navy-500">
                Was Sie hier schreiben, nutzen wir ausschließlich, um Ihre
                Anfrage zu beantworten. Wird daraus kein Vertrag, löschen wir
                es nach sechs Monaten. Einzelheiten in der{' '}
                <Link href="/datenschutz" className="text-navy-300 underline">
                  Datenschutzerklärung
                </Link>.
              </p>
            </div>

            <Kontaktformular />
          </div>
        </div>
      </section>

      <WebsiteFuss kontakt={a.kontakt} />
    </div>
  )
}
