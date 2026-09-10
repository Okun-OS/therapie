import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { locationFilter } from '@/lib/scope'
import { prisma } from '@/lib/prisma'
import {
  datevCsv, datevZeilenAusAbrechnung, sepaXml, ibanGueltig,
  type DatevZeile, type SepaZahlung,
} from '@/lib/lohn-export'

export const dynamic = 'force-dynamic'

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

/**
 * §114 GET /api/payroll/export?art=datev|sepa&year=&month=[&locationId=][&datum=]
 *
 * datev — Übergabedatei für den Steuerberater (CSV)
 * sepa  — Überweisungsdatei für die Bank des Kunden (pain.001.001.03)
 *
 * Beides sind Dateien zum Weitergeben. Wir melden nichts an Behörden und lösen
 * keine Zahlung aus — siehe src/lib/lohn-export.ts.
 */
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  const p = req.nextUrl.searchParams
  const art = p.get('art')
  const year = Number(p.get('year'))
  const month = Number(p.get('month'))
  const locationId = p.get('locationId')

  if (art !== 'datev' && art !== 'sepa') {
    return NextResponse.json({ error: 'art muss "datev" oder "sepa" sein' }, { status: 400 })
  }
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Jahr und Monat sind erforderlich' }, { status: 400 })
  }
  if (locationId) {
    const erlaubt = await locationFilter(session, locationId)
    if (erlaubt instanceof NextResponse) return erlaubt
  }

  const abrechnungen = await prisma.payrollEntry.findMany({
    where: { customerId, year, month, ...(locationId ? { locationId } : {}) },
    orderBy: { employeeName: 'asc' },
  })
  if (abrechnungen.length === 0) {
    return NextResponse.json(
      { error: `Für ${MONATE[month - 1]} ${year} sind keine Abrechnungen vorhanden.` },
      { status: 404 },
    )
  }

  const profile = await prisma.employeePayrollProfile.findMany({
    where: { employeeId: { in: abrechnungen.map(a => a.employeeId) } },
  })
  const profilVon = new Map(profile.map(x => [x.employeeId, x]))
  const orgSettings = await prisma.orgSettings.findUnique({ where: { customerId } })
  const kunde = await prisma.customer.findUnique({ where: { id: customerId }, select: { name: true } })
  const mandantName = orgSettings?.organizationName ?? kunde?.name ?? 'Mandant'

  // ── DATEV ────────────────────────────────────────────────────────────────
  if (art === 'datev') {
    const zeilen: DatevZeile[] = []
    for (const a of abrechnungen) {
      zeilen.push(...datevZeilenAusAbrechnung({
        ...a,
        personalnummer: profilVon.get(a.employeeId)?.personalnummer ?? null,
        auszahlungsbetrag: a.auszahlungsbetrag || a.netto,
        sonstigeBezuege: a.sonstigeBezuege,
        lohnsteuerSonstige: a.lohnsteuerSonstige,
      }))
    }
    const csv = datevCsv(
      {
        beraternummer: orgSettings?.datevBeraternummer,
        mandantennummer: orgSettings?.datevMandantennummer,
        jahr: year, monat: month, mandantName,
      },
      zeilen,
    )
    const name = `DATEV-Lohn-${year}-${String(month).padStart(2, '0')}.csv`
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  }

  // ── SEPA ─────────────────────────────────────────────────────────────────
  if (!orgSettings?.iban) {
    return NextResponse.json({
      error: 'Für die SEPA-Datei fehlt die Bankverbindung des Unternehmens. '
        + 'Sie wird in den Unternehmenseinstellungen hinterlegt.',
    }, { status: 400 })
  }
  if (!ibanGueltig(orgSettings.iban)) {
    return NextResponse.json({
      error: 'Die hinterlegte IBAN des Unternehmens ist ungültig (Prüfsumme stimmt nicht).',
    }, { status: 400 })
  }

  const zahlungen: SepaZahlung[] = []
  const ohneBankverbindung: string[] = []
  for (const a of abrechnungen) {
    const profil = profilVon.get(a.employeeId)
    const iban = profil?.iban?.replace(/\s+/g, '').toUpperCase()
    if (!iban) { ohneBankverbindung.push(`${a.employeeName ?? a.employeeId}: keine IBAN hinterlegt`); continue }
    if (!ibanGueltig(iban)) { ohneBankverbindung.push(`${a.employeeName ?? a.employeeId}: IBAN ungültig`); continue }
    // §119 Ueberwiesen wird der Auszahlungsbetrag — Netto plus ausgeglichene
    // Korrekturen aus aufgerollten Monaten. Wer hier das Netto naehme, zahlte
    // die Korrektur nie aus.
    const betrag = a.auszahlungsbetrag || a.netto
    if (betrag <= 0) { ohneBankverbindung.push(`${a.employeeName ?? a.employeeId}: kein Auszahlungsbetrag`); continue }
    zahlungen.push({
      name: profil?.kontoinhaber || a.employeeName || 'Mitarbeiter',
      iban, bic: profil?.bic,
      betrag,
      verwendungszweck: `Gehalt ${MONATE[month - 1]} ${year}`,
    })
  }

  if (zahlungen.length === 0) {
    return NextResponse.json({
      error: 'Keine Zahlung möglich — bei keinem Mitarbeiter ist eine gültige Bankverbindung hinterlegt.',
      details: ohneBankverbindung,
    }, { status: 400 })
  }

  // Ausführung: übernächster Werktag, damit die Bank die Datei annimmt
  const wunsch = p.get('datum')
  let ausfuehrung: string
  if (wunsch && /^\d{4}-\d{2}-\d{2}$/.test(wunsch)) {
    ausfuehrung = wunsch
  } else {
    const d = new Date(); d.setDate(d.getDate() + 2)
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
    ausfuehrung = d.toISOString().slice(0, 10)
  }

  const xml = sepaXml(
    { name: orgSettings.kontoinhaber || mandantName, iban: orgSettings.iban, bic: orgSettings.bic },
    zahlungen, ausfuehrung,
  )
  const name = `SEPA-Gehalt-${year}-${String(month).padStart(2, '0')}.xml`
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
      // Damit die Oberfläche melden kann, wer fehlt, ohne die Datei zu öffnen
      'X-Okun-Zahlungen': String(zahlungen.length),
      'X-Okun-Uebersprungen': String(ohneBankverbindung.length),
    },
  })
}
