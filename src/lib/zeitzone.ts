/**
 * §203 Welche Uhr gilt — und warum das nicht die des Servers sein darf.
 *
 * DER FEHLER, DEN DAS BEHEBT
 * Der Eigentümer hat gestempelt und gemeldet: „Wenn ich mich 10:19 einlogge,
 * dann steht da 8:19." Zwei Stunden daneben, und zwar genau der Abstand
 * zwischen Berlin und UTC im Sommer.
 *
 * Die Ursache stand in `stempeluhr.ts`: Die Uhrzeit wurde mit
 * `toTimeString()` gebildet, der Tag mit `getFullYear()`/`getMonth()`. Beide
 * nehmen die Zeitzone des Rechners, auf dem der Code läuft. Auf dem
 * Entwicklungsrechner ist das Berlin, bei Railway ist es UTC. Also lief es
 * hier richtig und im Betrieb falsch — die schlimmste Sorte Fehler.
 *
 * WARUM ES NICHT NUR KOSMETIK IST
 * Die Dauer wird aus `clockInAt` gerechnet und stimmte immer. Falsch waren
 * die geschriebenen Felder `clockIn`, `clockOut` und `date`. Das heißt:
 *
 *   – Auf jedem Stundenzettel und jedem Monatsbeleg steht eine falsche
 *     Uhrzeit. Ein Arbeitszeitnachweis mit falschen Uhrzeiten ist als
 *     Nachweis wertlos (§16 Abs. 2 ArbZG).
 *   – Und bei Nachtdiensten ist auch der TAG falsch: Wer um 00:30 Berlin
 *     kommt, kam um 22:30 UTC — also am Vortag. Der Dienst landete im
 *     falschen Abrechnungsmonat.
 *
 * WARUM FEST BERLIN UND NICHT „JE KUNDE"
 * OKUN rechnet deutschen Lohn nach deutschem Recht. Ein Kunde in einer
 * anderen Zeitzone bräuchte nicht nur eine andere Uhr, sondern ein anderes
 * Lohnrecht. Die Variable ist trotzdem da: Sie macht aus einer versteckten
 * Annahme eine benannte — und wer sie eines Tages ändern muss, findet diese
 * Stelle, statt sie zu suchen.
 */

export const ZEITZONE = process.env.OKUN_ZEITZONE || 'Europe/Berlin'

/**
 * Die Teile eines Zeitpunkts in der Betriebszeitzone.
 *
 * Über `Intl` statt über eine Verschiebung in Stunden: Die Umstellung auf
 * Sommerzeit ist genau die Nacht, in der jede selbst gerechnete Verschiebung
 * um eine Stunde danebenliegt — und das ist eine Nacht, in der gearbeitet
 * wird.
 */
function teile(d: Date, zone: string = ZEITZONE): Record<string, string> {
  const roh = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  return Object.fromEntries(roh.map(t => [t.type, t.value]))
}

/** Uhrzeit als „HH:MM" in der Betriebszeitzone. */
export function uhrzeitIn(d: Date, zone: string = ZEITZONE): string {
  const t = teile(d, zone)
  // `hour12: false` liefert in manchen Umgebungen „24" statt „00".
  const stunde = t.hour === '24' ? '00' : t.hour
  return `${stunde}:${t.minute}`
}

/** Der Kalendertag als „JJJJ-MM-TT" in der Betriebszeitzone. */
export function tagIn(d: Date, zone: string = ZEITZONE): string {
  const t = teile(d, zone)
  return `${t.year}-${t.month}-${t.day}`
}
