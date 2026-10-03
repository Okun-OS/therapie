import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import {
  mutterschaftszuschuss, krankengeld, arbeitsbescheinigung,
  MUTTERSCHAFTSGELD_KASSE, type Abrechnungsmonat,
} from '@/lib/bescheinigungen'
import { lohnjahr } from '@/lib/lohnjahre'

export const dynamic = 'force-dynamic'

/**
 * §160 Bescheinigungen aus den abgerechneten Monaten.
 *
 * WARUM DAS EIN LESEZUGRIFF IST UND KEIN DOKUMENT
 * Die Arbeitsbescheinigung geht über BEA, die Entgeltbescheinigungen über
 * EEL — beides braucht einen zertifizierten Zugang, den wir nicht haben. Was
 * hier herauskommt, sind die Zahlen: vollständig, aus den abgerechneten
 * Monaten gezogen und mit der Vorschrift daneben, aus der sie folgen. Wer sie
 * einträgt, muss nichts suchen und nichts nachrechnen.
 *
 * WER DAS SEHEN DARF
 * Die Unternehmensebene und die Standortleitung für ihre Leute — sie stellen
 * die Bescheinigung aus. Der Beschäftigte sieht seine eigene: Es sind seine
 * Zahlen, und an ihnen hängt, was er von der Kasse oder der Agentur bekommt.
 */

const ARTEN = ['arbeit', 'krankengeld', 'mutterschaft'] as const
type Art = typeof ARTEN[number]

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const p = req.nextUrl.searchParams
  const art = (ARTEN as readonly string[]).includes(p.get('art') ?? '')
    ? p.get('art') as Art : null
  if (!art) {
    return NextResponse.json(
      { error: `Welche Bescheinigung? Bekannt sind: ${ARTEN.join(', ')}.` },
      { status: 400 })
  }

  const employeeId = session.role === 'employee'
    ? session.employeeId : p.get('employeeId')
  if (!employeeId) {
    return NextResponse.json({ error: 'Für wen?' }, { status: 400 })
  }
  if (session.role !== 'employee') {
    const verweigert = await assertEmployeeAccess(session, employeeId)
    if (verweigert) return verweigert
  }

  const person = await prisma.employee.findFirst({
    where: { id: employeeId, customerId },
    select: { id: true, name: true },
  })
  if (!person) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  const profil = await prisma.employeePayrollProfile.findUnique({
    where: { employeeId },
    select: {
      personalnummer: true, eintrittsdatum: true, austrittsdatum: true,
      sozialversicherungsnummer: true, krankenkasse: true, lohnart: true,
    },
  })

  // Die abgerechneten Monate, absteigend. Zwei Jahre reichen für jede der
  // drei Bescheinigungen; mehr zu laden hilft niemandem.
  const eintraege = await prisma.payrollEntry.findMany({
    where: { employeeId, customerId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 24,
    select: {
      year: true, month: true, svBrutto: true, sonstigeBezuege: true,
      netto: true, regularHours: true, overtimeHours: true, svTage: true,
    },
  })

  const monate: Abrechnungsmonat[] = eintraege.map(e => ({
    jahr: e.year, monat: e.month,
    svBrutto: e.svBrutto,
    einmalzahlungen: e.sonstigeBezuege,
    netto: e.netto,
    stunden: Math.round(((e.regularHours ?? 0) + (e.overtimeHours ?? 0)) * 100) / 100,
    svTage: e.svTage ?? 30,
  }))

  const kopf = {
    person: { id: person.id, name: person.name },
    personalnummer: profil?.personalnummer ?? null,
    sozialversicherungsnummer: profil?.sozialversicherungsnummer ?? null,
    krankenkasse: profil?.krankenkasse ?? null,
    eintrittsdatum: profil?.eintrittsdatum ?? null,
    austrittsdatum: profil?.austrittsdatum ?? null,
    // §160 Das Verfahren gehört dazu: Wer die Zahlen bekommt, muss wissen,
    // wohin sie gehen und dass die Übermittlung nicht hier passiert.
    uebermittlung: art === 'arbeit'
      ? 'Elektronisch über BEA an die Agentur für Arbeit (§313 SGB III). '
        + 'Die Übermittlung läuft über den Steuerberater — dieses Programm '
        + 'liefert die Zahlen.'
      : 'Elektronisch über das EEL-Verfahren an die Krankenkasse '
        + '(§23c Abs. 2 SGB IV). Die Übermittlung läuft über den '
        + 'Steuerberater — dieses Programm liefert die Zahlen.',
  }

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'export', entityType: 'Bescheinigung', entityId: employeeId,
    customerId, details: { art },
  })

  if (art === 'mutterschaft') {
    const tage = Math.max(0, Number(p.get('tage') ?? 98))
    const m = mutterschaftszuschuss(monate, tage)
    return NextResponse.json({
      art, ...kopf,
      mutterschaft: m,
      kasseHoechstbetrag: MUTTERSCHAFTSGELD_KASSE,
    })
  }

  if (art === 'krankengeld') {
    const j = lohnjahr(monate[0]?.jahr ?? new Date().getFullYear())
    if (!j) {
      return NextResponse.json(
        {
          error: 'Für dieses Jahr sind keine geprüften Rechengrößen '
            + 'hinterlegt. Ohne sie wird die Bemessungsgrenze nicht gerechnet.',
        },
        { status: 400 })
    }
    // §47 Abs. 2 Satz 6 SGB V: die Einmalzahlungen der letzten zwölf Monate.
    const einmalJahr = monate.slice(0, 12)
      .reduce((s, m) => s + m.einmalzahlungen, 0)
    return NextResponse.json({
      art, ...kopf,
      krankengeld: krankengeld(monate[0] ?? null, einmalJahr, j),
    })
  }

  const a = arbeitsbescheinigung(monate)
  return NextResponse.json({ art, ...kopf, arbeitsbescheinigung: a })
}
