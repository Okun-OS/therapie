import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { assertEmployeeAccess, allowedLocationScope } from '@/lib/scope'
import { prisma } from '@/lib/prisma'
import {
  dateiSpeichern, pruefeDatei, DATEI_FELDER, mitarbeiterDarfSehen,
  MITARBEITER_DARF_HOCHLADEN, KATEGORIEN, MAX_DATEI_BYTES,
  type Kategorie,
} from '@/lib/file-storage'

export const dynamic = 'force-dynamic'

// §100 GET /api/files?ownerType=employee&ownerId=…
// Liefert nur Kopfdaten, nie Inhalte. Der Mitarbeiter sieht ausschließlich das,
// was ihm gehört UND freigegeben ist (oder was er selbst eingereicht hat).
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['employee', 'admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const ownerType = req.nextUrl.searchParams.get('ownerType') ?? 'employee'
  const ownerId = req.nextUrl.searchParams.get('ownerId')
  if (!ownerId) return NextResponse.json({ error: 'ownerId fehlt' }, { status: 400 })

  if (ownerType === 'employee') {
    const verweigert = await assertEmployeeAccess(session, ownerId)
    if (verweigert) return verweigert
  } else if (ownerType === 'location') {
    const scope = await allowedLocationScope(session)
    if (scope.kind !== 'all' && !scope.ids.includes(ownerId)) {
      return NextResponse.json({ error: 'Kein Zugriff auf diesen Standort' }, { status: 403 })
    }
  } else {
    return NextResponse.json({ error: 'Unbekannter ownerType' }, { status: 400 })
  }

  const alle = await prisma.storedFile.findMany({
    where: { ownerType, ownerId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { ...DATEI_FELDER, hochgeladenVon: true },
  })

  // Mitarbeiter bekommen eine gefilterte Sicht — auch auf die eigene Akte
  const dateien = session.role === 'employee'
    ? alle.filter(d => mitarbeiterDarfSehen(d, session.employeeId ?? '', session.userId))
    : alle

  return NextResponse.json({ dateien, kategorien: KATEGORIEN, maxBytes: MAX_DATEI_BYTES })
}

// §100 POST /api/files — Datei hochladen (multipart/form-data)
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['employee', 'admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültiger Upload (multipart/form-data erwartet)' }, { status: 400 })
  }

  const datei = form.get('datei')
  if (!(datei instanceof File)) {
    return NextResponse.json({ error: 'Es wurde keine Datei mitgeschickt.' }, { status: 400 })
  }

  const ownerType = String(form.get('ownerType') ?? 'employee')
  const ownerId = String(form.get('ownerId') ?? '')
  const kategorie = String(form.get('kategorie') ?? 'sonstiges') as Kategorie
  if (!ownerId) return NextResponse.json({ error: 'ownerId fehlt' }, { status: 400 })
  if (!(kategorie in KATEGORIEN)) {
    return NextResponse.json({ error: `Unbekannte Kategorie „${kategorie}“` }, { status: 400 })
  }

  // Zugriff prüfen
  let locationId: string | null = null
  if (ownerType === 'employee') {
    const verweigert = await assertEmployeeAccess(session, ownerId)
    if (verweigert) return verweigert
    const emp = await prisma.employee.findUnique({ where: { id: ownerId }, select: { locationId: true } })
    locationId = emp?.locationId ?? null
  } else if (ownerType === 'location') {
    const scope = await allowedLocationScope(session)
    if (scope.kind !== 'all' && !scope.ids.includes(ownerId)) {
      return NextResponse.json({ error: 'Kein Zugriff auf diesen Standort' }, { status: 403 })
    }
    locationId = ownerId
  } else {
    return NextResponse.json({ error: 'Unbekannter ownerType' }, { status: 400 })
  }

  // Der Mitarbeiter reicht seine Krankmeldung ein — er legt sich aber keinen
  // Arbeitsvertrag oder eine Lohnabrechnung selbst in die Akte.
  if (session.role === 'employee' && !MITARBEITER_DARF_HOCHLADEN.includes(kategorie)) {
    return NextResponse.json({
      error: `Als Mitarbeiter kannst du nur ${MITARBEITER_DARF_HOCHLADEN.map(k => KATEGORIEN[k]).join(' und ')} einreichen.`,
    }, { status: 403 })
  }

  const groesse = datei.size
  const mimeType = datei.type || 'application/octet-stream'
  const pruefung = pruefeDatei(datei.name, mimeType, groesse)
  if (!pruefung.ok) return NextResponse.json({ error: pruefung.fehler }, { status: 400 })

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  const daten = Buffer.from(await datei.arrayBuffer())

  const sichtbarRoh = form.get('sichtbarFuerMitarbeiter')
  const gespeichert = await dateiSpeichern({
    customerId,
    locationId,
    ownerType: ownerType as 'employee' | 'location',
    ownerId,
    kategorie,
    dateiname: datei.name,
    mimeType,
    daten,
    hochgeladenVon: session.employeeId ?? session.userId,
    hochgeladenVonName: session.name ?? null,
    notiz: (form.get('notiz') as string) || null,
    gueltigVon: (form.get('gueltigVon') as string) || null,
    gueltigBis: (form.get('gueltigBis') as string) || null,
    // Was der Mitarbeiter selbst einreicht, sieht er auch weiterhin
    sichtbarFuerMitarbeiter: sichtbarRoh === null
      ? (session.role === 'employee' ? true : undefined)
      : sichtbarRoh === 'true',
  })

  return NextResponse.json({ datei: gespeichert }, { status: 201 })
}
