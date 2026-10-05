import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SCHLUSS } from '@/lib/website-inhalt'
import { Hintergrundbild } from './Hintergrundbild'

/**
 * §189 Der Kasten am Fuß von Startseite und Funktionsseite.
 *
 * WARUM ER JETZT EINE KOMPONENTE IST
 * Er stand zweimal im Verzeichnis, Wort für Wort gleich — einmal in
 * `page.tsx`, einmal in `funktionen/page.tsx`. Das ging gut, solange ihn
 * niemand anfasste. Jetzt bekommt er ein Hintergrundbild, und damit wäre es
 * eine Frage von Wochen, bis die eine Fassung etwas hat, das der anderen
 * fehlt. Ein Besucher, der beide Seiten sieht, merkt so etwas.
 *
 * WAS HIER VORHER ANDERS WAR
 * Statt des Bildes lag ein goldener Lichtfleck über der Ecke. Das Bild bringt
 * seinen eigenen Schein mit — beides übereinander wird milchig. Der Fleck ist
 * deshalb weg und nicht bloß übermalt.
 */
export function Schlussaufruf() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 sm:pb-24">
      <div
        data-test="schlussaufruf"
        className="relative overflow-hidden rounded-3xl border border-white/8 bg-navy-900"
      >
        <Hintergrundbild
          bild="/hintergrund/band-verbunden.webp"
          art="kasten"
          ausschnitt="object-[68%_center]"
        />

        {/*
          §189 Der Knopf steht jetzt UNTER dem Text, nicht rechts daneben.
          Rechts lag er genau auf dem Zeichen in der Bildmitte und deckte es
          ab — ausgerechnet das, wofür das Bild da ist. Links hat er Platz,
          steht im Lesefluss direkt hinter dem Satz, auf den er antwortet,
          und das Bild bleibt ganz.
        */}
        <div className="relative max-w-2xl p-8 sm:p-14">
          <h2 className="font-display text-2xl font-bold leading-tight text-white text-balance sm:text-3xl">
            {SCHLUSS.titel}
          </h2>
          <p className="mt-4 text-lg font-semibold text-brand">{SCHLUSS.betont}</p>
          <p className="mt-2 leading-relaxed text-navy-300">{SCHLUSS.text}</p>
          <Link
            href="/kontakt"
            data-test="schluss-knopf"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3.5 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.02]"
          >
            {SCHLUSS.knopf}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  )
}
