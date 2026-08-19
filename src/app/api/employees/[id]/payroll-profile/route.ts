import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// §102 Lohn-Stammdaten eines Mitarbeiters.
// Enthält Bankverbindung, Steuer- und Sozialversicherungsnummer — deshalb
// strenger geschützt als die übrigen Mitarbeiterdaten: nur Leitung, Unternehmen
// und der Mitarbeiter selbst. Kollegen kommen nie heran.

const FELDER = {
  employeeId: true, personalnummer: true, eintrittsdatum: true, austrittsdatum: true,
  befristetBis: true, probezeitBis: true, strasse: true, plz: true, ort: true,
  steuerId: true, steuerklasse: true, kinderfreibetraege: true, konfession: true,
  bundesland: true, sozialversicherungsnummer: true, versicherungsart: true,
  krankenkasse: true, zusatzbeitrag: true, pkvBeitrag: true,
  rentenversicherungspflichtig: true, schwerbehindert: true,
  lohnart: true, stundenlohn: true, monatsgehalt: true,
  iban: true, bic: true, kontoinhaber: true, notiz: true, updatedAt: true,
} as const

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['employee', 'admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  // Ein Mitarbeiter darf ausschließlich die eigenen Lohndaten sehen
  if (session.role === 'employee' && session.employeeId !== params.id) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }
  const verweigert = await assertEmployeeAccess(session, params.id)
  if (verweigert) return verweigert

  const profil = await prisma.employeePayrollProfile.findUnique({
    where: { employeeId: params.id },
    select: FELDER,
  })
  return NextResponse.json({ profil })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  // Ändern darf nur die Leitung oder das Unternehmen — nicht der Mitarbeiter selbst.
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const verweigert = await assertEmployeeAccess(session, params.id)
  if (verweigert) return verweigert

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const customerId = await resolveCustomerId(session)

  const zahl = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v))
  const text = (v: unknown) => (v === '' || v === null || v === undefined ? null : String(v).trim())

  const daten = {
    customerId: customerId ?? null,
    personalnummer: text(body.personalnummer),
    eintrittsdatum: text(body.eintrittsdatum),
    austrittsdatum: text(body.austrittsdatum),
    befristetBis: text(body.befristetBis),
    probezeitBis: text(body.probezeitBis),
    strasse: text(body.strasse),
    plz: text(body.plz),
    ort: text(body.ort),
    steuerId: text(body.steuerId),
    steuerklasse: body.steuerklasse === '' ? null : zahl(body.steuerklasse),
    kinderfreibetraege: zahl(body.kinderfreibetraege),
    konfession: text(body.konfession),
    bundesland: text(body.bundesland),
    sozialversicherungsnummer: text(body.sozialversicherungsnummer),
    versicherungsart: text(body.versicherungsart),
    krankenkasse: text(body.krankenkasse),
    zusatzbeitrag: zahl(body.zusatzbeitrag),
    pkvBeitrag: zahl(body.pkvBeitrag),
    rentenversicherungspflichtig: body.rentenversicherungspflichtig !== false,
    schwerbehindert: body.schwerbehindert === true,
    lohnart: text(body.lohnart),
    stundenlohn: zahl(body.stundenlohn),
    monatsgehalt: zahl(body.monatsgehalt),
    iban: text(body.iban)?.replace(/\s+/g, '').toUpperCase() ?? null,
    bic: text(body.bic)?.toUpperCase() ?? null,
    kontoinhaber: text(body.kontoinhaber),
    notiz: text(body.notiz),
  }

  const profil = await prisma.employeePayrollProfile.upsert({
    where: { employeeId: params.id },
    create: { employeeId: params.id, ...daten },
    update: daten,
    select: FELDER,
  })
  return NextResponse.json({ profil })
}
