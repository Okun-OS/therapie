import { prisma } from './prisma'
import { rechne, runde, type Durchfuehrungsweg, type Ergebnis } from './bav'
import type { Lohnjahr } from './lohnjahre'

/**
 * §156 Die betriebliche Altersvorsorge an der Abrechnung.
 *
 * Die Rechnung steht in `bav.ts` und ist ohne Datenbank prüfbar. Hier steht
 * nur: Welcher Vertrag läuft in diesem Monat, und wie viel wurde im Jahr
 * bisher umgewandelt.
 *
 * WARUM DAS JAHR MITGEZÄHLT WIRD
 * Weil §3 Nr. 63 EStG eine JAHRESgrenze setzt, keine monatliche. Wer sie
 * zwölftelt, rechnet bei einer Sonderzahlung im Dezember falsch — und wer sie
 * gar nicht mitzählt, überschreitet sie unbemerkt. Gezählt wird aus den schon
 * gerechneten Monaten dieses Jahres, nicht aus dem Vertrag: Der Betrag kann
 * sich geändert haben, und ein Teilmonat zählt anteilig.
 *
 * Gezählt wird dabei die STEUERFREI GESTELLTE Summe, nicht die umgewandelte.
 * Was über der Grenze lag, war nie frei und darf den Rahmen nicht mindern.
 *
 * Die Beitragsgrenze braucht diesen Zähler nicht: Sie gilt je Monat und wird
 * innerhalb des Monats zwischen mehreren Verträgen aufgeteilt.
 */

export interface BavWerte {
  umwandlung: number
  minderungSteuer: number
  minderungSv: number
  zuschussAG: number
  hinweise: string[]
  ergebnis: Ergebnis | null
}

const LEER: BavWerte = {
  umwandlung: 0, minderungSteuer: 0, minderungSv: 0, zuschussAG: 0,
  hinweise: [], ergebnis: null,
}

/**
 * Was in diesem Monat umgewandelt wird — und wie es sich auswirkt.
 *
 * Läuft kein Vertrag, wird nichts gerechnet und nichts nachgeschlagen.
 */
export async function bavFuerMonat(
  employeeId: string,
  customerId: string,
  jahr: number,
  monat: number,
  lohnjahr: Lohnjahr,
): Promise<BavWerte> {
  // Der Monatsletzte: Ein Vertrag, der am 20. endet, gilt für diesen Monat
  // noch. Die Abrechnung kennt keine halben Monatsbeiträge — endet ein
  // Vertrag mitten im Monat, ist das eine Sache der Vereinbarung.
  const monatsletzter = new Date(Date.UTC(jahr, monat, 0))
    .toISOString().slice(0, 10)
  const monatserster = `${jahr}-${String(monat).padStart(2, '0')}-01`

  const vertraege = await prisma.bavVertrag.findMany({
    where: {
      employeeId, customerId, aktiv: true,
      beginn: { lte: monatsletzter },
      OR: [{ ende: null }, { ende: { gte: monatserster } }],
    },
    orderBy: { beginn: 'asc' },
  })
  if (vertraege.length === 0) return LEER

  // Was dieses Jahr schon steuerfrei gestellt wurde — aus den gerechneten
  // Monaten. Nicht die Umwandlung: ein Teil über der Grenze war nie frei.
  const bisher = await prisma.payrollEntry.aggregate({
    where: { employeeId, year: jahr, month: { lt: monat } },
    _sum: { bavMinderungSteuer: true },
  })
  let steuerfreiBisherImJahr = runde(bisher._sum.bavMinderungSteuer ?? 0)
  let svfreiBisherImMonat = 0

  let umwandlung = 0
  let minderungSteuer = 0
  let minderungSv = 0
  let zuschussAG = 0
  const hinweise: string[] = []
  let letztes: Ergebnis | null = null

  // Mehrere Verträge nacheinander gegen denselben Jahresrahmen: Die Grenzen
  // gelten je Person, nicht je Vertrag. Wer zwei Direktversicherungen hat,
  // teilt sich einen Rahmen.
  for (const v of vertraege) {
    const e = rechne(
      {
        monatsbetrag: v.monatsbetrag,
        weg: v.weg as Durchfuehrungsweg,
        steuerfreiBisherImJahr,
        svfreiBisherImMonat,
      },
      lohnjahr,
      v.zuschussSatz,
      v.zuschussAufGesamt,
    )
    umwandlung = runde(umwandlung + e.entgeltminderung)
    minderungSteuer = runde(minderungSteuer + e.aufteilung.minderungSteuer)
    minderungSv = runde(minderungSv + e.aufteilung.minderungSv)
    zuschussAG = runde(zuschussAG + e.zuschuss.gezahlt)
    steuerfreiBisherImJahr = runde(
      steuerfreiBisherImJahr + e.aufteilung.minderungSteuer)
    svfreiBisherImMonat = runde(svfreiBisherImMonat + e.aufteilung.minderungSv)
    for (const h of e.hinweise) hinweise.push(`${v.anbieter}: ${h}`)
    letztes = e
  }

  return {
    umwandlung, minderungSteuer, minderungSv, zuschussAG,
    hinweise, ergebnis: letztes,
  }
}

/** Die laufenden Verträge einer Person — für den Beleg. */
export async function vertraegeFuerBeleg(
  employeeId: string, jahr: number, monat: number,
): Promise<{ anbieter: string; weg: string; betrag: number }[]> {
  const monatsletzter = new Date(Date.UTC(jahr, monat, 0))
    .toISOString().slice(0, 10)
  const monatserster = `${jahr}-${String(monat).padStart(2, '0')}-01`
  const v = await prisma.bavVertrag.findMany({
    where: {
      employeeId, aktiv: true,
      beginn: { lte: monatsletzter },
      OR: [{ ende: null }, { ende: { gte: monatserster } }],
    },
    select: { anbieter: true, weg: true, monatsbetrag: true },
    orderBy: { beginn: 'asc' },
  })
  return v.map(x => ({
    anbieter: x.anbieter, weg: x.weg, betrag: x.monatsbetrag,
  }))
}
