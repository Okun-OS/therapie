import { isPublicHoliday, GERMAN_STATES } from './holidays'

/**
 * §218 Der Zahlungslauf — eine Gehaltszahlung als Vorgang statt als Download.
 *
 * WAS VORHER FEHLTE
 * Bis hierher war eine Gehaltszahlung ein Klick auf „SEPA-Datei". Danach
 * wusste die Anlage nichts mehr: nicht, ob die Datei eingereicht wurde, nicht,
 * was in ihr stand, und nicht, ob sie ein zweites Mal heruntergeladen und ein
 * zweites Mal eingereicht worden ist. Für eine Bankanbindung ist das zu wenig,
 * und für eine Betriebsprüfung auch.
 *
 * WAS HIER STEHT UND WAS NICHT
 * Hier stehen die Entscheidungen: welcher Stand auf welchen folgen darf, wann
 * ein neuer Lauf einen alten ablösen darf und wann nicht, was ein Stand für
 * die einzelnen Abrechnungen bedeutet, und wann eine Bank eine Datei annimmt.
 * Kein Datenbankzugriff, keine Oberfläche — damit sich jede dieser Regeln
 * einzeln prüfen lässt.
 */

export const ZAHLLAUF_STAENDE = {
  erzeugt: 'Erzeugt',
  eingereicht: 'Bei der Bank eingereicht',
  ausgefuehrt: 'Ausgeführt',
  abgelehnt: 'Von der Bank abgelehnt',
  verworfen: 'Verworfen',
} as const

export type Zahllaufstand = keyof typeof ZAHLLAUF_STAENDE

/**
 * Welche Stände von hier aus erreichbar sind.
 *
 * `ausgefuehrt` und `abgelehnt` sind Endstände: Was die Bank getan hat, kann
 * die Anlage nicht zurücknehmen. `verworfen` gibt es nur aus `erzeugt` —
 * eine eingereichte Datei verwirft man nicht in der Software, sondern bei der
 * Bank.
 */
export function naechsteStaende(von: string): Zahllaufstand[] {
  switch (von) {
    case 'erzeugt': return ['eingereicht', 'verworfen']
    case 'eingereicht': return ['ausgefuehrt', 'abgelehnt']
    default: return []
  }
}

export function standErlaubt(von: string, nach: string): boolean {
  return naechsteStaende(von).includes(nach as Zahllaufstand)
}

/**
 * Was ein Stand des Laufs für die einzelnen Abrechnungen bedeutet.
 *
 * `null` heißt: unverändert lassen. Das ist der Normalfall — nur zwei
 * Übergänge bewegen den Stand einer Abrechnung überhaupt.
 *
 * WARUM `eingereicht` UND NICHT `ausgefuehrt` AUF „bezahlt" SETZT
 * Weil ab dem Einreichen niemand mehr dazwischenkommen soll. Wer wartet, bis
 * die Bank ausgeführt hat, lässt dazwischen ein Fenster offen, in dem
 * dieselbe Abrechnung in einen zweiten Lauf geraten kann. Lehnt die Bank ab,
 * wird es zurückgenommen — das ist der seltenere Fall und der harmlosere.
 */
export function abrechnungsstandFuer(laufStand: string): 'paid' | 'approved' | null {
  if (laufStand === 'eingereicht') return 'paid'
  if (laufStand === 'abgelehnt' || laufStand === 'verworfen') return 'approved'
  return null
}

/** Ein Lauf, der eine neue Zahlung für denselben Zeitraum blockiert. */
export const BLOCKIERT: string[] = ['eingereicht']

/** Ein Lauf, der von einem neuen abgelöst werden darf. */
export const ABLOESBAR: string[] = ['erzeugt']

export interface LaufKurz {
  kennung: string
  status: string
}

export type Entscheidung =
  /** Es gibt noch keinen Lauf für diesen Inhalt — einen neuen anlegen. */
  | { art: 'neu' }
  /** Genau dieser Lauf existiert schon — die gespeicherte Datei erneut ausgeben. */
  | { art: 'wiederholung'; kennung: string }
  /** Ein älterer Lauf wird abgelöst, weil er nur erzeugt und nie eingereicht war. */
  | { art: 'abloesen'; kennung: string }
  /** Es gibt einen eingereichten Lauf — erst klären, dann neu zahlen. */
  | { art: 'blockiert'; kennung: string; grund: string }

/**
 * Darf aus diesem Inhalt eine Zahlungsdatei entstehen?
 *
 * Die vier Fälle, und warum sie so und nicht anders entschieden werden:
 *
 * **Dieselbe Kennung, derselbe Lauf.** Dann wird die GESPEICHERTE Datei noch
 * einmal ausgegeben, nicht eine neue erzeugt. Eine neu erzeugte Datei trüge
 * einen neuen Erstellungszeitpunkt und wäre damit Byte für Byte eine andere —
 * wer zwei Dateien vergleicht, sähe Unterschiede, wo keine sind.
 *
 * **Ein Lauf im Stand „erzeugt" mit anderem Inhalt.** Er wird abgelöst. Dass
 * jemand eine Datei heruntergeladen hat, heißt nicht, dass er sie eingereicht
 * hat — der häufigste Fall ist: heruntergeladen, Fehler bemerkt, korrigiert,
 * neu heruntergeladen. Das zu blockieren wäre Schikane.
 *
 * **Ein Lauf im Stand „eingereicht".** Jetzt ist Geld unterwegs. Eine zweite
 * Datei für denselben Zeitraum ist die Vorstufe zur doppelten Gehaltszahlung,
 * und die Software darf sie nicht einfach ausgeben. Erst sagen, was aus dem
 * ersten Lauf geworden ist.
 *
 * **Abgelehnt, ausgeführt oder verworfen.** Beides keine Hürde: abgelehnt und
 * verworfen sind erledigt, und nach einer ausgeführten Zahlung ist eine
 * Nachzahlung mit anderem Inhalt ein berechtigter neuer Lauf.
 */
export function entscheideLauf(kennung: string, vorhandene: LaufKurz[]): Entscheidung {
  const gleiche = vorhandene.find(l => l.kennung === kennung && l.status !== 'verworfen')
  if (gleiche) return { art: 'wiederholung', kennung: gleiche.kennung }

  const blockierend = vorhandene.find(l => BLOCKIERT.includes(l.status))
  if (blockierend) {
    return {
      art: 'blockiert',
      kennung: blockierend.kennung,
      grund:
        `Für diesen Zeitraum ist bereits ein Zahlungslauf bei der Bank `
        + `eingereicht (${blockierend.kennung}). Solange nicht feststeht, ob er `
        + `ausgeführt oder abgelehnt wurde, entsteht keine zweite Datei — sonst `
        + `wäre die Gehaltszahlung zweimal unterwegs. Trag zuerst ein, was aus `
        + `ihm geworden ist.`,
    }
  }

  const abloesbar = vorhandene.find(l => ABLOESBAR.includes(l.status))
  if (abloesbar) return { art: 'abloesen', kennung: abloesbar.kennung }

  return { art: 'neu' }
}

/**
 * Ist dieser Tag ein Feiertag?
 *
 * WARUM OHNE BUNDESLAND STRENGER GERECHNET WIRD, NICHT LOCKERER
 * Die Feiertagsliste kennt die Länder beim vollen Namen und liefert bei einer
 * unbekannten Angabe nur die bundesweiten Tage. Für einen Standort ohne
 * hinterlegtes Bundesland — und das ist der Normalfall — hieße das: Allerheiligen
 * und Fronleichnam fielen durch, die Bank wiese die Datei zurück.
 *
 * Deshalb gilt hier ohne Angabe JEDER Tag als Feiertag, der irgendwo in
 * Deutschland einer ist. Das kostet im schlimmsten Fall einen Tag Verzögerung
 * und erspart eine zurückgewiesene Gehaltszahlung. Von beiden Fehlern ist das
 * der harmlosere.
 */
function istFeiertag(datum: string, bundesland?: string | null): boolean {
  if (bundesland) return isPublicHoliday(datum, bundesland)
  return GERMAN_STATES.some(land => isPublicHoliday(datum, land))
}

/**
 * Das gewünschte Ausführungsdatum.
 *
 * Banken nehmen kein Datum an, das auf ein Wochenende oder einen Feiertag
 * fällt — und sie brauchen Vorlauf. Zwei Tage sind die übliche Angabe.
 *
 * WARUM DIE FEIERTAGE DAZUGEHÖREN
 * Vorher wurden nur Samstag und Sonntag übersprungen. Am 1. Mai, am 3.
 * Oktober oder an Weihnachten stand damit ein Datum in der Datei, das die
 * Bank zurückweist — und zwar erst beim Einreichen, also genau dann, wenn
 * niemand mehr Zeit hat.
 *
 * Maßgeblich ist das Bundesland des Arbeitgebers: Fronleichnam ist in
 * Nordrhein-Westfalen ein Feiertag und in Berlin nicht.
 */
export function naechsterBankarbeitstag(
  ab: Date, vorlaufTage = 2, bundesland?: string | null,
): string {
  const d = new Date(Date.UTC(
    ab.getUTCFullYear(), ab.getUTCMonth(), ab.getUTCDate() + vorlaufTage,
  ))
  // Zwei Wochen sind mehr als jede Feiertagskette in Deutschland.
  for (let i = 0; i < 14; i++) {
    const tag = d.getUTCDay()
    const text = d.toISOString().slice(0, 10)
    if (tag !== 0 && tag !== 6 && !istFeiertag(text, bundesland)) return text
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return d.toISOString().slice(0, 10)
}

/**
 * Ist ein vom Anwender gewünschtes Datum brauchbar?
 *
 * Ein Wunschdatum wird nicht stillschweigend verschoben — sonst zahlt jemand
 * an einem anderen Tag als gedacht. Es wird abgelehnt, mit Begründung.
 */
export function pruefeAusfuehrung(
  datum: string, bundesland?: string | null,
): { ok: true } | { ok: false; grund: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return { ok: false, grund: 'Das Datum muss als JJJJ-MM-TT angegeben werden.' }
  }
  const d = new Date(`${datum}T00:00:00.000Z`)
  // Der Rückweg ist die eigentliche Prüfung: `2026-02-30` ergibt in
  // JavaScript den 2. März statt eines Fehlers. Wer nur auf „ungültig"
  // prüft, lässt ein Datum durch, das zwei Tage später liegt als gemeint.
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== datum) {
    return { ok: false, grund: 'Dieses Datum gibt es nicht.' }
  }
  const tag = d.getUTCDay()
  if (tag === 0 || tag === 6) {
    return { ok: false, grund: 'An einem Wochenende führt keine Bank aus.' }
  }
  if (isPublicHoliday(datum, bundesland ?? undefined)) {
    return { ok: false, grund: 'Das ist ein gesetzlicher Feiertag.' }
  }
  return { ok: true }
}
