'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  monatsRaster, monatVerschieben, imZeitraum, spanneWaehlen, tageInSpanne,
  startMonat, alsDatum, MONATSNAMEN, WOCHENTAGE_KURZ, type Spanne,
} from '@/lib/zeitraum'

/**
 * §283 Einen Zeitraum in EINER Ansicht wählen.
 *
 * GEMELDET: „Aktuell muss ich den Anfangstag auswählen und dann nochmal
 * rausgehen und den Endtag auswählen. Cool, wenn ich das beides auf einer
 * Maske mache. Wenn ich raufdrücke, ist der Anfangstag ausgewählt, und dann
 * drücke ich auf den Endtag und sehe direkt die Zeitspanne." Und: „Erster
 * Tag war der 14. Dezember — wenn ich dann auf den letzten Tag gehen
 * wollte, war ich wieder im November."
 *
 * Beides kam aus zwei getrennten Feldern vom Typ `date`. Das zweite wusste
 * nichts vom ersten, und das Telefon öffnete seinen Kalender im laufenden
 * Monat.
 *
 * Hier ist es ein Kalender: erster Tipp der Anfang, zweiter das Ende, die
 * Spanne dazwischen sichtbar. Gerechnet wird in `src/lib/zeitraum.ts` —
 * dort ist es prüfbar, hier wäre es das nicht.
 */
export function Zeitraumwahl({
  wert,
  onChange,
  minDatum,
  maxDatum,
  einzeltag = false,
}: {
  wert: Spanne
  onChange: (spanne: Spanne) => void
  /** Frühester wählbarer Tag, „YYYY-MM-DD". */
  minDatum?: string
  /** Spätester wählbarer Tag. */
  maxDatum?: string
  /** Nur einen Tag wählen lassen — für den Dienstwunsch an einem Tag. */
  einzeltag?: boolean
}) {
  const [{ jahr, monat }, setMonatAnsicht] = useState(() => startMonat(wert))

  /*
   * Steht schon ein Anfang fest, wird DESSEN Monat gezeigt — genau der
   * Punkt aus der Meldung. Nur beim Wechsel des Anfangs, nicht bei jedem
   * Klick: Sonst springt die Ansicht zurück, während jemand blättert.
   */
  useEffect(() => {
    if (wert.von) setMonatAnsicht(startMonat(wert))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wert.von])

  const raster = monatsRaster(jahr, monat)
  const heute = new Date().toISOString().slice(0, 10)
  const tage = tageInSpanne(wert)

  const gesperrt = (datum: string) =>
    (minDatum ? datum < minDatum : false) || (maxDatum ? datum > maxDatum : false)

  const tippen = (datum: string) => {
    if (gesperrt(datum)) return
    onChange(einzeltag ? { von: datum, bis: datum } : spanneWaehlen(wert, datum))
  }

  const kurz = (iso: string) => {
    const d = alsDatum(iso)
    if (!d) return ''
    return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.`
  }

  return (
    <div className="rounded-2xl border border-gray-200 p-3 select-none">
      {/* Monatsleiste */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          aria-label="Vorheriger Monat"
          onClick={() => setMonatAnsicht(monatVerschieben(jahr, monat, -1))}
          className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="font-bold text-navy text-sm">{MONATSNAMEN[monat - 1]} {jahr}</p>
        <button
          type="button"
          aria-label="Nächster Monat"
          onClick={() => setMonatAnsicht(monatVerschieben(jahr, monat, 1))}
          className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WOCHENTAGE_KURZ.map(t => (
          <div key={t} className="text-center text-[11px] font-semibold text-gray-400 py-1">{t}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {raster.map(({ datum, imMonat }) => {
          const drin = imZeitraum(datum, wert)
          const istAnfang = datum === wert.von
          const istEnde = datum === (wert.bis || wert.von)
          const aus = gesperrt(datum)
          const tag = Number(datum.slice(8, 10))

          return (
            <button
              key={datum}
              type="button"
              disabled={aus}
              onClick={() => tippen(datum)}
              aria-label={datum}
              aria-pressed={drin}
              className={[
                // 40 Pixel sind auf einem Telefon noch zu treffen und lassen
                // sieben Spalten nebeneinander Platz.
                'h-10 text-sm rounded-lg transition-colors',
                aus ? 'text-gray-300 cursor-not-allowed'
                  : imMonat ? 'text-navy' : 'text-gray-300',
                drin && !istAnfang && !istEnde ? 'bg-teal-100 text-teal-900' : '',
                istAnfang || (drin && istEnde) ? 'bg-teal-600 text-white font-bold' : '',
                !drin && !aus ? 'hover:bg-gray-100' : '',
                datum === heute && !drin ? 'ring-1 ring-inset ring-teal-400' : '',
              ].join(' ')}
            >
              {tag}
            </button>
          )
        })}
      </div>

      {/*
        Was gewählt ist, steht darunter — und zwar als Satz. „14.12. –
        20.12." allein beantwortet die Frage nicht, die jemand beim
        Urlaubsantrag hat: wie viele Tage das sind.
      */}
      <div className="mt-2 pt-2 border-t border-gray-100 text-sm text-center">
        {!wert.von ? (
          <span className="text-gray-400">
            {einzeltag ? 'Tag auswählen' : 'Ersten Tag antippen'}
          </span>
        ) : !wert.bis && !einzeltag ? (
          <span className="text-gray-600">
            Ab <strong className="text-navy">{kurz(wert.von)}</strong> — jetzt den letzten Tag antippen
          </span>
        ) : (
          <span className="text-navy font-semibold">
            {kurz(wert.von)}
            {wert.bis && wert.bis !== wert.von ? ` – ${kurz(wert.bis)}` : ''}
            <span className="font-normal text-gray-500">
              {' · '}{tage} {tage === 1 ? 'Tag' : 'Tage'}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}
