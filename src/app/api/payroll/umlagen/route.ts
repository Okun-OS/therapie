import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { betriebsgroesse, U1_GRENZE } from '@/lib/umlagen'
import { lohnjahr } from '@/lib/lohnjahre'

export const dynamic = 'force-dynamic'

/**
 * §159 Die Umlagesätze der Krankenkassen.
 *
 * WARUM DAS GEPFLEGT WERDEN MUSS
 * U1 und U2 stehen nicht im Gesetz, sondern in der Satzung jeder einzelnen
 * Kasse. Sie unterscheiden sich erheblich, und bei der U1 wählt der Betrieb
 * außerdem eine Erstattungsstufe. Ohne diese Angaben rechnet das Programm
 * keine Umlage — und sagt das bei jedem Lohnlauf, bis sie da sind.
 *
 * Die Liste zeigt deshalb auch, welche Kassen bei den eigenen Beschäftigten
 * vorkommen und für welche davon noch nichts hinterlegt ist. Eine Einstellung,
 * die man erst suchen muss, wird nicht gepflegt.
 */

const FELDER = {
  id: true, kasse: true, u1Satz: true, u1Erstattung: true, u2Satz: true,
  gueltigAb: true, notiz: true, updatedAt: true,
} as const

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ saetze: [], kassen: [] })

  const [saetze, profile, beschaeftigte] = await Promise.all([
    prisma.krankenkassensatz.findMany({
      where: { customerId }, orderBy: { kasse: 'asc' }, select: FELDER,
    }),
    prisma.employeePayrollProfile.findMany({
      where: { customerId }, select: { krankenkasse: true },
    }),
    prisma.employee.findMany({
      where: { customerId, active: true }, select: { weeklyHours: true },
    }),
  ])

  // Welche Kassen kommen tatsächlich vor — und für welche fehlt der Satz?
  const vorhanden = new Set(saetze.map(s => s.kasse.toLowerCase()))
  const kassen = Array.from(new Set(
    profile.map(p => (p.krankenkasse ?? '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'de'))
    .map(k => ({ kasse: k, hinterlegt: vorhanden.has(k.toLowerCase()) }))

  const groesse = betriebsgroesse(
    beschaeftigte.map(e => ({ wochenstunden: e.weeklyHours ?? 0 })))

  const j = lohnjahr(new Date().getFullYear())

  return NextResponse.json({
    saetze,
    kassen,
    fehlend: kassen.filter(k => !k.hinterlegt).map(k => k.kasse),
    betriebsgroesse: groesse,
    u1Grenze: U1_GRENZE,
    insolvenzgeld: j
      ? { satz: j.insolvenzgeldUmlage, geprueft: j.insolvenzgeldUmlageGeprueft }
      : null,
  })
}

export async function PUT(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const kasse = String(body.kasse ?? '').trim()
  if (!kasse) {
    return NextResponse.json({ error: 'Welche Krankenkasse?' }, { status: 400 })
  }

  // Ein Satz wird als Prozentzahl eingetragen und als Anteil gespeichert —
  // „2,1" heißt 2,1 %, nicht 210 %. Ein Vertipper um den Faktor hundert wäre
  // sonst erst auf der Abrechnung zu sehen.
  const prozent = (wert: unknown): number | null => {
    if (wert == null || wert === '') return null
    const z = Number(wert)
    if (!Number.isFinite(z) || z < 0 || z > 100) return null
    return Math.round(z * 1000) / 100000
  }

  const u1Satz = prozent(body.u1Satz)
  const u2Satz = prozent(body.u2Satz)
  const u1Erstattung = prozent(body.u1Erstattung)

  if (body.u1Satz != null && body.u1Satz !== '' && u1Satz == null) {
    return NextResponse.json(
      { error: 'Der U1-Satz gehört als Prozentzahl eingetragen, etwa 2,1.' },
      { status: 400 })
  }
  if (body.u2Satz != null && body.u2Satz !== '' && u2Satz == null) {
    return NextResponse.json(
      { error: 'Der U2-Satz gehört als Prozentzahl eingetragen, etwa 0,65.' },
      { status: 400 })
  }

  const gueltigAb = /^\d{4}-\d{2}-\d{2}$/.test(String(body.gueltigAb ?? ''))
    ? String(body.gueltigAb) : new Date().toISOString().slice(0, 10)

  const daten = {
    customerId, kasse, u1Satz, u2Satz, u1Erstattung, gueltigAb,
    notiz: String(body.notiz ?? '').slice(0, 1000).trim() || null,
  }

  const satz = await prisma.krankenkassensatz.upsert({
    where: { customerId_kasse: { customerId, kasse } },
    create: daten,
    update: daten,
    select: FELDER,
  })

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'update', entityType: 'Krankenkassensatz', entityId: satz.id,
    customerId, details: { kasse, u1Satz, u2Satz },
  })

  const hinweise: string[] = []
  if (u1Satz != null && u1Erstattung == null) {
    hinweise.push(
      'Die Erstattungsstufe der U1 fehlt. Ohne sie lässt sich nicht rechnen, '
      + 'was die Kasse bei Entgeltfortzahlung zurückzahlt — sie steht in der '
      + 'Satzung und wird vom Betrieb gewählt.')
  }
  if (u2Satz == null) {
    hinweise.push(
      'Der U2-Satz fehlt. Die Umlage für Mutterschaft gilt für ALLE '
      + 'Arbeitgeber, unabhängig von der Betriebsgröße (§1 Abs. 2 AAG).')
  }
  // Ein U1-Satz über 5 % oder unter 0,5 % ist unüblich — meist ein Vertipper.
  if (u1Satz != null && (u1Satz > 0.05 || u1Satz < 0.005)) {
    hinweise.push(
      `Ein U1-Satz von ${(u1Satz * 100).toLocaleString('de-DE')} % ist `
      + 'unüblich; die Kassen liegen meist zwischen 1 % und 3 %. Lohnt einen '
      + 'zweiten Blick in die Satzung.')
  }

  return NextResponse.json({ satz, hinweise })
}

export async function DELETE(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const vorhanden = await prisma.krankenkassensatz.findFirst({
    where: { id, customerId },
  })
  if (!vorhanden) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  await prisma.krankenkassensatz.delete({ where: { id } })
  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'delete', entityType: 'Krankenkassensatz', entityId: id,
    customerId, details: { kasse: vorhanden.kasse },
  })
  return NextResponse.json({
    ok: true,
    hinweis: 'Gelöscht. Ohne hinterlegten Satz wird für diese Kasse keine '
      + 'Umlage mehr gerechnet — der Lohnlauf sagt es dann bei jedem Durchgang.',
  })
}
