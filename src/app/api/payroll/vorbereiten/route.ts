import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { allowedLocationScope } from '@/lib/scope'
import { monatsGrundlagen, abrechnungRechnen, abrechnungsFelder } from '@/lib/payroll-monat'
import { elstamStandBewerten } from '@/lib/elstam'
import { korrekturText } from '@/lib/aufrollung'

/** Erster Beschaeftigungsmonat im Abrechnungsjahr — 1, wenn schon vorher dabei. */
function eintrittsMonatImJahr(eintritt: string | null | undefined, jahr: number): number {
  if (!eintritt || !/^\d{4}-\d{2}/.test(eintritt)) return 1
  const [j, m] = eintritt.split('-').map(Number)
  if (j < jahr) return 1
  if (j > jahr) return 12
  return Math.min(12, Math.max(1, m))
}

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

export const dynamic = 'force-dynamic'

// §102 POST /api/payroll/vorbereiten  { year, month, locationId? }
//
// Erzeugt Abrechnungsentwürfe aus den Lohn-Stammdaten der Mitarbeiter.
// Ohne das müsste jemand Steuerklasse, Versicherung und Lohn bei jeder
// Abrechnung neu eintippen — genau der Grund, warum die Stammdaten am
// Mitarbeiter hängen und nicht am einzelnen Abrechnungslauf.
//
// §115 Vorbereiten heißt auch rechnen: Stunden aus der Zeiterfassung,
// Abwesenheiten und Zuschläge fließen ein, Brutto und Netto stehen danach am
// Entwurf. Eine Abrechnung ohne Beträge ist keine Abrechnung.
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  const { year, month, locationId } = await req.json().catch(() => ({})) as {
    year?: number; month?: number; locationId?: string
  }
  if (!year || !month) {
    return NextResponse.json({ error: 'Jahr und Monat sind erforderlich' }, { status: 400 })
  }

  const scope = await allowedLocationScope(session)
  const standortFilter = locationId
    ? (scope.kind === 'all' || scope.ids.includes(locationId)
        ? { locationId }
        : null)
    : (scope.kind === 'all' ? {} : { locationId: { in: scope.ids } })
  if (standortFilter === null) {
    return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
  }

  const mitarbeiter = await prisma.employee.findMany({
    where: { customerId, active: true, ...standortFilter },
    select: { id: true, name: true, locationId: true, weeklyHours: true, hasChildren: true },
  })
  const profile = await prisma.employeePayrollProfile.findMany({
    where: { employeeId: { in: mitarbeiter.map(m => m.id) } },
  })
  const profilVon = new Map(profile.map(p => [p.employeeId, p]))

  // Stunden, Abwesenheiten und Zuschläge des Monats — ein Durchlauf für alle
  const grundlagen = await monatsGrundlagen(customerId, year, month, mitarbeiter.map(m => {
    const p = profilVon.get(m.id)
    return {
      employeeId: m.id, weeklyHours: m.weeklyHours, locationId: m.locationId,
      bundesland: p?.bundesland, lohnart: p?.lohnart,
      stundenlohn: p?.stundenlohn, monatsgehalt: p?.monatsgehalt,
      // §120 Wer erst im Laufe des Jahres eingetreten ist, hat eine kleinere
      // anteilige Jahresgrenze fuer Einmalzahlungen.
      eintrittsMonat: eintrittsMonatImJahr(p?.eintrittsdatum, year),
    }
  }))

  // §119 Offene Korrekturen aus aufgerollten Monaten, die in diesem Monat
  // ausgeglichen werden. Sie kommen zum Netto hinzu — ausgezahlt wird der
  // auszahlungsbetrag, nicht das Netto des Monats.
  // Auch die bereits ausgeglichenen zaehlen mit: sonst loescht der zweite Lauf
  // eines Monats die Korrektur wieder aus der Abrechnung, und das Geld
  // verschwaende zwischen zwei Klicks. Nur verworfene bleiben draussen.
  const offeneKorrekturen = await prisma.payrollCorrection.findMany({
    where: {
      customerId, ausgleichJahr: year, ausgleichMonat: month,
      status: { in: ['offen', 'ausgeglichen'] },
      employeeId: { in: mitarbeiter.map(m => m.id) },
    },
  })
  const korrekturenJeMitarbeiter = new Map<string, typeof offeneKorrekturen>()
  for (const k of offeneKorrekturen) {
    korrekturenJeMitarbeiter.set(k.employeeId, [...(korrekturenJeMitarbeiter.get(k.employeeId) ?? []), k])
  }

  const angelegt: string[] = []
  const unvollstaendig: { name: string; fehlt: string[] }[] = []
  const gesperrt: string[] = []
  const hinweise: { name: string; text: string }[] = []
  // §117 Veraltete Steuermerkmale sind der teuerste stille Fehler in der
  // Abrechnung — deshalb werden sie eigens gemeldet und nicht unter die
  // uebrigen Hinweise gemischt.
  const veralteteMerkmale: { name: string; text: string }[] = []
  const ausgeglichen: { name: string; text: string; betrag: number }[] = []
  const verschoben: { name: string; text: string }[] = []

  for (const m of mitarbeiter) {
    const p = profilVon.get(m.id)

    // Ohne diese Angaben ist keine Abrechnung möglich — das soll auffallen,
    // bevor jemand ein falsches Ergebnis in der Hand hält.
    const fehlt: string[] = []
    if (!p) fehlt.push('Lohn-Stammdaten fehlen vollständig')
    else {
      if (!p.steuerklasse) fehlt.push('Steuerklasse')
      if (!p.versicherungsart) fehlt.push('Versicherungsart')
      if (!p.lohnart) fehlt.push('Lohnart')
      if (p.lohnart === 'stunde' && !p.stundenlohn) fehlt.push('Stundenlohn')
      if (p.lohnart === 'monat' && !p.monatsgehalt) fehlt.push('Monatsgehalt')
      if (!p.bundesland) fehlt.push('Bundesland')
    }
    if (fehlt.length > 0) {
      unvollstaendig.push({ name: m.name, fehlt })
      continue
    }

    // Eine bereits freigegebene Abrechnung wird nicht neu gerechnet — sonst
    // ändert sich still, was jemand geprüft und unterschrieben hat.
    const vorhanden = await prisma.payrollEntry.findUnique({
      where: { employeeId_year_month: { employeeId: m.id, year, month } },
      select: { id: true, status: true },
    })
    if (vorhanden && vorhanden.status !== 'draft') {
      gesperrt.push(m.name)
      // §119 Eine offene Korrektur darf hier nicht liegenbleiben. Der Monat ist
      // schon freigegeben, also kann das Geld hier nicht mehr fliessen — sie
      // wandert in den naechsten Monat, statt still zu verschwinden.
      const haengende = (korrekturenJeMitarbeiter.get(m.id) ?? [])
        .filter(x => x.status === 'offen')
      for (const k of haengende) {
        const naechster = month === 12
          ? { jahr: year + 1, monat: 1 }
          : { jahr: year, monat: month + 1 }
        await prisma.payrollCorrection.update({
          where: { id: k.id },
          data: { ausgleichJahr: naechster.jahr, ausgleichMonat: naechster.monat },
        })
        verschoben.push({
          name: m.name,
          text: `${korrekturText(k.jahr, k.monat, k.differenzNetto)} — `
            + `${MONATE[month - 1]} ist bereits freigegeben, Ausgleich jetzt in `
            + `${MONATE[naechster.monat - 1]} ${naechster.jahr}`,
        })
      }
      continue
    }

    const stand = elstamStandBewerten(p!.elstamStand, year, month)
    if (!stand.aktuell && stand.hinweis) {
      veralteteMerkmale.push({ name: m.name, text: stand.hinweis })
    }

    const grundlage = grundlagen.get(m.id)!
    // Fuer die Pflegeversicherung zaehlt, ob jemand Kinder hat — die Angabe am
    // Lohnprofil geht vor, sonst das Merkmal am Mitarbeiter.
    let ergebnis
    try {
      ergebnis = abrechnungRechnen(
        { ...p!, hatKinder: p!.hatKinder ?? m.hasChildren },
        grundlage,
        year,
        month,
      ).ergebnis
    } catch (fehler) {
      // Ein unbekanntes Abrechnungsjahr ist kein Serverfehler, sondern eine
      // Sache, die jemand entscheiden muss.
      return NextResponse.json(
        { error: fehler instanceof Error ? fehler.message : 'Berechnung nicht moeglich' },
        { status: 400 },
      )
    }
    for (const w of ergebnis.warnings) hinweise.push({ name: m.name, text: w })

    const stammFelder = {
      employeeName: m.name, locationId: m.locationId, customerId,
      hourlyWage: p!.stundenlohn ?? null,
      monthlyWage: p!.monatsgehalt ?? null,
      taxClass: p!.steuerklasse ?? 1,
      childCount: p!.kinderfreibetraege ?? 0,
      insuranceType: p!.versicherungsart ?? 'GKV',
      pkv: p!.pkvBeitrag ?? null,
      churchTax: !!p!.konfession && p!.konfession !== 'keine',
      bundesland: p!.bundesland,
    }
    const gerechnet = abrechnungsFelder(grundlage, ergebnis)

    const korrekturen = korrekturenJeMitarbeiter.get(m.id) ?? []
    const korrekturNetto = Math.round(
      korrekturen.reduce((s, k) => s + k.differenzNetto, 0) * 100) / 100
    for (const k of korrekturen.filter(x => x.status === 'offen')) {
      ausgeglichen.push({
        name: m.name,
        text: korrekturText(k.jahr, k.monat, k.differenzNetto),
        betrag: k.differenzNetto,
      })
    }

    const eintrag = await prisma.payrollEntry.upsert({
      where: { employeeId_year_month: { employeeId: m.id, year, month } },
      create: {
        employeeId: m.id, year, month, status: 'draft', ...stammFelder, ...gerechnet,
        korrekturNetto, auszahlungsbetrag: Math.round((gerechnet.netto + korrekturNetto) * 100) / 100,
      },
      update: {
        ...stammFelder, ...gerechnet,
        korrekturNetto, auszahlungsbetrag: Math.round((gerechnet.netto + korrekturNetto) * 100) / 100,
      },
    })

    // Erst wenn die Korrektur wirklich an einer Abrechnung haengt, gilt sie als
    // ausgeglichen. Sonst waere sie verbucht, ohne dass jemand Geld bekommt.
    for (const k of korrekturen.filter(x => x.status === 'offen')) {
      await prisma.payrollCorrection.update({
        where: { id: k.id },
        data: { status: 'ausgeglichen', ausgeglichenIn: eintrag.id },
      })
    }
    angelegt.push(m.name)
  }

  const teile: string[] = []
  if (angelegt.length > 0) teile.push(`${angelegt.length} Abrechnungen berechnet`)
  if (gesperrt.length > 0) teile.push(`${gesperrt.length} bereits freigegeben und unverändert`)
  if (unvollstaendig.length > 0) teile.push(`${unvollstaendig.length} ohne vollständige Lohn-Stammdaten`)
  if (veralteteMerkmale.length > 0) {
    teile.push(`${veralteteMerkmale.length} mit veraltetem ELStAM-Stand`)
  }
  if (verschoben.length > 0) {
    teile.push(`${verschoben.length} Korrekturen in den Folgemonat verschoben`)
  }
  if (ausgeglichen.length > 0) {
    const summe = ausgeglichen.reduce((s, x) => s + x.betrag, 0)
    teile.push(`${ausgeglichen.length} Korrekturen ausgeglichen `
      + `(${summe >= 0 ? '+' : ''}${summe.toFixed(2)} EUR)`)
  }

  return NextResponse.json({
    angelegt: angelegt.length,
    gesperrt,
    unvollstaendig,
    veralteteMerkmale,
    ausgeglichen,
    verschoben,
    hinweise,
    hinweis: teile.length > 0 ? teile.join(' · ') + '.' : 'Keine Mitarbeiter zum Abrechnen gefunden.',
  })
}
