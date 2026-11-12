/**
 * §149 Nachweise anfordern — die Regeln dahinter.
 *
 * DER ABLAUF IN EINEM SATZ
 * Der Betrieb fordert etwas an, der Mensch lädt es hoch, der Betrieb sieht es
 * sich an und nimmt es ab — oder fragt nach, und dann geht es noch einmal von
 * vorn.
 *
 * WARUM DAS EIN ZUSTANDSAUTOMAT IST UND KEINE FREIE UMSCHALTUNG
 * Weil jeder Schritt etwas anderes auslöst: Beim Einreichen wird der Betrieb
 * benachrichtigt, bei der Rückfrage der Mensch, bei der Abnahme wird die Frist
 * erfüllt. Ließe sich jeder Stand von jedem aus setzen, gäbe es Wege, auf
 * denen nichts davon passiert — eine Anforderung, die erledigt aussieht, ohne
 * dass je etwas eingereicht wurde.
 *
 * DIE EINE REGEL, DIE ÜBER ALLEM STEHT
 * Abnehmen darf nur der Betrieb, einreichen nur der Mensch. Das ist der ganze
 * Sinn der Sache: Wer sich seinen Nachweis selbst abnehmen kann, braucht keinen.
 */

export const STAENDE = {
  offen: 'Angefordert',
  eingereicht: 'Eingereicht',
  rueckfrage: 'Rückfrage',
  erledigt: 'Erledigt',
  zurueckgezogen: 'Zurückgezogen',
} as const

export type Stand = keyof typeof STAENDE

/** Wer einen Stand setzen darf und von wo aus er erreichbar ist. */
interface Uebergang {
  von: Stand[]
  /** mitarbeiter | betrieb */
  durch: ('mitarbeiter' | 'betrieb')[]
}

export const UEBERGAENGE: Record<Stand, Uebergang> = {
  // Der Anfang. Entsteht durch das Anlegen, nicht durch einen Wechsel.
  offen: { von: [], durch: [] },
  // Einreichen kann nur der, von dem etwas verlangt wird. Auch aus einer
  // Rückfrage heraus — das ist der häufigste Fall überhaupt.
  eingereicht: { von: ['offen', 'rueckfrage'], durch: ['mitarbeiter'] },
  // Nachfragen kann nur der Betrieb, und nur zu etwas, das vorliegt.
  rueckfrage: { von: ['eingereicht'], durch: ['betrieb'] },
  // Abnehmen kann nur der Betrieb. Aus 'offen' heraus auch — er hat den
  // Nachweis vielleicht auf Papier auf dem Tisch liegen.
  erledigt: { von: ['offen', 'eingereicht', 'rueckfrage'], durch: ['betrieb'] },
  // Zurückziehen kann nur, wer angefordert hat.
  zurueckgezogen: { von: ['offen', 'eingereicht', 'rueckfrage'], durch: ['betrieb'] },
}

export type Seite = 'mitarbeiter' | 'betrieb'

export function darfWechseln(von: string, nach: string, seite: Seite): boolean {
  const ziel = UEBERGAENGE[nach as Stand]
  if (!ziel) return false
  return ziel.von.includes(von as Stand) && ziel.durch.includes(seite)
}

/** Was passiert, wenn dieser Wechsel nicht erlaubt ist — im Klartext. */
export function warumNicht(von: string, nach: string, seite: Seite): string {
  const ziel = UEBERGAENGE[nach as Stand]
  if (!ziel) return `Den Stand „${nach}“ gibt es nicht.`
  if (von === 'erledigt') {
    return 'Diese Anforderung ist abgenommen. Wird später noch einmal etwas '
      + 'gebraucht, entsteht eine neue — die alte bleibt als Nachweis stehen.'
  }
  if (von === 'zurueckgezogen') {
    return 'Diese Anforderung wurde zurückgezogen.'
  }
  if (!ziel.durch.includes(seite)) {
    return seite === 'mitarbeiter'
      ? 'Das entscheidet der Betrieb. Du kannst einreichen — abnehmen muss es '
        + 'jemand anderes.'
      : 'Einreichen kann nur die Person selbst.'
  }
  return `Aus „${STAENDE[von as Stand] ?? von}“ heraus geht das nicht.`
}

/** Ein offener Vorgang ist einer, an dem noch jemand etwas tun muss. */
export const OFFEN: Stand[] = ['offen', 'eingereicht', 'rueckfrage']

/** Bei wem liegt der Ball? Das ist die Frage, die jede Liste beantworten soll. */
export function amZug(status: string): Seite | null {
  if (status === 'offen' || status === 'rueckfrage') return 'mitarbeiter'
  if (status === 'eingereicht') return 'betrieb'
  return null
}

export interface Lage {
  stand: Stand
  text: string
  /** Was als Nächstes zu tun ist — aus Sicht dessen, der hinschaut */
  hinweis: string
  /** Überfällig? Nur solange noch etwas zu tun ist. */
  ueberfaellig: boolean
  /** Tage bis zur Frist; negativ heißt überschritten */
  tageBis: number | null
}

export function lage(
  a: { status: string; fristBis?: Date | string | null },
  fuer: Seite,
  heute = new Date(),
): Lage {
  const stand = (a.status in STAENDE ? a.status : 'offen') as Stand
  const frist = a.fristBis ? new Date(a.fristBis) : null
  const tageBis = frist
    ? Math.ceil((frist.getTime() - heute.getTime()) / 86_400_000)
    : null
  const offen = OFFEN.includes(stand)

  const hinweis = stand === 'offen'
    ? (fuer === 'mitarbeiter' ? 'Bitte hochladen und einreichen.'
      : 'Wartet auf die Person.')
    : stand === 'eingereicht'
      ? (fuer === 'betrieb' ? 'Liegt zur Prüfung vor.'
        : 'Eingereicht — der Betrieb sieht es sich an.')
      : stand === 'rueckfrage'
        ? (fuer === 'mitarbeiter' ? 'Es gibt eine Rückfrage dazu.'
          : 'Rückfrage gestellt, wartet auf Antwort.')
        : stand === 'erledigt' ? 'Abgenommen.'
          : 'Zurückgezogen.'

  return {
    stand,
    text: STAENDE[stand],
    hinweis,
    ueberfaellig: offen && tageBis !== null && tageBis < 0,
    tageBis,
  }
}

/**
 * Wann darf erneut erinnert werden?
 *
 * Eine tägliche Mahnung liest niemand mehr, und eine, die gar nicht kommt,
 * auch nicht. Sieben Tage sind der Abstand, bei dem eine Erinnerung noch als
 * Hilfe ankommt und nicht als Drangsal.
 */
export const ERINNERUNG_ABSTAND_TAGE = 7

export function darfErinnern(
  a: { status: string; erinnertAm?: Date | string | null },
  heute = new Date(),
): boolean {
  if (!OFFEN.includes(a.status as Stand)) return false
  if (a.status === 'eingereicht') return false // Da ist der Betrieb am Zug
  if (!a.erinnertAm) return true
  const her = (heute.getTime() - new Date(a.erinnertAm).getTime()) / 86_400_000
  return her >= ERINNERUNG_ABSTAND_TAGE
}

/** Die Sortierung einer Liste: Dringendes zuerst. */
export const DRINGLICHKEIT: Record<Stand, number> = {
  rueckfrage: 4,
  offen: 3,
  eingereicht: 2,
  erledigt: 1,
  zurueckgezogen: 0,
}

export function reihenfolge(
  a: { status: string; fristBis?: Date | string | null },
  b: { status: string; fristBis?: Date | string | null },
): number {
  const dringend = (DRINGLICHKEIT[b.status as Stand] ?? 0)
    - (DRINGLICHKEIT[a.status as Stand] ?? 0)
  if (dringend !== 0) return dringend
  // Bei gleichem Stand zuerst, was am ehesten fällig ist. Ohne Frist ganz
  // hinten — sie drängt ja nicht.
  const fa = a.fristBis ? new Date(a.fristBis).getTime() : Infinity
  const fb = b.fristBis ? new Date(b.fristBis).getTime() : Infinity
  return fa - fb
}
