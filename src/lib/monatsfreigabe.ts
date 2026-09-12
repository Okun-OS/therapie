/**
 * §136 Kein Lohn ohne freigegebenen Monat.
 *
 * Das ist der Preis für den Vorteil. Weil Zeiterfassung und Lohnabrechnung bei
 * uns zusammenhängen, muss niemand mehr eintippen „fünf Stunden nachts, zehn
 * am Sonntag, drei Vierundzwanzig-Stunden-Dienste". Das System weiß es, weil
 * der Mitarbeiter gestempelt hat, und rechnet es selbst in Geld um.
 *
 * Genau deshalb darf aber nicht abgerechnet werden, solange die Zeiten noch
 * wackeln. Eine Schicht, die am Abend nachgetragen wird, wäre sonst ein
 * Zuschlag, der nach der Abrechnung entsteht — und dann steht auf dem Beleg
 * eine Zahl, die morgen nicht mehr stimmt.
 *
 * DIE REGEL
 * ---------
 * Die Standortleitung schließt den Monat ab und gibt ihn frei. Erst dann fließt
 * er in die Abrechnung. Mit der Freigabe sind die Zeiten gesperrt — sie können
 * sich danach nicht mehr ändern, und das ist die Zusage, auf der die Abrechnung
 * ruht.
 *
 * WO DIE REGEL NICHT GREIFT
 * -------------------------
 * Wer ein festes Gehalt bezieht und in dem Monat gar keine Zeiten erfasst hat,
 * hat auch nichts freizugeben. Ihn zu blockieren wäre keine Sorgfalt, sondern
 * eine Schikane: Es gäbe nichts, was durch die Freigabe sicherer würde.
 *
 * Umgekehrt gilt für Stundenlöhner die Regel IMMER — bei ihnen ist die
 * erfasste Zeit nicht nur Grundlage der Zuschläge, sondern des Entgelts selbst.
 */

import { prisma } from './prisma'

/** Status eines Monatsabschlusses, bei dem abgerechnet werden darf. */
export const FREIGEGEBEN = 'freigegeben'

export type FreigabeGrund =
  /** Der Monat ist von der Standortleitung freigegeben */
  | 'freigegeben'
  /** Es gibt nichts freizugeben: festes Gehalt, keine erfassten Zeiten */
  | 'ohne_zeitbezug'
  /** Ein Abschluss liegt vor, ist aber noch nicht freigegeben */
  | 'nicht_freigegeben'
  /** Es gibt Zeiten, aber gar keinen Abschluss */
  | 'kein_abschluss'

export interface Freigabelage {
  frei: boolean
  grund: FreigabeGrund
  /** Ein Satz, der in der Oberfläche steht */
  text: string
  /** Der Status des Abschlusses, falls es einen gibt */
  abschlussStatus?: string | null
}

export interface FreigabeEingabe {
  /** Status des Monatsabschlusses, oder null wenn es keinen gibt */
  abschlussStatus: string | null
  /** Erfasste Zeiten im Monat */
  hatZeiten: boolean
  /** stunde | monat */
  lohnart?: string | null
}

/**
 * Darf für diesen Monat abgerechnet werden?
 *
 * Bewusst als reine Funktion, damit die Regel prüfbar ist, ohne eine Datenbank
 * zu brauchen — sie entscheidet über Geld und gehört deshalb zu den Stellen,
 * die man einzeln nachrechnen können muss.
 */
export function freigabelage(e: FreigabeEingabe): Freigabelage {
  if (e.abschlussStatus === FREIGEGEBEN) {
    return {
      frei: true, grund: 'freigegeben',
      abschlussStatus: e.abschlussStatus,
      text: 'Der Monat ist von der Standortleitung freigegeben.',
    }
  }

  const stundenlohn = e.lohnart === 'stunde'

  if (!e.hatZeiten && !stundenlohn) {
    return {
      frei: true, grund: 'ohne_zeitbezug',
      abschlussStatus: e.abschlussStatus ?? null,
      text: 'Festes Gehalt ohne erfasste Zeiten in diesem Monat — es gibt nichts freizugeben.',
    }
  }

  if (e.abschlussStatus) {
    return {
      frei: false, grund: 'nicht_freigegeben',
      abschlussStatus: e.abschlussStatus,
      text: `Der Monatsabschluss steht auf „${e.abschlussStatus}" und ist noch nicht `
        + 'freigegeben. Solange können sich die Zeiten noch ändern.',
    }
  }

  return {
    frei: false, grund: 'kein_abschluss',
    abschlussStatus: null,
    text: stundenlohn && !e.hatZeiten
      ? 'Bei Stundenlohn ist die erfasste Zeit die Grundlage des Entgelts. Ohne '
        + 'freigegebenen Monatsabschluss wird nicht abgerechnet.'
      : 'Für diesen Monat sind Zeiten erfasst, aber es gibt keinen freigegebenen '
        + 'Monatsabschluss. Die Standortleitung muss ihn zuerst prüfen und freigeben.',
  }
}

/**
 * Die Lage für mehrere Mitarbeiter auf einmal.
 *
 * Zwei Abfragen für den ganzen Standort statt zwei je Person — der
 * Abrechnungslauf geht sonst bei fünfzig Mitarbeitern hundertmal zur Datenbank.
 */
export async function freigabelagen(
  mitarbeiter: { employeeId: string; lohnart?: string | null }[],
  year: number,
  month: number,
): Promise<Map<string, Freigabelage>> {
  const ergebnis = new Map<string, Freigabelage>()
  if (mitarbeiter.length === 0) return ergebnis

  const ids = mitarbeiter.map(m => m.employeeId)
  const mm = String(month).padStart(2, '0')
  const von = `${year}-${mm}-01`
  const bis = `${year}-${mm}-31`

  const [abschluesse, mitZeiten] = await Promise.all([
    prisma.monthlyClosing.findMany({
      where: { employeeId: { in: ids }, year, month },
      select: { employeeId: true, status: true },
    }),
    // Nur die Frage, OB es Zeiten gibt — die Zeiten selbst holt die Abrechnung.
    prisma.timeLog.groupBy({
      by: ['employeeId'],
      where: { employeeId: { in: ids }, date: { gte: von, lte: bis } },
      _count: { _all: true },
    }),
  ])

  const status = new Map(abschluesse.map(a => [a.employeeId, a.status]))
  const hatZeiten = new Set(mitZeiten.map(z => z.employeeId))

  for (const m of mitarbeiter) {
    ergebnis.set(m.employeeId, freigabelage({
      abschlussStatus: status.get(m.employeeId) ?? null,
      hatZeiten: hatZeiten.has(m.employeeId),
      lohnart: m.lohnart,
    }))
  }
  return ergebnis
}
