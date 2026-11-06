/**
 * §147 Betriebliches Eingliederungsmanagement — §167 Abs. 2 SGB IX.
 *
 * DER GESETZESTEXT, UM DEN ES GEHT
 * „Sind Beschäftigte innerhalb eines Jahres länger als sechs Wochen
 * ununterbrochen oder wiederholt arbeitsunfähig, klärt der Arbeitgeber […] die
 * Möglichkeiten, wie die Arbeitsunfähigkeit möglichst überwunden werden kann."
 *
 * Drei Wörter darin entscheiden alles, und jedes wird gern falsch gelesen:
 *
 *   INNERHALB EINES JAHRES  Zwölf rollende Monate, nicht das Kalenderjahr. Wer
 *   im November vier Wochen und im Februar drei Wochen fehlt, ist über der
 *   Schwelle — obwohl in keinem Kalenderjahr sechs Wochen zusammenkommen.
 *
 *   ODER WIEDERHOLT  Es müssen keine sechs Wochen am Stück sein. Einzelne Tage
 *   zählen zusammen.
 *
 *   LÄNGER ALS  Bei genau 42 Tagen ist die Schwelle noch NICHT überschritten.
 *   Erst der dreiundvierzigste Tag löst aus.
 *
 * WARUM WIR DAS ÜBERHAUPT KÖNNEN
 * Weil die Fehlzeiten schon im System liegen. Ein getrenntes Personalwerkzeug
 * müsste sie abtippen lassen — und dann rechnet es niemand aus, und dann fällt
 * es erst auf, wenn ein Gericht danach fragt.
 *
 * WAS DAS PROGRAMM NICHT TUT
 * Es entscheidet nichts. Es rechnet die Schwelle aus und sagt: hier ist ein
 * Angebot fällig. Das Angebot macht ein Mensch, die Teilnahme ist für die
 * Beschäftigte freiwillig, und eine Ablehnung ist ein völlig zulässiges
 * Ergebnis — sie wird festgehalten, weil sie später der Nachweis ist, dass
 * angeboten wurde.
 *
 * DIESE DATEN SIND BESONDERS
 * Gesundheitsdaten nach Art. 9 DSGVO. Deshalb steht hier nur, WIE VIELE Tage
 * und WAS im Verfahren geschah — niemals eine Diagnose. Und deshalb ist die
 * Sichtbarkeit standardmäßig auf die Unternehmensebene beschränkt.
 */

/** Arten von Abwesenheit, die auf die Schwelle einzahlen. */
export const AU_ARTEN = ['krankheit', 'krank', 'sick']

/**
 * Mehr als sechs Wochen. Sechs Wochen sind 42 Kalendertage — ausgelöst wird
 * beim dreiundvierzigsten.
 */
export const SCHWELLE_TAGE = 42

/** Das rollende Fenster in Tagen. */
export const FENSTER_TAGE = 365

export interface Fehlzeit {
  type: string
  startDate: string
  endDate: string
}

const MS_TAG = 86_400_000

function tagAlsZahl(iso: string): number | null {
  const d = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(d) ? null : Math.floor(d / MS_TAG)
}

export function istArbeitsunfaehig(type: string): boolean {
  return AU_ARTEN.includes((type ?? '').toLowerCase())
}

/**
 * Wie viele Kalendertage arbeitsunfähig im rollenden Fenster?
 *
 * Gezählt werden TAGE, nicht Zeiträume. Zwei Krankmeldungen, die sich
 * überschneiden — etwa eine Folgebescheinigung, die einen Tag zurückreicht —
 * dürfen nicht doppelt zählen, sonst löst die Schwelle zu früh aus. Und eine
 * Fehlzeit, die vor dem Fenster beginnt, zählt nur mit ihrem Teil darin.
 */
export function auTageImFenster(
  fehlzeiten: Fehlzeit[],
  bis: Date = new Date(),
  fensterTage: number = FENSTER_TAGE,
): number {
  const ende = Math.floor(bis.getTime() / MS_TAG)
  const start = ende - fensterTage + 1

  const tage = new Set<number>()
  for (const f of fehlzeiten) {
    if (!istArbeitsunfaehig(f.type)) continue
    const von = tagAlsZahl(f.startDate)
    const bisTag = tagAlsZahl(f.endDate)
    if (von === null || bisTag === null || bisTag < von) continue
    for (let t = Math.max(von, start); t <= Math.min(bisTag, ende); t++) {
      tage.add(t)
    }
  }
  return tage.size
}

/** Ist die Schwelle überschritten? */
export function schwelleUeberschritten(tage: number): boolean {
  return tage > SCHWELLE_TAGE
}

// ── Der Stand eines Vorgangs ───────────────────────────────────────────────

export type BemStand =
  /** Unter der Schwelle — nichts zu tun */
  | 'unauffaellig'
  /** Schwelle überschritten, es wurde noch nichts angeboten */
  | 'faellig'
  /** Angeboten, die Person hat noch nicht geantwortet */
  | 'angeboten'
  /** Die Person hat zugestimmt, das Verfahren läuft */
  | 'laeuft'
  /** Die Person hat abgelehnt — ein zulässiges Ergebnis */
  | 'abgelehnt'
  /** Abgeschlossen */
  | 'abgeschlossen'

export const STAND_TEXT: Record<BemStand, string> = {
  unauffaellig: 'Unter der Schwelle',
  faellig: 'Angebot fällig',
  angeboten: 'Angeboten, Antwort offen',
  laeuft: 'Verfahren läuft',
  abgelehnt: 'Abgelehnt',
  abgeschlossen: 'Abgeschlossen',
}

export interface Vorgang {
  angebotenAm?: Date | string | null
  antwort?: string | null
  abgeschlossenAm?: Date | string | null
}

/**
 * Wie steht es um diese Person?
 *
 * Die Reihenfolge ist wichtig: Ein abgeschlossener Vorgang bleibt
 * abgeschlossen, auch wenn die Tage weiter hochzählen — sonst stünde jemand
 * nach jedem einzelnen Krankheitstag wieder auf der Liste, obwohl das
 * Verfahren gerade erst gelaufen ist.
 */
export function bemStand(tage: number, vorgang?: Vorgang | null): BemStand {
  if (vorgang?.abgeschlossenAm) return 'abgeschlossen'
  if (vorgang?.antwort === 'abgelehnt') return 'abgelehnt'
  if (vorgang?.antwort === 'zugestimmt') return 'laeuft'
  if (vorgang?.angebotenAm) return 'angeboten'
  return schwelleUeberschritten(tage) ? 'faellig' : 'unauffaellig'
}

/**
 * Ab wann ist ein abgeschlossener Vorgang wieder zu betrachten?
 *
 * Das Gesetz sagt dazu nichts. Die Praxis: Nach einem Abschluss beginnt die
 * Betrachtung von vorn, sobald die Schwelle mit NEUEN Fehlzeiten wieder
 * erreicht wird. Deshalb wird ab dem Abschluss neu gezählt, nicht ab heute
 * minus zwölf Monate — sonst löste derselbe Zeitraum ein zweites Mal aus.
 */
export function zaehlungAb(vorgang?: Vorgang | null, fenster = FENSTER_TAGE): Date {
  const grenze = new Date(Date.now() - fenster * MS_TAG)
  const abschluss = vorgang?.abgeschlossenAm
    ? new Date(vorgang.abgeschlossenAm)
    : null
  if (abschluss && abschluss > grenze) return abschluss
  return grenze
}

export interface Lage {
  stand: BemStand
  tage: number
  /** Wie viele Tage bis zur Schwelle — negativ, wenn schon überschritten */
  bisSchwelle: number
  text: string
  /** Was als Nächstes zu tun ist. Leer, wenn nichts ansteht. */
  naechsterSchritt: string
}

export function lage(tage: number, vorgang?: Vorgang | null): Lage {
  const stand = bemStand(tage, vorgang)
  const bisSchwelle = SCHWELLE_TAGE + 1 - tage

  const schritt: Record<BemStand, string> = {
    unauffaellig: '',
    faellig: 'Ein BEM-Angebot ist gesetzlich vorgeschrieben (§167 Abs. 2 SGB IX).',
    angeboten: 'Auf die Antwort warten. Ohne Zustimmung findet kein BEM statt.',
    laeuft: 'Das Verfahren läuft — Ergebnis festhalten, wenn es beendet ist.',
    abgelehnt: 'Nichts weiter zu tun. Die Ablehnung ist der Nachweis, dass '
      + 'angeboten wurde.',
    abgeschlossen: '',
  }

  return {
    stand,
    tage,
    bisSchwelle,
    text: stand === 'unauffaellig'
      ? `${tage} Tage arbeitsunfähig in zwölf Monaten`
      : `${tage} Tage arbeitsunfähig in zwölf Monaten — Schwelle bei `
        + `${SCHWELLE_TAGE + 1} Tagen`,
    naechsterSchritt: schritt[stand],
  }
}

/**
 * Die Ablehnung braucht keine Begründung — der Abschluss schon.
 *
 * Wer ablehnt, muss das nicht erklären; das Verfahren ist freiwillig. Wer es
 * abschließt, muss dagegen sagen, was herausgekommen ist: Ohne Ergebnis wäre
 * das Verfahren nicht durchgeführt, sondern nur abgehakt — und genau das prüft
 * ein Arbeitsgericht später.
 */
export function abschlussBrauchtErgebnis(): boolean {
  return true
}

export const ANTWORTEN = ['offen', 'zugestimmt', 'abgelehnt'] as const
export type Antwort = (typeof ANTWORTEN)[number]
