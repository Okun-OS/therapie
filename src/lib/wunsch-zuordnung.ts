/**
 * §281 Welchen Dienst meint ein Dienstwunsch?
 *
 * GEMELDET: „Ich habe einen einzigen Wunschdienst im ganzen System gehabt,
 * er war also sicher erfüllbar — und er wurde nicht vergeben. Angezeigt wurde
 * er auch nicht."
 *
 * DIE URSACHE
 * Die Mitarbeiter-App reicht eine ART ein: `early`, `late`, `mid` oder
 * `frei` (siehe `/employee/schedule`). Der Planer suchte dazu einen Dienst
 * über `s.name` („Frühdienst") oder `s.id` („sf-frueh"). Keines von beiden
 * ist jemals `early`. Es blieb also kein Treffer, und als Dienstkennung
 * wanderte die rohe Zeichenkette `early` weiter — die kennt der Rechendienst
 * nicht. Der Wunsch verschwand lautlos.
 *
 * Lautlos ist dabei das Schlimme: Ein Wunsch, der abgelehnt wird, ist eine
 * Entscheidung. Einer, der nie ankommt, ist ein Versprechen, das niemand
 * einlöst und niemand bemerkt.
 *
 * WARUM DAS HIER STEHT UND NICHT IN DER ZEILE, IN DER ES GEBRAUCHT WIRD
 * Weil es dort nicht prüfbar wäre: `buildRuleModel` braucht Datenbank,
 * Standort und Zeitraum. Eine Zuordnung, die man nicht prüfen kann, geht
 * irgendwann daneben, ohne dass es jemand merkt — so wie diese.
 */

/** Was die Mitarbeiter-App einreicht. */
export const WUNSCH_ARTEN = ['early', 'late', 'mid', 'night', 'frei'] as const

/**
 * Von der Art im Wunsch auf die Art am Dienst.
 *
 * Dieselbe Abbildung benutzt `rule-model-service` schon, um `Shift.type` in
 * die Sprache des Rechendienstes zu übersetzen. Sie steht hier ein zweites
 * Mal — und das ist Absicht: Dort übersetzt sie einen Datenbankwert, hier
 * eine Eingabe aus der App. Zwei Quellen, dieselbe Zielsprache.
 */
const ART_ZU_TYP: Record<string, string> = {
  early: 'frueh',
  frueh: 'frueh',
  late: 'spaet',
  spaet: 'spaet',
  mid: 'mittel',
  mittel: 'mittel',
  night: 'nacht',
  nacht: 'nacht',
}

export interface WunschSchicht {
  id: string
  name: string
  /**
   * Die Art in der Sprache des Rechendienstes: `frueh`, `spaet`, `mittel`,
   * `nacht`.
   */
  typ?: string | null
  /**
   * Die Art in der Sprache der Datenbank: `early`, `late`, `mid`, `night`.
   *
   * Beide Schreibweisen, weil beide Seiten dieselbe Frage stellen: Die
   * Planung arbeitet mit `typ`, die Oberfläche mit `type`. Zwei Funktionen
   * dafür wären zwei Urteile über denselben Wunsch — und eines davon würde
   * irgendwann abweichen.
   */
  type?: string | null
}

/**
 * Den Dienst zu einem Wunsch finden — oder ehrlich `null`.
 *
 * Gesucht wird in dieser Reihenfolge:
 *   1. die Art (`early` → ein Dienst vom Typ `frueh`)
 *   2. die Kennung, falls jemand sie direkt einreicht
 *   3. der Name, für von Hand eingetragene Wünsche
 *
 * `null` heißt: Zu diesem Wunsch gibt es an diesem Standort keinen Dienst.
 * Das ist eine Antwort und kein Fehler — aber eine, die der Leitung gesagt
 * werden muss, statt sie zu verschlucken.
 */
export function wunschSchicht<T extends WunschSchicht>(
  art: string | null | undefined,
  schichten: T[],
): T | null {
  const gesucht = (art ?? '').trim().toLowerCase()
  if (!gesucht || gesucht === 'frei') return null

  const typ = ART_ZU_TYP[gesucht]
  if (typ) {
    const nachTyp = schichten.find(s => {
      const eigene = (s.typ ?? s.type ?? '').toLowerCase()
      return ART_ZU_TYP[eigene] === typ
    })
    if (nachTyp) return nachTyp
  }

  const nachId = schichten.find(s => s.id === art)
  if (nachId) return nachId

  const nachName = schichten.find(s => s.name.toLowerCase() === gesucht)
  return nachName ?? null
}

/** Ist das ein Wunsch nach einem freien Tag? */
export function istWunschFrei(art: string | null | undefined): boolean {
  return (art ?? '').trim().toLowerCase() === 'frei'
}

/**
 * Der Wortlaut für die Leitung — in der Sprache, die auf dem Bildschirm steht.
 *
 * Nicht `early`: Das ist die Sprache der Datenbank. Wer einen Dienstplan
 * freigibt, liest „Frühdienst".
 */
export function wunschText(
  art: string | null | undefined,
  schichten: WunschSchicht[],
): string {
  if (istWunschFrei(art)) return 'Freier Tag'
  const treffer = wunschSchicht(art, schichten)
  if (treffer) return treffer.name
  const benennung: Record<string, string> = {
    early: 'Frühdienst', late: 'Spätdienst', mid: 'Mitteldienst', night: 'Nachtdienst',
  }
  return benennung[(art ?? '').toLowerCase()] ?? (art || 'unbekannter Wunsch')
}
