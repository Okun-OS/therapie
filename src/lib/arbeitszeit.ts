import type { TimeLog } from './types'

/**
 * §206 Was `totalMinutes` bedeutet — und warum es das nur einmal heißen darf.
 *
 * DER FEHLER, DEN DAS BEHEBT
 * Der Eigentümer hat gemeldet: „Die Zeiten stimmen nicht überein." Auf seinem
 * Bild stand ein Eintrag mit 3 h 32 min, und die Kachel darüber sagte für
 * denselben Tag 0 h 44 min. Nachgerechnet: 212 − 168 = 44. Die Pause war
 * zweimal abgezogen.
 *
 * Das war aber nur das Symptom. Die Spalte `totalMinutes` hatte ZWEI
 * Bedeutungen, je nachdem, wer sie schrieb:
 *
 *   Stempeluhr (§137)            netto — die Pause ist schon heraus
 *   Korrektur der Leitung        brutto — Ende minus Anfang
 *
 * Und gelesen wurde sie ebenfalls auf zwei Arten: Die Lohnabrechnung
 * (`payroll-monat.ts`) nahm den Wert unverändert als bezahlte Zeit, sechzehn
 * Anzeigestellen zogen die Pause noch einmal ab. In der Kombination heißt das:
 *
 *   – eine gestempelte Buchung wurde in jeder Übersicht ZU NIEDRIG gezeigt,
 *   – eine von der Leitung korrigierte Buchung wurde ZU HOCH BEZAHLT.
 *
 * Das Zweite ist der eigentliche Schaden. Es fällt niemandem auf, weil beide
 * Zahlen für sich plausibel aussehen.
 *
 * WARUM NETTO UND NICHT BRUTTO
 * Weil `totalMinutes` das ist, was die Lohnabrechnung auszahlt, und bezahlt
 * wird Arbeitszeit, nicht Anwesenheit. Die andere Richtung — die Spalte auf
 * brutto umzudeuten — hätte bedeutet, die Lohnrechnung zu ändern UND alle
 * bestehenden Stempelungen umzurechnen. Bei einer Zahl, an der Geld hängt,
 * nimmt man den Weg, der die vorhandenen Daten in Ruhe lässt.
 *
 * Der Name bleibt trotzdem irreführend. Deshalb steht die Bedeutung hier,
 * an einer Stelle, und alles liest über diese Funktion — damit die Spalte
 * nicht ein drittes Mal etwas anderes bedeutet.
 */

/** Was ein Mensch an diesem Tag wirklich gearbeitet hat. */
export function nettoMinuten(log: {
  totalMinutes?: number | null
  breakMinutes?: number | null
}): number {
  // Hier wird NICHTS abgezogen, und das ist die ganze Pointe: Die Pause ist
  // beim Ausstempeln bereits heraus. Wer hier `- breakMinutes` ergänzt,
  // halbiert die Stunden jedes Mitarbeiters mit Mittagspause.
  return Math.max(0, log.totalMinutes ?? 0)
}

/** Dasselbe für eine Liste. */
export function nettoSumme(logs: Array<{
  totalMinutes?: number | null
  breakMinutes?: number | null
}>): number {
  return logs.reduce((summe, log) => summe + nettoMinuten(log), 0)
}

/**
 * Die Anwesenheit — gearbeitete Zeit PLUS Pause.
 *
 * Gebraucht für die Dokumentation nach §16 Abs. 2 ArbZG: Dort steht, wann
 * jemand da war, und daneben die Pause. Nicht zu verwechseln mit dem, was
 * bezahlt wird.
 */
export function anwesenheitsMinuten(log: {
  totalMinutes?: number | null
  breakMinutes?: number | null
}): number {
  return nettoMinuten(log) + Math.max(0, log.breakMinutes ?? 0)
}

/**
 * Was beim Ausstempeln und beim Korrigieren in `totalMinutes` geschrieben
 * wird — damit beide Wege dasselbe meinen.
 *
 * Genau das war der Fehler: Die Stempeluhr rechnete so, die Korrektur der
 * Leitung nicht. Jetzt gibt es eine Rechnung.
 */
export function zuSpeicherndeMinuten(
  anwesenheitMinuten: number,
  pauseMinuten: number,
): number {
  return Math.max(0, anwesenheitMinuten - Math.max(0, pauseMinuten))
}

/** Nur zur Deutlichkeit in Aufrufen, die einen ganzen Eintrag erwarten. */
export type Zeitbuchung = Pick<TimeLog, 'totalMinutes' | 'breakMinutes'>
