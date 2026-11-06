import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { allowedLocationScope } from '@/lib/scope'
import { monatsGrundlagen } from '@/lib/payroll-monat'
import {
  uebergabeZeile, uebergabeCsv, uebergabeDateiname, uebergabeMaengel,
} from '@/lib/lohnuebergabe'

export const dynamic = 'force-dynamic'

/**
 * §275 GET /api/lohnuebergabe?jahr=&monat=&locationId=&format=csv
 *
 * Die Zahlen, die das Lohnbüro am Monatsende braucht — ohne dass hier
 * abgerechnet wird.
 *
 * WAS HIER BEWUSST NICHT PASSIERT
 * `abrechnungRechnen()` wird nicht aufgerufen. Diese Schnittstelle endet bei
 * den Grundlagen: Stunden, Zuschläge, Fehltage. Brutto, Lohnsteuer und
 * Sozialversicherung entstehen im Lohnprogramm des Kunden, und genau das ist
 * der Punkt — dafür braucht es die ITSG-Systemprüfung, die wir nicht haben.
 *
 * Die Trennung ist nicht nur eine Absichtserklärung: Wer hier eine Abrechnung
 * ergänzt, muss diesen Kommentar überschreiben.
 *
 * Ohne `format=csv` kommen die Zeilen als JSON zurück — dieselbe Rechnung,
 * für die Anzeige am Bildschirm.
 */
export async function GET(req: NextRequest) {
  /*
   * §275 Unternehmensebene, nicht Standortleitung — und das ist keine
   * Vorsicht, sondern Gleichlauf.
   *
   * Die Zuschlagsübersicht am Bildschirm zeigt Beträge nur der
   * Unternehmensebene (`canSeeAmounts` in /admin/surcharges); eine
   * Standortleitung sieht dort Stunden, aber kein Geld. Diese Datei enthält
   * Beträge je Person. Wäre sie für `admin` zu holen, hinge die Regel allein
   * an der Bildschirmanzeige — und wer die Adresse kennt, umginge sie mit
   * einem Aufruf. Eine Datei ist dabei schlimmer als eine Seite: Sie ist
   * weitergereicht, bevor jemand merkt, dass sie nicht hätte entstehen dürfen.
   */
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  const p = req.nextUrl.searchParams
  const jahr = Number(p.get('jahr'))
  const monat = Number(p.get('monat'))
  if (!Number.isInteger(jahr) || !Number.isInteger(monat) || monat < 1 || monat > 12) {
    return NextResponse.json(
      { error: 'Jahr und Monat sind erforderlich (monat 1–12).' }, { status: 400 })
  }

  /*
   * Die Standortgrenze gilt auch hier. Eine Bereichsleitung, die ihren
   * eigenen Standort übergibt, darf dabei nicht die Stunden des Nachbarhauses
   * mit herunterladen — und eine Datei ist schneller weitergereicht als eine
   * Bildschirmseite.
   */
  const locationId = p.get('locationId')
  const scope = await allowedLocationScope(session)
  const standortFilter = locationId
    ? (scope.kind === 'all' || scope.ids.includes(locationId)
        ? { locationId }
        : null)
    : (scope.kind === 'all' ? {} : { locationId: { in: scope.ids } })
  if (standortFilter === null) {
    return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
  }

  const [kunde, mitarbeiter] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { name: true } }),
    prisma.employee.findMany({
      where: { customerId, active: true, ...standortFilter },
      select: { id: true, name: true, locationId: true, weeklyHours: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const profile = await prisma.employeePayrollProfile.findMany({
    where: { employeeId: { in: mitarbeiter.map(m => m.id) } },
  })
  const profilVon = new Map(profile.map(x => [x.employeeId, x]))

  const grundlagen = await monatsGrundlagen(customerId, jahr, monat, mitarbeiter.map(m => {
    const prof = profilVon.get(m.id)
    return {
      employeeId: m.id, weeklyHours: m.weeklyHours, locationId: m.locationId,
      bundesland: prof?.bundesland, lohnart: prof?.lohnart,
      stundenlohn: prof?.stundenlohn, monatsgehalt: prof?.monatsgehalt,
      eintrittsdatum: prof?.eintrittsdatum, austrittsdatum: prof?.austrittsdatum,
    }
  }))

  /*
   * Wer im Monat gar nicht beschäftigt war, gehört nicht in die Datei. Eine
   * Zeile mit lauter Nullen sieht im Lohnprogramm aus wie ein Monat ohne
   * Arbeit — und nicht wie jemand, der erst nächsten Monat anfängt.
   */
  const zeilen = mitarbeiter
    .map(m => ({ m, g: grundlagen.get(m.id) }))
    .filter((x): x is { m: typeof mitarbeiter[number]; g: NonNullable<typeof x.g> } =>
      !!x.g && x.g.beschaeftigt)
    .map(({ m, g }) => uebergabeZeile(
      { name: m.name, personalnummer: profilVon.get(m.id)?.personalnummer }, g))

  const kopf = { betrieb: kunde?.name ?? 'Betrieb', jahr, monat }

  if (p.get('format') === 'csv') {
    return new NextResponse(uebergabeCsv(kopf, zeilen), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${uebergabeDateiname(kopf)}"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  return NextResponse.json({
    kopf, zeilen, maengel: uebergabeMaengel(zeilen),
    dateiname: uebergabeDateiname(kopf),
  })
}
