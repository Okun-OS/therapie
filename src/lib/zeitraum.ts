/**
 * §283 Einen Zeitraum auswählen — die Rechnung dahinter.
 *
 * GEMELDET: „Bei Urlaub oder Wunschdienst muss ich erst den Anfangstag
 * auswählen, dann wieder rausgehen und den Endtag auswählen. Und wenn ich
 * den letzten Tag wählen wollte — erster Tag war der 14. Dezember —, war ich
 * wieder im November."
 *
 * Beides stimmt, und beides kommt aus derselben Bauform: zwei getrennte
 * Felder vom Typ `date`. Das zweite weiß nichts vom ersten; das Telefon
 * öffnet seinen Kalender im laufenden Monat, nicht beim gewählten Starttag.
 * Wer im Dezember plant, landet im November und blättert von Hand zurück.
 *
 * WARUM DIE RECHNUNG HIER STEHT UND NICHT IN DER KOMPONENTE
 * Weil Datumsrechnung die Stelle ist, an der still etwas danebengeht: ein
 * Monatsraster, das am falschen Wochentag beginnt, eine Spanne, die über
 * den Jahreswechsel kippt, ein Klick, der eine umgekehrte Spanne erzeugt.
 * Das lässt sich hier in drei Zeilen prüfen und in einer Komponente nicht.
 *
 * Gerechnet wird durchweg auf dem reinen Datumsteil in UTC. `new Date('…')`
 * liest ein Datum ohne Uhrzeit als Mitternacht UTC; östlich von Greenwich
 * wird daraus örtlich der Vortag, und ein Kalender, der jeden Tag um eins
 * verschiebt, ist schlimmer als keiner.
 */

export interface Spanne {
  von: string
  bis: string
}

/** „YYYY-MM-DD" → Date in UTC. `null`, wenn unlesbar. */
export function alsDatum(iso: string | null | undefined): Date | null {
  const teile = (iso ?? '').slice(0, 10).split('-').map(Number)
  if (teile.length !== 3 || teile.some(z => !Number.isFinite(z))) return null
  const [j, m, t] = teile
  const d = new Date(Date.UTC(j, m - 1, t))
  // Der 31. Februar wird sonst stillschweigend zum 3. März.
  if (d.getUTCFullYear() !== j || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== t) return null
  return d
}

export function alsIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Wochentag mit Montag als 0 — so, wie ein deutscher Kalender aussieht. */
export function wochentagMontagNull(d: Date): number {
  return (d.getUTCDay() + 6) % 7
}

export interface Rastertag {
  datum: string
  /** Gehört der Tag zum angezeigten Monat oder füllt er nur die Zeile? */
  imMonat: boolean
}

/**
 * Das Raster eines Monats: immer sechs volle Wochen.
 *
 * Sechs, nicht „so viele wie nötig": Ein Kalender, der mal fünf und mal
 * sechs Zeilen hoch ist, springt beim Blättern unter dem Finger weg.
 */
export function monatsRaster(jahr: number, monat: number): Rastertag[] {
  const erster = new Date(Date.UTC(jahr, monat - 1, 1))
  const start = new Date(erster)
  start.setUTCDate(start.getUTCDate() - wochentagMontagNull(erster))

  const tage: Rastertag[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    tage.push({ datum: alsIso(d), imMonat: d.getUTCMonth() === monat - 1 })
  }
  return tage
}

/** Einen Monat weiter oder zurück, über den Jahreswechsel hinweg. */
export function monatVerschieben(
  jahr: number, monat: number, schritte: number,
): { jahr: number; monat: number } {
  const roh = (jahr * 12 + (monat - 1)) + schritte
  return { jahr: Math.floor(roh / 12), monat: (roh % 12) + 1 }
}

/** Liegt der Tag in der Spanne (beide Enden eingeschlossen)? */
export function imZeitraum(datum: string, spanne: Spanne): boolean {
  if (!spanne.von) return false
  const bis = spanne.bis || spanne.von
  return datum >= spanne.von && datum <= bis
}

/**
 * Was ein Klick auf einen Tag aus der bisherigen Auswahl macht.
 *
 * Drei Fälle, und der dritte ist der, den eine naive Fassung falsch macht:
 *
 *   nichts gewählt          → der Tag wird der Anfang
 *   Anfang, kein Ende       → der Tag wird das Ende; liegt er DAVOR,
 *                             wird er der neue Anfang
 *   Anfang und Ende         → von vorn, der Tag wird der neue Anfang
 *
 * Ohne den zweiten Teil der mittleren Regel entstünde eine umgekehrte
 * Spanne — „vom 20. bis zum 14." —, und die zählt null Tage.
 */
export function spanneWaehlen(aktuell: Spanne, tag: string): Spanne {
  if (!aktuell.von || (aktuell.von && aktuell.bis)) return { von: tag, bis: '' }
  if (tag < aktuell.von) return { von: tag, bis: '' }
  return { von: aktuell.von, bis: tag }
}

/** Wie viele Kalendertage die Spanne umfasst, beide Enden eingeschlossen. */
export function tageInSpanne(spanne: Spanne): number {
  const a = alsDatum(spanne.von)
  const b = alsDatum(spanne.bis || spanne.von)
  if (!a || !b || b < a) return 0
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1
}

/**
 * Welcher Monat beim Öffnen gezeigt wird.
 *
 * Genau der Punkt aus der Meldung: Steht schon ein Anfang fest, wird DESSEN
 * Monat gezeigt — nicht der laufende. Sonst sucht man den 14. Dezember im
 * November.
 */
export function startMonat(
  spanne: Spanne, heute: Date = new Date(),
): { jahr: number; monat: number } {
  const anker = alsDatum(spanne.von) ?? alsDatum(alsIso(heute)) ?? new Date()
  return { jahr: anker.getUTCFullYear(), monat: anker.getUTCMonth() + 1 }
}

export const MONATSNAMEN = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

export const WOCHENTAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
