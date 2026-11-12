import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { auskunftErstellen } from '@/lib/dsgvo-auskunft'
import { erzeugeAuskunftsbeleg } from '@/lib/dsgvo-beleg'
import { SIEGEL_KEKS, siegelSperre } from '@/lib/lohnsiegel'

export const dynamic = 'force-dynamic'

/**
 * §128 GET /api/dsgvo/auskunft?employeeId=…[&format=pdf]
 *
 * Die Auskunft nach Art.15 DSGVO.
 *
 * Ohne employeeId bekommt der Anfragende seine eigene Auskunft — das ist der
 * Regelfall und muss ohne Umweg über die Verwaltung gehen: Art.15 ist ein Recht
 * der Person, nicht eine Gefälligkeit des Arbeitgebers.
 *
 * Zwei Formate, mit Absicht:
 *   ohne format   die vollständigen Einzeldaten, maschinenlesbar (Art.20)
 *   format=pdf    das lesbare Anschreiben mit Erklärung und Fristen
 *
 * Jeder Abruf wird protokolliert. Eine Auskunft versammelt an einer Stelle
 * alles, was über einen Menschen gespeichert ist — wer sie erzeugt, muss
 * nachvollziehbar sein.
 */
export async function GET(req: NextRequest) {
  // Ohne Rollenliste: jede angemeldete Person darf ihre eigene Auskunft holen.
  // Wer nach Daten anderer fragt, wird gleich darauf geprüft.
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId') ?? session.employeeId
  if (!employeeId) {
    return NextResponse.json({ error: 'Kein Mitarbeiter angegeben' }, { status: 400 })
  }

  const verweigert = await assertEmployeeAccess(session, employeeId)
  if (verweigert) return verweigert

  // §201 Die Auskunft versammelt alles an einer Stelle — auch jede
  // Abrechnungszeile. Für den Beschäftigten selbst ist das deshalb die
  // weitere Tür zu denselben Zahlen, die an der Lohnabrechnung verriegelt
  // ist. Warum eine Identitätsprüfung Art. 15 nicht im Weg steht, steht in
  // `src/lib/lohnsiegel.ts`.
  const sperre = siegelSperre({
    rolle: session.role,
    marke: req.cookies.get(SIEGEL_KEKS)?.value,
    userId: session.userId,
    was: 'deine Auskunft zu erhalten',
  })
  if (sperre) return NextResponse.json(sperre, { status: sperre.status })

  const auskunft = await auskunftErstellen(employeeId)
  if (!auskunft) return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })

  const format = req.nextUrl.searchParams.get('format')
  const kurz = auskunft.person.name.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()
  const datenName = `auskunft-${kurz}.json`

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'export', entityType: 'DsgvoAuskunft', entityId: employeeId,
    customerId: (await resolveCustomerId(session)) ?? undefined,
    details: { format: format ?? 'json', eigene: session.employeeId === employeeId },
  })

  if (format !== 'pdf') {
    return NextResponse.json(auskunft)
  }

  const customerId = await resolveCustomerId(session)
  const orgSettings = customerId
    ? await prisma.orgSettings.findUnique({ where: { customerId } })
    : null

  const pdf = await erzeugeAuskunftsbeleg(
    auskunft,
    {
      name: orgSettings?.organizationName ?? auskunft.person.arbeitgeber ?? 'Arbeitgeber',
      strasse: orgSettings?.strasse, plz: orgSettings?.plz, ort: orgSettings?.ort,
    },
    datenName,
  )

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="auskunft-${kurz}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
