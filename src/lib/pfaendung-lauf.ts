import { prisma } from './prisma'
import {
  rechne, zuschlaegeNach850a, tabelleFuer, runde,
  type Pfaendung as PfaendungRegel, type Ergebnis,
} from './pfaendung'

/**
 * §155 Die Pfändung an der Abrechnung — der Teil mit der Datenbank.
 *
 * Die Rechnung selbst steht in `pfaendung.ts` und ist ohne Datenbank prüfbar.
 * Hier steht nur: Welche Pfändungen laufen, wie viel wurde schon getilgt, und
 * wie wird der Abzug festgehalten.
 *
 * WARUM DER ABZUG FESTGEHALTEN WIRD UND NICHT NUR GERECHNET
 * Wegen §840 ZPO. Der Arbeitgeber muss dem Gläubiger auf Verlangen erklären,
 * ob und wie viel er einbehalten hat — die Drittschuldnererklärung. Ohne eine
 * Zeile je Monat und Gläubiger lässt sich das nicht belegen. Und ohne den
 * festgehaltenen Stand wüsste beim nächsten Lauf niemand, wie viel der
 * Forderung noch offen ist.
 *
 * WARUM DIE ZEILE EINDEUTIG JE MONAT IST
 * Weil die Abrechnung mehrfach gerechnet werden kann — beim Vorbereiten, nach
 * einer Korrektur, nach einer Änderung an den Zeiten. Ohne die Eindeutigkeit
 * entstünde jedes Mal ein weiterer Abzug, und der Beschäftigte bekäme beim
 * dritten Lauf gar nichts mehr.
 */

export interface Abrechnungswerte {
  netto: number
  /** Die Zuschläge des Monats, getrennt nach Art */
  nachtzuschlag?: number
  sonntagszuschlag?: number
  feiertagszuschlag?: number
  samstagszuschlag?: number
  mehrarbeitszuschlag?: number
  /** Bezahlte Überstunden (nicht der Zuschlag, die Vergütung) */
  mehrarbeitsverguetung?: number
  /** Einmalzahlungen des Monats, soweit Urlaubs- oder Weihnachtsgeld */
  urlaubsgeld?: number
  weihnachtsgeld?: number
}

export interface LaufErgebnis {
  /** Was insgesamt einbehalten wird */
  einbehalten: number
  ergebnis: Ergebnis | null
  /** Klartext für den Beleg und die Oberfläche */
  hinweise: string[]
  /** Wenn gar nicht gerechnet werden konnte */
  fehler?: string
}

/**
 * Den Abzug für einen Monat ausrechnen und festhalten.
 *
 * Gibt einen Betrag von 0 zurück, wenn keine Pfändung läuft — und rechnet dann
 * auch nichts, um nicht bei jedem Lohnlauf für jeden Menschen eine Tabelle
 * nachzuschlagen, die niemanden betrifft.
 */
export async function pfaendungFuerMonat(
  employeeId: string,
  customerId: string,
  jahr: number,
  monat: number,
  werte: Abrechnungswerte,
): Promise<LaufErgebnis> {
  const laufende = await prisma.pfaendung.findMany({
    where: { employeeId, customerId, aktiv: true, erledigtAm: null },
    orderBy: { zugestelltAm: 'asc' },
  })
  if (laufende.length === 0) {
    return { einbehalten: 0, ergebnis: null, hinweise: [] }
  }

  // Der Stichtag ist der letzte Tag des Abrechnungsmonats: Es gilt die
  // Tabelle, die für diesen Zeitraum in Kraft war — nicht die von heute.
  const stichtag = new Date(Date.UTC(jahr, monat, 0)).toISOString().slice(0, 10)
  if (!tabelleFuer(stichtag)) {
    return {
      einbehalten: 0,
      ergebnis: null,
      hinweise: [],
      fehler:
        `Für ${monat}/${jahr} liegt keine geprüfte Pfändungstabelle vor. Die `
        + 'Freigrenzen werden zum 1. Juli angepasst (§850c Abs. 4 ZPO). Es '
        + 'wird nichts einbehalten, bis die Tabelle ergänzt ist — lieber gar '
        + 'nichts als zu viel.',
    }
  }

  const z = zuschlaegeNach850a({
    nacht: werte.nachtzuschlag,
    sonntag: werte.sonntagszuschlag,
    feiertag: werte.feiertagszuschlag,
    samstag: werte.samstagszuschlag,
    mehrarbeit: werte.mehrarbeitszuschlag,
  })

  // Die Unterhaltspflichten stehen im Beschluss. Laufen mehrere Pfändungen,
  // gilt die höchste angegebene Zahl — eine niedrigere würde den Freibetrag
  // kleiner machen, als er sein darf.
  const unterhaltspflichten = laufende.reduce(
    (m, p) => Math.max(m, p.unterhaltspflichten ?? 0), 0)

  const regeln: PfaendungRegel[] = laufende.map(p => ({
    id: p.id,
    art: p.art as PfaendungRegel['art'],
    glaeubiger: p.glaeubiger,
    zugestelltAm: p.zugestelltAm,
    forderung: p.forderung,
    getilgt: p.getilgt,
    notwendigerUnterhalt: p.notwendigerUnterhalt,
  }))

  const ergebnis = rechne(
    {
      nettoGesamt: werte.netto,
      mehrarbeit: runde(
        (werte.mehrarbeitsverguetung ?? 0) + z.mehrarbeit),
      erschwerniszulagen: z.erschwerniszulagen,
      urlaubsgeld: werte.urlaubsgeld,
      weihnachtsgeld: werte.weihnachtsgeld,
    },
    unterhaltspflichten,
    regeln,
    stichtag,
  )

  // Festhalten, was einbehalten wurde — je Pfändung und Monat genau einmal.
  for (const z2 of ergebnis.verteilung.zuteilungen) {
    await prisma.pfaendungsAbzug.upsert({
      where: {
        pfaendungId_jahr_monat: { pfaendungId: z2.pfaendungId, jahr, monat },
      },
      create: {
        pfaendungId: z2.pfaendungId, employeeId, customerId, jahr, monat,
        betrag: z2.betrag, glaeubiger: z2.glaeubiger, hinweis: z2.hinweis,
      },
      update: { betrag: z2.betrag, hinweis: z2.hinweis },
    })
  }

  // Den Tilgungsstand nachführen: aus den festgehaltenen Abzügen, nicht durch
  // Aufaddieren. Wird ein Monat neu gerechnet, stimmt die Summe dann immer
  // noch — beim Aufaddieren wäre sie beim zweiten Lauf doppelt.
  for (const p of laufende) {
    if (p.forderung == null) continue
    const summe = await prisma.pfaendungsAbzug.aggregate({
      where: { pfaendungId: p.id },
      _sum: { betrag: true },
    })
    const getilgt = runde(summe._sum.betrag ?? 0)
    await prisma.pfaendung.update({
      where: { id: p.id },
      data: {
        getilgt,
        // Ist die Forderung erfüllt, endet die Pfändung von selbst. Sie weiter
        // zu bedienen wäre eine Zuvielzahlung an den Gläubiger.
        ...(getilgt >= p.forderung
          ? { aktiv: false, erledigtAm: new Date() } : {}),
      },
    })
  }

  const hinweise = [
    ...ergebnis.berechnung.herleitung,
    ...ergebnis.verteilung.zuteilungen.map(
      t => `An ${t.glaeubiger}: ${t.betrag.toFixed(2)} € — ${t.hinweis}`),
    ...ergebnis.verteilung.unbedient.map(
      u => `${u.glaeubiger}: ${u.grund}`),
  ]

  return { einbehalten: ergebnis.einbehalten, ergebnis, hinweise }
}

/** Die Abzüge eines Monats — für den Beleg. */
export async function abzuegeFuerBeleg(
  employeeId: string, jahr: number, monat: number,
): Promise<{ glaeubiger: string; betrag: number; hinweis: string | null }[]> {
  const zeilen = await prisma.pfaendungsAbzug.findMany({
    where: { employeeId, jahr, monat },
    orderBy: { createdAt: 'asc' },
    select: { glaeubiger: true, betrag: true, hinweis: true },
  })
  return zeilen
}
