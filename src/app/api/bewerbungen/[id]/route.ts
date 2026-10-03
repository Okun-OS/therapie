import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { bewerbungsFilter } from '@/lib/bewerber-zugriff'
import { logAudit } from '@/lib/audit'
import { sendEmail } from '@/lib/email'
import { getAppOrigin } from '@/lib/app-url'
import { addEmployeeWithInvitation } from '@/lib/invitations'
import { fristenFuerPersonAnlegen } from '@/lib/fristen-zuweisung'

export const dynamic = 'force-dynamic'

/**
 * §148 Eine einzelne Bewerbung: Verlauf, Nachricht an den Bewerber,
 * Übernahme in die Personalakte.
 *
 * WARUM DIE NACHRICHT ÜBER DAS PROGRAMM GEHT UND NICHT ÜBER OUTLOOK
 * Weil der Verlauf sonst nicht vollständig ist. Eine Einladung zum Gespräch,
 * die nur im Postfach einer Standortleitung liegt, ist bei ihrer Krankheit
 * verschwunden — und im Streitfall auch.
 *
 * WARUM DIE ÜBERNAHME EIN EIGENER WEG IST
 * Weil dabei zwei Dinge gleichzeitig geschehen müssen: Es entsteht ein
 * Mitarbeiter samt Einladung, und die Bewerbung hört auf, eine Bewerbung zu
 * sein. Getrennt gemacht, entstehen genau die Fälle, die niemand mehr
 * geradezieht — ein Mitarbeiter, dessen Bewerbung auf „neu" steht, oder eine
 * Einstellung ohne Personalakte.
 */

async function holen(req: NextRequest, id: string) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return { antwort: session }

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return {
      antwort: NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 }),
    }
  }
  const bewerbung = await prisma.bewerbung.findFirst({
    where: { id, ...(await bewerbungsFilter(session, customerId)) },
  })
  if (!bewerbung) {
    return { antwort: NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 }) }
  }
  return { session, customerId, bewerbung }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { antwort, bewerbung, customerId } = await holen(req, params.id)
  if (antwort) return antwort

  const [verlauf, dateien] = await Promise.all([
    prisma.bewerbungEreignis.findMany({
      where: { bewerbungId: params.id }, orderBy: { createdAt: 'asc' },
    }),
    prisma.storedFile.findMany({
      where: {
        customerId, ownerType: 'bewerbung', ownerId: params.id, deletedAt: null,
      },
      select: {
        id: true, dateiname: true, mimeType: true, groesse: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return NextResponse.json({ bewerbung, verlauf, dateien })
}

/**
 * Zwei Aktionen an einer Adresse: eine Nachricht schicken oder übernehmen.
 *
 * Bewusst über `aktion` und nicht über zwei Unterpfade — beides sind
 * Vorgänge an derselben Bewerbung, und beide müssen dieselbe Zugriffsprüfung
 * durchlaufen. Zwei Pfade wären zwei Gelegenheiten, eine davon zu vergessen.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { antwort, session, customerId, bewerbung } = await holen(req, params.id)
  if (antwort) return antwort

  const body = await req.json().catch(() => ({}))
  const aktion = String(body.aktion ?? '')

  if (aktion === 'nachricht') {
    const betreff = String(body.betreff ?? '').trim()
    const text = String(body.text ?? '').trim()
    if (!betreff || !text) {
      return NextResponse.json({ error: 'Betreff und Text fehlen.' }, { status: 400 })
    }
    await sendEmail(bewerbung!.email, betreff.slice(0, 200), text.slice(0, 20_000))
      .catch(() => undefined)
    await prisma.bewerbungEreignis.create({
      data: {
        bewerbungId: params.id, art: 'nachricht',
        text: `E-Mail „${betreff.slice(0, 120)}“ an ${bewerbung!.email}`,
        vonName: session!.name ?? session!.email,
      },
    })
    return NextResponse.json({ ok: true })
  }

  if (aktion === 'uebernehmen') {
    if (bewerbung!.employeeId) {
      return NextResponse.json(
        { error: 'Diese Bewerbung ist bereits übernommen.', employeeId: bewerbung!.employeeId },
        { status: 409 },
      )
    }
    const locationId = String(body.locationId ?? bewerbung!.locationId ?? '')
    const position = String(body.position ?? bewerbung!.stelleTitel ?? '').trim()
    const weeklyHours = Number(body.weeklyHours ?? 0)
    if (!locationId) {
      return NextResponse.json(
        { error: 'An welchem Standort fängt die Person an?' }, { status: 400 },
      )
    }
    if (!position) {
      return NextResponse.json({ error: 'Eine Position fehlt.' }, { status: 400 })
    }
    if (!weeklyHours || weeklyHours <= 0) {
      return NextResponse.json({ error: 'Die Wochenstunden fehlen.' }, { status: 400 })
    }

    let employee
    try {
      const ergebnis = await addEmployeeWithInvitation(
        {
          name: bewerbung!.name,
          email: bewerbung!.email,
          position, weeklyHours, locationId,
          expectedCustomerId: session!.role === 'okun' ? undefined : customerId,
          phone: bewerbung!.telefon ?? undefined,
        },
        getAppOrigin(req),
        { sendInvitation: body.einladen !== false },
      )
      employee = ergebnis.employee
    } catch (err) {
      const code = (err as { code?: string })?.code
      if (code === 'P2002') {
        return NextResponse.json(
          {
            error: 'Unter dieser E-Mail-Adresse gibt es die Person schon im '
              + 'System. Bitte im Mitarbeiterverzeichnis nachsehen.',
          },
          { status: 409 },
        )
      }
      const text = err instanceof Error ? err.message : 'Unbekannter Fehler'
      return NextResponse.json({ error: text }, { status: 400 })
    }

    // §146 Ab dem ersten Tag steht die Liste der Pflichtnachweise. Genau am
    // Einstellungstag denkt daran sonst niemand.
    const fristen = await fristenFuerPersonAnlegen(employee.id, customerId!)

    // Die Bewerbungsunterlagen wandern mit in die Personalakte. Sie dort
    // liegen zu lassen, hieße sie in sechs Monaten mit der Bewerbung zu
    // löschen — obwohl die Person inzwischen im Haus arbeitet.
    const uebernommen = await prisma.storedFile.updateMany({
      where: {
        customerId, ownerType: 'bewerbung', ownerId: params.id, deletedAt: null,
      },
      data: {
        ownerType: 'employee', ownerId: employee.id, locationId,
        kategorie: 'bewerbung',
      },
    })

    await prisma.bewerbung.update({
      where: { id: params.id },
      data: {
        status: 'eingestellt', statusAm: new Date(),
        employeeId: employee.id, uebernommenAm: new Date(),
        locationId,
        // §128 Eingestellt heißt: Die Bewerbung wird nicht mehr gelöscht,
        // sondern folgt ab jetzt der Personalakte.
        loeschenAb: null, poolBis: null,
      },
    })
    await prisma.bewerbungEreignis.create({
      data: {
        bewerbungId: params.id, art: 'uebernahme',
        text: `Als Mitarbeiter übernommen — ${position}`
          + (fristen > 0 ? `, ${fristen} Pflichtnachweise angelegt` : ''),
        vonName: session!.name ?? session!.email,
      },
    })
    await logAudit({
      userId: session!.userId, userEmail: session!.email, userRole: session!.role,
      action: 'create', entityType: 'employee', entityId: employee.id,
      customerId, details: { ausBewerbung: params.id },
    })

    return NextResponse.json({
      employee, fristen, unterlagen: uebernommen.count,
    })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}

/**
 * Eine Bewerbung vor Ablauf der Frist löschen.
 *
 * Das ist der Fall „bitte löschen Sie meine Daten" (Art.17 DSGVO). Er ist
 * zulässig, solange kein Verfahren mehr läuft — und danach, weil dann der
 * Zweck entfallen ist. Wer eingestellt wurde, wird hier nicht gelöscht: Aus
 * der Bewerbung ist eine Personalakte geworden, und die hat eigene Fristen.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { antwort, session, customerId, bewerbung } = await holen(req, params.id)
  if (antwort) return antwort

  if (bewerbung!.employeeId || bewerbung!.status === 'eingestellt') {
    return NextResponse.json(
      {
        error: 'Diese Person ist eingestellt. Ihre Unterlagen liegen in der '
          + 'Personalakte und folgen deren Aufbewahrung — sie werden dort '
          + 'gelöscht, nicht hier.',
      },
      { status: 409 },
    )
  }

  await prisma.storedFile.updateMany({
    where: { customerId, ownerType: 'bewerbung', ownerId: params.id },
    data: { deletedAt: new Date() },
  })
  await prisma.bewerbungEreignis.deleteMany({ where: { bewerbungId: params.id } })
  await prisma.bewerbung.delete({ where: { id: params.id } })

  await logAudit({
    userId: session!.userId, userEmail: session!.email, userRole: session!.role,
    action: 'delete', entityType: 'Bewerbung', entityId: params.id,
    customerId, details: { status: bewerbung!.status },
  })
  return NextResponse.json({ ok: true })
}
