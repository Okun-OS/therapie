/**
 * §268 Wann zuletzt — die Vorgeschichte als Datum, nicht als Anzahl.
 *
 * WOZU
 * Zwei Regeln des Dienstplans fragen nach einem ABSTAND und nicht nach einer
 * Menge:
 *
 *   „Keiner darf den Freitagsfrüh- oder -spätdienst zweimal in Folge haben."
 *   „Den Spätdienst möglichst nur einmal in vier Wochen."
 *
 * Die Zähler, die es bisher gab, können das nicht beantworten: Vier
 * Spätdienste in fünf Wochen können gleichmäßig verteilt gewesen sein oder
 * viermal hintereinander. Dieselbe Zahl, ein völlig anderer Monat.
 *
 * WARUM DAS HIER STEHT UND NICHT IN DER ZEILE, IN DER ES GEBRAUCHT WIRD
 * Weil es sonst ungeprüft bliebe. Es steckte in einer Funktion, die eine
 * Datenbank, einen Standort und einen Zeitraum braucht — die lässt sich nicht
 * mit drei Zeilen prüfen, und eine Rechnung, die man nicht prüfen kann, wird
 * irgendwann falsch, ohne dass es jemand merkt.
 */

export interface DienstEintrag {
  date: string
  shiftId: string
}

export interface DienstArt {
  id: string
  typ?: string | null
}

/**
 * Das Datum des jüngsten Dienstes dieser Art — oder `null`.
 *
 * Erwartet `eintraege` ABSTEIGEND nach Datum; so kommt die Liste aus der
 * Datenbank, und der erste Treffer ist dann der jüngste. Die Reihenfolge wird
 * hier nicht noch einmal hergestellt: Eine Funktion, die sortiert, obwohl sie
 * es nicht muss, verdeckt den Fall, in dem der Aufrufer unsortiert übergibt.
 */
export function letzterDienst(
  eintraege: DienstEintrag[],
  schichten: DienstArt[],
  typ: string,
  nurFreitag = false,
): string | null {
  const artVon = new Map(schichten.map(s => [s.id, (s.typ ?? '').toLowerCase()]))
  for (const e of eintraege) {
    if (nurFreitag && !istFreitag(e.date)) continue
    if (artVon.get(e.shiftId) === typ.toLowerCase()) return e.date
  }
  return null
}

/**
 * Ist dieses Datum ein Freitag?
 *
 * Gerechnet wird auf den reinen Datumsteil, ohne Zeitzone: `new Date('…')`
 * liest ein Datum ohne Uhrzeit als Mitternacht UTC, und östlich von
 * Greenwich wird daraus örtlich der Vortag. Für einen Dienstplan ist das der
 * Unterschied zwischen Donnerstag und Freitag.
 */
export function istFreitag(datum: string): boolean {
  const teile = datum.slice(0, 10).split('-').map(Number)
  if (teile.length !== 3 || teile.some(z => !Number.isFinite(z))) return false
  const [j, m, t] = teile
  return new Date(Date.UTC(j, m - 1, t)).getUTCDay() === 5
}
