/**
 * §286 Wie lange jemand schon eingestempelt ist — als Text.
 *
 * GEMELDET, mit Bild: Direkt nach dem Einstempeln stand in der Uhr
 *
 *     -1:-1
 *
 * und eine Minute später war es wieder richtig („0:00").
 *
 * DIE URSACHE
 * Die Anzeige rechnete `jetzt − Einstempelzeitpunkt`. Der Zeitpunkt kommt vom
 * Server, `jetzt` von der Uhr des Telefons. Beide gehen ein paar Sekunden
 * auseinander — das ist normal und lässt sich nicht abstellen. Steht die Uhr
 * des Telefons zwei Sekunden zurück, ist die Differenz −2000 Millisekunden.
 *
 * Und dann rechnete die alte Zeile:
 *
 *     min  = Math.floor(-2000 / 60000)   // −1
 *     std  = Math.floor(-1 / 60)         // −1
 *     rest = -1 % 60                     // −1   (JavaScript behält das
 *                                        //       Vorzeichen des Dividenden)
 *     `${std}:${String(rest).padStart(2, '0')}`  // „-1:-1"
 *
 * Zwei Fehler übereinander: Die Differenz durfte nicht negativ werden, und
 * die Formatierung hätte eine negative Zahl trotzdem lesbar machen müssen.
 * Sichtbar wurde es 30 Sekunden lang, weil die Uhr nur jede halbe Minute neu
 * rechnet.
 *
 * WARUM DAS HIER STEHT UND NICHT IN DER KOMPONENTE
 * Weil `-1:-1` in keinem Test auffiel, solange die Rechnung in einer React-
 * Komponente mit Netzzugriff steckte. Hier sind es drei Zeilen und ein paar
 * Prüfungen — darunter genau der gemeldete Fall.
 */

/**
 * Millisekunden als „h:mm".
 *
 * Eine negative Dauer gibt es nicht: Wer gerade erst gestempelt hat, ist seit
 * null Minuten da, nicht seit minus einer. Negative Eingaben entstehen
 * ausschließlich aus dem Gangunterschied der beiden Uhren und werden deshalb
 * zu „0:00" — nicht zu einem Minuszeichen, das niemand erklären könnte.
 *
 * Unbrauchbare Eingaben (kein Zeitpunkt, NaN) ergeben ebenfalls „0:00". Eine
 * Uhr, die „NaN:NaN" zeigt, ist schlimmer als eine, die bei null steht.
 */
export function laufzeitText(millisekunden: number): string {
  if (!Number.isFinite(millisekunden) || millisekunden <= 0) return '0:00'
  const minuten = Math.floor(millisekunden / 60000)
  return `${Math.floor(minuten / 60)}:${String(minuten % 60).padStart(2, '0')}`
}

/**
 * Dieselbe Dauer sekundengenau als „hh:mm:ss" — für die große Uhr auf der
 * Zeiterfassungsseite.
 *
 * Dort stand dieselbe Krankheit: `Math.floor((Date.now() − Start) / 1000)`
 * im Sekundentakt, ohne untere Schranke. Eine Sekunde Gangunterschied ergab
 * „00:-1:-1". An einer Stelle war ein `Math.max(0, …)` vorhanden, an der
 * anderen nicht — dieselben zwei Abschriften, dieselbe Lücke.
 */
export function laufzeitGenau(millisekunden: number): string {
  const sek = !Number.isFinite(millisekunden) || millisekunden <= 0
    ? 0 : Math.floor(millisekunden / 1000)
  const h = Math.floor(sek / 3600)
  const m = Math.floor((sek % 3600) / 60)
  const s = sek % 60
  return [h, m, s].map(z => String(z).padStart(2, '0')).join(':')
}

/**
 * Der Gangunterschied zwischen Server und Gerät, in Millisekunden.
 *
 * Positiv heißt: Die Uhr des Servers geht vor. Dieser Wert wird auf die
 * Gerätezeit addiert, damit die Laufzeit gegen DIESELBE Uhr gerechnet wird,
 * aus der der Einstempelzeitpunkt stammt.
 *
 * Mehr als eine Viertelstunde wird verworfen. So viel ist kein
 * Gangunterschied mehr, sondern eine falsch gestellte Uhr — und die Zeit des
 * Geräts ist dann auch der Zeitpunkt, der beim Stempeln ohne Netz gemerkt
 * wird (§138). Eine Anzeige, die stillschweigend etwas anderes behauptet als
 * das, was später gespeichert wird, wäre die schlechtere von zwei
 * Ungenauigkeiten.
 */
export const HOECHSTER_VERSATZ = 15 * 60 * 1000

export function zeitversatz(
  serverZeit: string | null | undefined,
  geraeteZeit: number,
): number {
  if (!serverZeit) return 0
  const server = Date.parse(serverZeit)
  if (!Number.isFinite(server)) return 0
  const versatz = server - geraeteZeit
  if (Math.abs(versatz) > HOECHSTER_VERSATZ) return 0
  return versatz
}
