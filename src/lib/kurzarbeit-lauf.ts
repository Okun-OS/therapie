import { prisma } from './prisma'
import { rechne, runde, type KugPerson, type KugErgebnis } from './kurzarbeit'
import type { Steuerklasse } from './lohnsteuer-pap'
import type { Lohnjahr } from './lohnjahre'

/**
 * §157 Kurzarbeit an der Abrechnung.
 *
 * Die Rechnung steht in `kurzarbeit.ts` und ist ohne Datenbank prüfbar. Hier
 * steht nur: Gibt es für diesen Monat einen Eintrag, und gehört er zu einer
 * Anzeige, die zu diesem Monat passt.
 *
 * WARUM DIE ANZEIGE MITGEPRÜFT WIRD
 * Weil es ohne sie kein Geld gibt. §99 Abs. 2 SGB III: Kurzarbeitergeld wird
 * frühestens von dem Kalendermonat an geleistet, in dem die Anzeige bei der
 * Agentur eingegangen ist. Wer für Januar abrechnet und erst im Februar
 * angezeigt hat, zahlt aus eigener Tasche. Das Programm rechnet deshalb, sagt
 * es aber deutlich — es verweigert nicht, weil der Betrieb das Geld trotzdem
 * freiwillig zahlen darf.
 */

export interface KurzarbeitWerte {
  kug: number
  fiktivEntgelt: number
  svAgFiktiv: number
  /**
   * Das tatsächlich erzielte Bruttoarbeitsentgelt des Monats. Es tritt in der
   * Abrechnung an die Stelle des vertraglichen Entgelts — sonst zahlte der
   * Betrieb das volle Gehalt UND das Kurzarbeitergeld.
   */
  istEntgelt: number | null
  hinweise: string[]
  ergebnis: KugErgebnis | null
  /** Die Kennung des Monatseintrags, damit der Lauf das Ergebnis zurückschreibt */
  monatId: string | null
}

const LEER: KurzarbeitWerte = {
  kug: 0, fiktivEntgelt: 0, svAgFiktiv: 0, istEntgelt: null,
  hinweise: [], ergebnis: null, monatId: null,
}

export interface KurzarbeitStamm {
  steuerklasse?: number | null
  kinderfreibetraege?: number | null
  versicherungsart?: string | null
  zusatzbeitrag?: number | null
  bundesland?: string | null
  hatKinder?: boolean | null
  kinderUnter25?: number | null
  rentenversicherungspflichtig?: boolean | null
}

/** Der erste Tag des Monats, in dem die Anzeige einging. */
function anzeigeMonat(angezeigtAm: string): string {
  return `${angezeigtAm.slice(0, 7)}-01`
}

/**
 * Was in diesem Monat an Kurzarbeitergeld anfällt.
 *
 * Läuft keine Kurzarbeit, wird nichts gerechnet und nichts nachgeschlagen.
 */
export async function kurzarbeitFuerMonat(
  employeeId: string,
  customerId: string,
  jahr: number,
  monat: number,
  lohnjahr: Lohnjahr,
  stamm: KurzarbeitStamm,
): Promise<KurzarbeitWerte> {
  const eintrag = await prisma.kurzarbeitMonat.findUnique({
    where: { employeeId_jahr_monat: { employeeId, jahr, monat } },
  })
  if (!eintrag || eintrag.customerId !== customerId) return LEER

  const anzeige = await prisma.kurzarbeit.findUnique({
    where: { id: eintrag.kurzarbeitId },
  })

  const hinweise: string[] = []
  const monatsErster = `${jahr}-${String(monat).padStart(2, '0')}-01`
  const monatsletzter = new Date(Date.UTC(jahr, monat, 0)).toISOString().slice(0, 10)

  if (!anzeige) {
    hinweise.push(
      'Zu diesem Monat gibt es keine Anzeige über Arbeitsausfall mehr. '
      + 'Ohne sie besteht kein Anspruch (§99 SGB III).',
    )
  } else {
    if (!anzeige.aktiv) {
      hinweise.push(
        `Die Anzeige „${anzeige.bezeichnung}" ist nicht mehr aktiv. `
        + 'Gerechnet wird trotzdem — geprüft gehört, ob der Monat noch dazu '
        + 'gehört.',
      )
    }
    // §99 Abs. 2 SGB III: frühestens ab dem Monat des Eingangs bei der Agentur.
    if (anzeigeMonat(anzeige.angezeigtAm) > monatsErster) {
      hinweise.push(
        `Die Anzeige ging erst am ${anzeige.angezeigtAm} bei der Agentur ein. `
        + 'Kurzarbeitergeld gibt es frühestens ab dem Kalendermonat des '
        + 'Eingangs (§99 Abs. 2 SGB III) — für diesen Monat wird '
        + 'voraussichtlich nicht erstattet.',
      )
    }
    if (anzeige.bis && anzeige.bis < monatsErster) {
      hinweise.push(
        `Der angezeigte Zeitraum endete am ${anzeige.bis}, dieser Monat liegt `
        + 'danach.',
      )
    }
    if (anzeige.von > monatsletzter) {
      hinweise.push(
        `Der angezeigte Zeitraum beginnt erst am ${anzeige.von}.`,
      )
    }
  }

  const person: KugPerson = {
    sollEntgelt: eintrag.sollEntgelt,
    istEntgelt: eintrag.istEntgelt,
    // §105 SGB III stellt auf ein Kind im Sinne des §32 EStG ab. Der
    // Kinderfreibetrag aus ELStAM ist genau dieser Nachweis; das Merkmal
    // „hat Kinder" am Mitarbeiter reicht allein nicht, weil es auch für
    // längst erwachsene Kinder gesetzt bleibt.
    mitKind: (stamm.kinderfreibetraege ?? 0) > 0,
    steuerklasse: ((stamm.steuerklasse ?? 1) as Steuerklasse),
    kinderfreibetraege: stamm.kinderfreibetraege ?? 0,
    versicherung: stamm.versicherungsart === 'PKV' ? 'PKV' : 'GKV',
    zusatzbeitragProzent: stamm.zusatzbeitrag ?? undefined,
    bundesland: stamm.bundesland ?? undefined,
    hatKinder: stamm.hatKinder ?? undefined,
    kinderUnter25: stamm.kinderUnter25 ?? undefined,
    rvExempt: stamm.rentenversicherungspflichtig === false,
    kugAusTabelle: eintrag.kugAusTabelle,
  }

  const ergebnis = rechne(person, lohnjahr)

  return {
    kug: ergebnis.kug,
    fiktivEntgelt: ergebnis.fiktivEntgelt,
    svAgFiktiv: ergebnis.beitraege.gesamt,
    istEntgelt: eintrag.istEntgelt,
    hinweise: [...hinweise, ...ergebnis.hinweise],
    ergebnis,
    monatId: eintrag.id,
  }
}

/**
 * Das Ergebnis am Monatseintrag festschreiben.
 *
 * Getrennt vom Rechnen, damit ein Lohnlauf, der abbricht, keine halben
 * Ergebnisse hinterlässt — und damit die Abrechnungsliste für die Agentur
 * dieselben Zahlen zeigt wie der Beleg.
 */
export async function kurzarbeitFestschreiben(
  monatId: string, w: KurzarbeitWerte,
): Promise<void> {
  if (!w.ergebnis) return
  await prisma.kurzarbeitMonat.update({
    where: { id: monatId },
    data: {
      nettoSoll: w.ergebnis.nettoSoll,
      nettoIst: w.ergebnis.nettoIst,
      leistungssatz: w.ergebnis.leistungssatz,
      kug: w.ergebnis.kug,
      fiktivEntgelt: w.ergebnis.fiktivEntgelt,
      svAgFiktiv: w.ergebnis.beitraege.gesamt,
      hinweis: w.hinweise.join(' ').slice(0, 2000) || null,
    },
  })
}

export interface AbrechnungsZeile {
  employeeId: string
  name: string
  personalnummer: string | null
  sollStunden: number
  istStunden: number
  sollEntgelt: number
  istEntgelt: number
  ausfallProzent: number
  leistungssatz: number
  kug: number
  fiktivEntgelt: number
  svAgFiktiv: number
}

/**
 * Die Abrechnungsliste für die Agentur für Arbeit.
 *
 * Sie ist die Anlage zum Leistungsantrag: je Person die Stunden, die Entgelte
 * und das ausgezahlte Kurzarbeitergeld. Die Agentur erstattet, was hier steht
 * — und prüft es gegen ihre eigene Tabelle.
 */
export async function abrechnungsliste(
  customerId: string, jahr: number, monat: number, kurzarbeitId?: string,
): Promise<{
  zeilen: AbrechnungsZeile[]
  summeKug: number
  summeSvAgFiktiv: number
}> {
  const monate = await prisma.kurzarbeitMonat.findMany({
    where: {
      customerId, jahr, monat,
      ...(kurzarbeitId ? { kurzarbeitId } : {}),
    },
  })
  if (monate.length === 0) {
    return { zeilen: [], summeKug: 0, summeSvAgFiktiv: 0 }
  }

  const ids = monate.map(m => m.employeeId)
  const [leute, profile] = await Promise.all([
    prisma.employee.findMany({
      where: { id: { in: ids } }, select: { id: true, name: true },
    }),
    prisma.employeePayrollProfile.findMany({
      where: { employeeId: { in: ids } },
      select: { employeeId: true, personalnummer: true },
    }),
  ])
  const namen = new Map(leute.map(l => [l.id, l.name]))
  const nummern = new Map(profile.map(p => [p.employeeId, p.personalnummer]))

  const zeilen = monate.map(m => {
    const soll = m.sollEntgelt
    return {
      employeeId: m.employeeId,
      name: namen.get(m.employeeId) ?? '—',
      personalnummer: nummern.get(m.employeeId) ?? null,
      sollStunden: m.sollStunden,
      istStunden: m.istStunden,
      sollEntgelt: soll,
      istEntgelt: m.istEntgelt,
      ausfallProzent: soll > 0
        ? runde((soll - m.istEntgelt) / soll * 100) : 0,
      leistungssatz: m.leistungssatz,
      kug: m.kug,
      fiktivEntgelt: m.fiktivEntgelt,
      svAgFiktiv: m.svAgFiktiv,
    }
  }).sort((a, b) => a.name.localeCompare(b.name, 'de'))

  return {
    zeilen,
    summeKug: runde(zeilen.reduce((s, z) => s + z.kug, 0)),
    summeSvAgFiktiv: runde(zeilen.reduce((s, z) => s + z.svAgFiktiv, 0)),
  }
}
