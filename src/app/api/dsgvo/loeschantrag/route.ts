import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { allowedLocationScope, assertEmployeeAccess } from '@/lib/scope'

/**
 * §139 Der Antrag, die eigenen Daten löschen zu lassen.
 *
 * WARUM DAS IM PROGRAMM STEHT UND NICHT IN EINER E-MAIL-ADRESSE
 * Art. 17 DSGVO gibt jedem dieses Recht. Apple verlangt seit 2022 zusätzlich,
 * dass eine App, die ein Konto führt, das Löschen auch IN der App anbietet
 * (Richtlinie 5.1.1 v) — ein Hinweis „schreiben Sie uns" reicht dort
 * ausdrücklich nicht und ist ein häufiger Ablehnungsgrund.
 *
 * WARUM NICHT SOFORT GELÖSCHT WIRD
 * Weil es nicht erlaubt wäre. Lohnunterlagen müssen aufbewahrt werden (§147 AO,
 * §257 HGB, §28f SGB IV), und zwar unabhängig davon, was die Person möchte. Ein
 * Knopf, der sofort alles löscht, verstieße gegen Aufbewahrungspflichten und
 * risse der Person am Ende ihre eigene Lohnsteuerbescheinigung weg.
 *
 * Der Antrag geht deshalb an den Arbeitgeber, der ihn mit dem Löschkonzept
 * (§128) abarbeitet: Vorschau, was gelöscht wird, was anonymisiert und was
 * gesperrt statt gelöscht wird. Die Person sieht den Stand ihres Antrags in der
 * App — und bei einer Ablehnung den Grund. Das ist der ehrliche Ablauf, und er
 * ist auch der, den beide Stores akzeptieren.
 */

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  if (!session.employeeId) {
    return NextResponse.json(
      { error: 'Dieser Zugang ist keinem Mitarbeiter zugeordnet.' }, { status: 403 })
  }

  const { begruendung } = await req.json().catch(() => ({}))

  // Zweimal stellen ändert nichts und erzeugt nur Arbeit — der offene Antrag
  // wird zurückgegeben, damit die App ihn anzeigen kann.
  const offen = await prisma.loeschantrag.findFirst({
    where: { employeeId: session.employeeId, status: 'offen' },
  })
  if (offen) return NextResponse.json({ antrag: offen, schonGestellt: true })

  const person = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    select: { name: true, customerId: true },
  })
  if (!person) {
    return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })
  }

  const antrag = await prisma.loeschantrag.create({
    data: {
      employeeId: session.employeeId,
      customerId: person.customerId ?? null,
      personName: person.name,
      begruendung: typeof begruendung === 'string' && begruendung.trim()
        ? begruendung.trim().slice(0, 2000)
        : null,
    },
  })

  return NextResponse.json({ antrag })
}

/**
 * Anträge ansehen.
 *
 * Ein Mitarbeiter sieht ausschließlich seine eigenen — der Antrag einer
 * Kollegin geht ihn nichts an und verriete, dass sie das Haus verlässt.
 */
export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  if (session.role === 'employee') {
    if (!session.employeeId) return NextResponse.json({ antraege: [] })
    const antraege = await prisma.loeschantrag.findMany({
      where: { employeeId: session.employeeId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ antraege })
  }

  const scope = await allowedLocationScope(session)
  if (scope.kind === 'all') {
    const antraege = await prisma.loeschantrag.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json({ antraege })
  }

  // Die Zuordnung läuft über die Standorte, nicht über den beim Antrag
  // vermerkten Kunden: Wer den Standort wechselt, soll nicht aus dem Blick
  // der zuständigen Leitung fallen.
  const leute = await prisma.employee.findMany({
    where: { locationId: { in: scope.ids } },
    select: { id: true },
  })
  const antraege = await prisma.loeschantrag.findMany({
    where: { employeeId: { in: leute.map(l => l.id) } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ antraege })
}

/**
 * Einen Antrag bescheiden.
 *
 * Eine Ablehnung ohne Begründung gibt es nicht: Art. 12 Abs. 4 DSGVO verlangt,
 * dass der Person gesagt wird, warum — und im Regelfall lautet die Antwort
 * „Aufbewahrungsfrist", was sie auch verstehen kann.
 */
export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const { id, status, antwort, loeschungId } = await req.json().catch(() => ({}))
  if (!id || !['erledigt', 'abgelehnt'].includes(status)) {
    return NextResponse.json({ error: 'id und ein gültiger Status sind erforderlich' },
      { status: 400 })
  }
  if (status === 'abgelehnt' && !String(antwort ?? '').trim()) {
    return NextResponse.json(
      { error: 'Eine Ablehnung braucht eine Begründung — das verlangt Art. 12 DSGVO.' },
      { status: 400 })
  }

  const antrag = await prisma.loeschantrag.findUnique({ where: { id } })
  if (!antrag) return NextResponse.json({ error: 'Antrag nicht gefunden' }, { status: 404 })

  const zugriffVerweigert = await assertEmployeeAccess(session, antrag.employeeId)
  if (zugriffVerweigert) return zugriffVerweigert

  const aktualisiert = await prisma.loeschantrag.update({
    where: { id },
    data: {
      status,
      antwort: typeof antwort === 'string' ? antwort.trim().slice(0, 2000) : null,
      bearbeitetVon: session.name ?? session.userId ?? null,
      bearbeitetAm: new Date(),
      loeschungId: typeof loeschungId === 'string' ? loeschungId : null,
    },
  })

  return NextResponse.json({ antrag: aktualisiert })
}
