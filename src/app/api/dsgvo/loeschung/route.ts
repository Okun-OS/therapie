import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { loeschPruefung, loeschungAusfuehren, aufraeumen } from '@/lib/dsgvo-loeschung'
import { erzeugeLoeschbeleg } from '@/lib/dsgvo-beleg'

export const dynamic = 'force-dynamic'

/**
 * §128 Löschen von Personendaten.
 *
 *   GET  ?employeeId=…            Vorschau: was würde geschehen
 *   GET  ?employeeId=…&format=pdf Der Löschbericht des letzten Laufs als PDF
 *   POST { employeeId }           Ausführen
 *   POST { aufraeumen: true }     Abgelaufene Fristen im ganzen Haus räumen
 *
 * Wer darf das: company und okun — nicht die Standortleitung. Eine Löschung
 * lässt sich nicht zurücknehmen und betrifft Lohnunterlagen; das ist eine
 * Entscheidung des Unternehmens, keine des Standorts.
 */

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')

  // Ohne Person: die Liste der Löschvorgänge.
  //
  // Sie ist der einzige Weg, an den Nachweis einer VOLLSTÄNDIGEN Löschung zu
  // kommen — danach gibt es den Mitarbeiter nicht mehr, und jede Abfrage über
  // seine Kennung liefe ins Leere. Genau diese Fälle muss man der
  // Aufsichtsbehörde aber zeigen können.
  if (!employeeId) {
    const customerId = await resolveCustomerId(session)
    const vorgaenge = await prisma.loeschvorgang.findMany({
      where: session.role === 'okun' && !customerId ? {} : { customerId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, employeeId: true, personName: true, art: true,
        angestossenVonName: true, createdAt: true,
      },
    })
    return NextResponse.json({ vorgaenge })
  }

  const verweigert = await assertEmployeeAccess(session, employeeId)
  if (verweigert) return verweigert

  if (req.nextUrl.searchParams.get('format') === 'pdf') {
    const vorgang = await prisma.loeschvorgang.findFirst({
      where: { employeeId }, orderBy: { createdAt: 'desc' },
    })
    if (!vorgang) {
      return NextResponse.json(
        { error: 'Für diese Person wurde noch nichts gelöscht.' }, { status: 404 },
      )
    }
    const customerId = await resolveCustomerId(session)
    const orgSettings = customerId
      ? await prisma.orgSettings.findUnique({ where: { customerId } })
      : null
    const pdf = await erzeugeLoeschbeleg(
      vorgang.bericht as never,
      {
        name: orgSettings?.organizationName ?? 'Arbeitgeber',
        strasse: orgSettings?.strasse, plz: orgSettings?.plz, ort: orgSettings?.ort,
      },
    )
    const kurz = vorgang.personName.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="loeschbericht-${kurz}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  const pruefung = await loeschPruefung(employeeId)
  if (!pruefung) return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })

  const vorgaenge = await prisma.loeschvorgang.findMany({
    where: { employeeId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, art: true, angestossenVonName: true, createdAt: true },
  })

  return NextResponse.json({ ...pruefung, vorgaenge })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json().catch(() => ({})) as {
    employeeId?: string; bestaetigt?: boolean; aufraeumen?: boolean
  }
  const customerId = await resolveCustomerId(session)

  // ── Jahreslauf: abgelaufene Fristen räumen ───────────────────────────────
  if (body.aufraeumen) {
    if (session.role !== 'okun') {
      return NextResponse.json(
        { error: 'Der Aufräumlauf wird von OKUN ausgelöst.' }, { status: 403 },
      )
    }
    const berichte = await aufraeumen(session.userId)
    await logAudit({
      userId: session.userId, userEmail: session.email, userRole: session.role,
      action: 'delete', entityType: 'DsgvoAufraeumen',
      customerId: customerId ?? undefined,
      details: { personen: berichte.length },
    })
    return NextResponse.json({ berichte, anzahl: berichte.length })
  }

  // ── Löschung einer Person ────────────────────────────────────────────────
  if (!body.employeeId) {
    return NextResponse.json({ error: 'Kein Mitarbeiter angegeben' }, { status: 400 })
  }
  const verweigert = await assertEmployeeAccess(session, body.employeeId)
  if (verweigert) return verweigert

  // Eine Löschung lässt sich nicht zurücknehmen. Ein versehentlicher Aufruf —
  // ein doppelter Klick, ein wiederholtes Skript — darf sie nicht auslösen.
  if (body.bestaetigt !== true) {
    return NextResponse.json(
      {
        error: 'Die Löschung muss ausdrücklich bestätigt werden.',
        hinweis: 'Rufen Sie zuerst die Vorschau ab und senden Sie dann bestaetigt: true.',
      },
      { status: 400 },
    )
  }

  try {
    const bericht = await loeschungAusfuehren(body.employeeId, {
      angestossenVon: session.userId,
      angestossenVonName: session.name ?? session.email,
    })
    await logAudit({
      userId: session.userId, userEmail: session.email, userRole: session.role,
      action: 'delete', entityType: 'DsgvoLoeschung', entityId: body.employeeId,
      customerId: customerId ?? undefined,
      details: {
        person: bericht.person,
        geloescht: bericht.zeilen.filter(z => z.ergebnis === 'geloescht').length,
        gesperrt: bericht.zeilen.filter(z => z.ergebnis === 'gesperrt').length,
      },
    })
    return NextResponse.json({ bericht })
  } catch (err) {
    // Hindernisse sind keine Programmfehler, sondern die Antwort auf die Frage
    // „darf ich das jetzt?". Sie gehören als Text zurück, nicht als 500er.
    const text = err instanceof Error ? err.message : 'Löschung fehlgeschlagen'
    return NextResponse.json({ error: text }, { status: 409 })
  }
}
