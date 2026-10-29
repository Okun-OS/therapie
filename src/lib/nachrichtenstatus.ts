/**
 * §240 Gesendet, zugestellt, gelesen — und was man noch zurückziehen darf.
 *
 * DIE MELDUNG
 * „Ich konnte eine Nachricht nicht löschen, weil da stand, dass es schon
 * gelesen wurde und das deswegen nicht zu löschen ging, obwohl das wurde noch
 * gar nicht gelesen. … Am besten wäre, wenn da so eine Logik eingebaut wird wie
 * bei WhatsApp: ein Haken ist versendet, aber noch nicht angekommen. Bei zwei
 * Haken ist es auch bei dem anderen angekommen, und wenn die Haken eine Farbe
 * annehmen, dann ist es gelesen. Und erst wenn es auf dieser Farbe ist, dann
 * kann man es nicht mehr löschen."
 *
 * WAS VORHER SCHIEFLIEF — UND WARUM ES KEIN ANZEIGEFEHLER WAR
 * Die Oberfläche sieht alle zehn Sekunden nach, ob etwas Neues da ist. Bei
 * JEDEM dieser Durchläufe meldete sie „gelesen" an den Server. Wer ein
 * Gespräch irgendwo offen liegen hatte — auch in einem Hintergrund-Reiter von
 * gestern —, las damit alles binnen zehn Sekunden, ohne hinzusehen. Die Auskunft
 * „wurde schon gelesen" war also nicht falsch berechnet, sondern auf einer
 * falschen Tatsache aufgebaut.
 *
 * Und sie war genau deshalb da: §221 verbietet das Zurückziehen, sobald jemand
 * gelesen hat. Eine Zusage, die an einem Wert hängt, der sich von selbst
 * hochzählt, verbietet irgendwann alles.
 *
 * DIE DREI ZUSTÄNDE
 *   gesendet     Der Server hat sie. Beim Empfänger war sie noch nicht.
 *   zugestellt   Sie liegt auf dem Gerät des anderen — genau das, was der
 *                Zehn-Sekunden-Takt vorher fälschlich „gelesen" nannte.
 *   gelesen      Jemand hat das Gespräch geöffnet, während das Fenster
 *                sichtbar war.
 *
 * WARUM „ALLE" UND NICHT „EINER"
 * In einer Gruppe zählt der Langsamste. Zwei Haken, weil einer von acht das
 * Gerät angehabt hat, wären eine Auskunft über niemanden. Dieselbe Regel gilt
 * fürs Zurückziehen: Solange ein einziger Mensch es noch nicht gelesen hat,
 * darf zurückgezogen werden — bei dem einen, der es schon kennt, hilft auch
 * das Löschen nichts mehr, aber für alle anderen schon.
 */

export type Nachrichtenstatus = 'gesendet' | 'zugestellt' | 'gelesen'

/** Ein Mitglied, so viel wie diese Rechnung davon braucht. */
export interface Lesestand {
  userId: string
  gelesenBis?: Date | string | null
  zugestelltBis?: Date | string | null
}

function alsZahl(wert: Date | string | null | undefined): number | null {
  if (!wert) return null
  const t = wert instanceof Date ? wert.getTime() : Date.parse(wert)
  return Number.isNaN(t) ? null : t
}

/**
 * Der Zustand EINER eigenen Nachricht.
 *
 * `absenderId` fällt aus der Betrachtung: Dass ich meine eigene Nachricht
 * kenne, sagt über ihre Zustellung nichts.
 */
export function nachrichtenstatus(
  nachricht: { createdAt: Date | string; userId: string },
  mitglieder: Lesestand[],
): Nachrichtenstatus {
  const gesendetAm = alsZahl(nachricht.createdAt)
  if (gesendetAm === null) return 'gesendet'

  const andere = mitglieder.filter(m => m.userId !== nachricht.userId)
  // Ein Gespräch ohne Gegenüber kann nichts zustellen. „Gesendet" ist dann
  // die einzige wahre Auskunft — nicht „zugestellt an niemanden".
  if (andere.length === 0) return 'gesendet'

  const hat = (m: Lesestand, feld: 'gelesenBis' | 'zugestelltBis') => {
    const stand = alsZahl(m[feld])
    return stand !== null && stand >= gesendetAm
  }

  if (andere.every(m => hat(m, 'gelesenBis'))) return 'gelesen'
  /*
   * Gelesen schließt zugestellt ein, auch wenn der Zustellstand fehlt: Wer
   * etwas gelesen hat, hat es bekommen. Ohne diese Zeile stünde bei alten
   * Nachrichten ein Haken weniger, als der Wahrheit entspricht.
   */
  if (andere.every(m => hat(m, 'zugestelltBis') || hat(m, 'gelesenBis'))) return 'zugestellt'
  return 'gesendet'
}

/**
 * Darf diese Nachricht noch zurückgezogen werden?
 *
 * §221 hat die Regel aufgestellt, §240 stellt die Tatsache darunter richtig:
 * Entscheidend ist GELESEN, nicht zugestellt. Eine Nachricht, die auf dem
 * Telefon des anderen liegt, aber noch niemand gesehen hat, lässt sich
 * zurückziehen — das ist der Fall, um den es in der Meldung ging.
 */
export function zurueckziehbar(
  nachricht: { createdAt: Date | string; userId: string; art?: string },
  mitglieder: Lesestand[],
  ich: string,
): boolean {
  if (nachricht.userId !== ich) return false
  if (nachricht.art === 'system') return false
  return nachrichtenstatus(nachricht, mitglieder) !== 'gelesen'
}
