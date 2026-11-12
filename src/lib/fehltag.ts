import { AU_ARTEN } from './bem'

/**
 * §287 Was an einem Tag anstelle des Dienstes gilt — an einer Stelle.
 *
 * GEMELDET, vom Telefon: „Er hat sich krank gemeldet vom 11. bis zum 15. und
 * hatte am 11., 12. und 13. einen Dienst. Und am 14., 15. hat er frei gehabt.
 * An den Tagen, wo er frei hatte — Samstag, Sonntag — wird krank eingetragen.
 * Und am 11., 12. und 13., wo er jeden Tag einen Tagdienst hatte, bleiben
 * seine Dienste ganz normal bestehen. Da wechselt er nicht auf krank."
 *
 * NACHGESTELLT UND BESTÄTIGT, wörtlich dasselbe Bild:
 *
 *     Mi 11   Frühdienst 8 · bestätigt · 06:00 – 14:30 Uhr
 *     Do 12   Frühdienst 8 · bestätigt · 06:00 – 14:30 Uhr
 *     Fr 13   Frühdienst 8 · bestätigt · 06:00 – 14:30 Uhr
 *     Sa 14   Krankgemeldet — An diesem Tag stand kein Dienst an
 *     So 15   Krankgemeldet — An diesem Tag stand kein Dienst an
 *
 * DIE URSACHE war eine einzige Zeile im eigenen Dienstplan des Mitarbeiters:
 *
 *     const ausfall = entry ? null : ausfallAmTag(dateStr)
 *
 * „Steht ein Dienst da, frag gar nicht erst nach der Krankmeldung." Damit
 * konnte die Krankmeldung nur an den Tagen erscheinen, an denen ohnehin nichts
 * geplant war — also genau dort, wo sie niemanden interessiert, und nirgends
 * dort, wo sie zählt. Gemeldet wurde es als „funktioniert nicht zuverlässig";
 * tatsächlich hat es nie anders gearbeitet.
 *
 * In der Leitungsansicht stimmte es seit §227. Das ist das dritte Mal nach
 * §266 und §284, dass dieselbe Frage an zwei Stellen beantwortet wurde und
 * die Antwort des Mitarbeiters die falsche war. Deshalb steht sie jetzt hier.
 *
 * WAS DIE ANTWORT NICHT ENTHÄLT
 * Die gutgeschriebenen Stunden. Die rechnet `ausfallstunden.ts`, und sie
 * braucht Angaben über die Person, die hier nichts zu suchen haben. Diese
 * Datei beantwortet nur: Was steht an diesem Tag anstelle des Dienstes?
 */

/** Woraus der Fehltag kommt — eine Fehlzeit oder ein genehmigter Urlaub. */
export type Fehlquelle = 'fehlzeit' | 'urlaub'

export interface Fehltag {
  /** Grob — für Farbe und Symbol. */
  art: 'krank' | 'urlaub' | 'abwesend'
  /** Wie es dasteht: „Krankgemeldet", „Urlaub", „Fortbildung" … */
  text: string
  quelle: Fehlquelle
  /** Die Rohform aus der Datenbank, falls jemand genauer hinsehen will. */
  typ: string
  /** Von wann bis wann der Eintrag gilt — für „krankgemeldet bis Sonntag". */
  von: string
  bis: string
}

export interface Fehlzeiteintrag {
  type: string
  startDate: string
  endDate: string
  /**
   * Eine abgelehnte Fehlzeit ist keine. Alles andere zählt — auch „offen":
   * Wer sich heute krankmeldet, ist heute krank und nicht erst, wenn die
   * Leitung es bestätigt hat.
   */
  verificationStatus?: string | null
}

export interface Urlaubseintrag {
  status: string
  startDate: string
  endDate: string
}

/**
 * Wie eine Abwesenheit heißt.
 *
 * „Abwesend" steht dort, wo die Art nichts Genaueres sagt — besser als ein
 * Datenbankwort wie „unentschuldigt" mitten im Plan. Die Liste stand bis §287
 * in `admin/schedule/page.tsx`; dort war sie für die Leitung gedacht und für
 * den Mitarbeiter gar nicht da.
 */
export const ABWESENHEIT_TEXT: Record<string, string> = {
  krankheit: 'Krankgemeldet',
  krank: 'Krankgemeldet',
  sick: 'Krankgemeldet',
  fortbildung: 'Fortbildung',
  unentschuldigt: 'Fehlt',
  entschuldigt: 'Abwesend',
  sonstige: 'Abwesend',
}

/** Dieselbe Angabe knapp — für eine Zelle im Monatsraster. */
export const ABWESENHEIT_KURZ: Record<string, string> = {
  krankheit: 'Krank',
  krank: 'Krank',
  sick: 'Krank',
  fortbildung: 'Fortb.',
  unentschuldigt: 'Fehlt',
  entschuldigt: 'Abw.',
  sonstige: 'Abw.',
}

function imZeitraum(tag: string, von: string, bis: string): boolean {
  return von <= tag && tag <= bis
}

/**
 * Was an diesem Tag anstelle eines Dienstes gilt — oder `null`.
 *
 * Die Reihenfolge ist Absicht: Eine Fehlzeit schlägt den Urlaub. Wer im
 * Urlaub krank wird, ist krank; die Tage werden ihm nach § 9 BUrlG nicht auf
 * den Urlaub angerechnet. Steht beides für denselben Tag, ist die
 * Krankmeldung die jüngere und genauere Auskunft.
 */
export function fehltagAm(
  tag: string,
  quellen: {
    fehlzeiten?: Fehlzeiteintrag[] | null
    urlaube?: Urlaubseintrag[] | null
  },
): Fehltag | null {
  const fehlzeit = (quellen.fehlzeiten ?? []).find(f =>
    (f.verificationStatus ?? '') !== 'abgelehnt'
    && imZeitraum(tag, f.startDate, f.endDate))

  if (fehlzeit) {
    const typ = (fehlzeit.type ?? '').toLowerCase()
    return {
      art: AU_ARTEN.includes(typ) ? 'krank' : 'abwesend',
      text: ABWESENHEIT_TEXT[typ] ?? 'Abwesend',
      quelle: 'fehlzeit',
      typ,
      von: fehlzeit.startDate,
      bis: fehlzeit.endDate,
    }
  }

  const urlaub = (quellen.urlaube ?? []).find(u =>
    u.status === 'approved' && imZeitraum(tag, u.startDate, u.endDate))
  if (urlaub) {
    return {
      art: 'urlaub', text: 'Urlaub', quelle: 'urlaub', typ: 'urlaub',
      von: urlaub.startDate, bis: urlaub.endDate,
    }
  }

  return null
}

/** Die knappe Form für enge Stellen — Monatsraster, Kacheln. */
export function fehltagKurz(fehltag: Fehltag): string {
  return fehltag.quelle === 'urlaub' ? 'Urlaub' : ABWESENHEIT_KURZ[fehltag.typ] ?? 'Abw.'
}
