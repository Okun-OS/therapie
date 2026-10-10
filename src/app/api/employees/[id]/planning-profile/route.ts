import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { pruefeTagesmuster, moeglicheArbeitstage } from '@/lib/tagesmuster'

/**
 * §171 Diese Route prüfte die Rolle, aber nicht den Standort.
 *
 * Jede Leitung mit der Rolle „admin" konnte damit das Planungsprofil JEDES
 * Mitarbeiters lesen und überschreiben — auch beim Wettbewerber, sobald sie
 * eine Kennung kannte. Schichtvorliebe, Wochenendvereinbarung, Kinderabhol-
 * zeiten und die dauerhafte Planungsnotiz sind dabei nicht harmlos: Aus
 * ihnen lassen sich Familienverhältnisse ablesen.
 *
 * `assertEmployeeAccess` (§109) ist die eine Stelle, an der so etwas
 * entschieden wird. Sie hat hier von Anfang an gefehlt.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session
  const verwehrt = await assertEmployeeAccess(session, params.id)
  if (verwehrt) return verwehrt
  const profile = await prisma.employeePlanningProfile.findUnique({ where: { employeeId: params.id } })
  return NextResponse.json({ profile })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session
  const verwehrt = await assertEmployeeAccess(session, params.id)
  if (verwehrt) return verwehrt
  const body = await req.json()
  const {
    shiftPreference, childPickupTimes, maxConsecutiveDays, weekendRule,
    planningNote, surchargeMode, surchargeOverrides,
  } = body

  // §171 Wie viele Wochenstunden dieser Mensch IM DIENSTPLAN belegt.
  //
  // Leer heißt: die Vertragsstunden. Gesetzt heißt: nur so viel wird verplant
  // — der Rest der Vertragszeit ist etwas anderes. Eine Leitung mit 40
  // Vertragsstunden und 0 Planstunden ist der Normalfall dafür: Leitungszeit
  // ist keine Gruppenzeit. Ohne dieses Feld musste der Rechendienst ihre 40
  // Stunden irgendwo unterbringen und stellte sie jeden Tag in eine Gruppe —
  // der Plan sah besetzt aus und war es nicht.
  //
  // Eine 0 ist ein gültiger Wert und darf nicht als „nicht gesetzt" gelesen
  // werden; genau das ist der Grund für die ausdrückliche Prüfung auf null.
  const rohStunden = body.planungsStundenSoll
  let planungsStundenSoll: number | null = null
  if (rohStunden !== null && rohStunden !== undefined && rohStunden !== '') {
    const zahl = Number(rohStunden)
    if (!Number.isFinite(zahl) || zahl < 0 || zahl > 60) {
      return NextResponse.json(
        { error: 'Planstunden müssen zwischen 0 und 60 liegen' }, { status: 400 },
      )
    }
    planungsStundenSoll = zahl
  }

  /*
   * §181 Das Tagesmuster — und die Prüfung, die den Betrieb davor bewahrt,
   * ohne Dienstplan dazustehen.
   *
   * Muster und Stundenzahl müssen zusammenpassen. Tun sie es nicht, findet
   * der Rechendienst keinen zulässigen Plan — nicht für diese Person, sondern
   * für den ganzen Standort — und meldet dabei Ursachen, die nicht zutreffen
   * (Urlaube, Ruhezeiten, Stundenlimit). Deshalb wird hier abgelehnt, mit
   * den beiden Zahlen im Satz, und nicht später im Rechendienst.
   */
  const mitarbeiter = await prisma.employee.findUnique({
    where: { id: params.id },
    select: { weeklyHours: true, workDaysPerWeek: true, fixedOffDays: true },
  })
  const sollStunden = planungsStundenSoll ?? mitarbeiter?.weeklyHours ?? null
  const geprueft = pruefeTagesmuster(
    body.tagesmuster,
    sollStunden,
    moeglicheArbeitstage(mitarbeiter?.workDaysPerWeek, mitarbeiter?.fixedOffDays),
  )
  if (geprueft.fehler) {
    return NextResponse.json({ error: geprueft.fehler }, { status: 400 })
  }

  const werte = {
    shiftPreference: shiftPreference ?? 'keine',
    childPickupTimes: childPickupTimes ?? [],
    maxConsecutiveDays: maxConsecutiveDays ?? 0,
    weekendRule: weekendRule ?? null,
    planningNote: planningNote ?? null,
    planungsStundenSoll,
    // Prisma kennt für ein JSON-Feld nur sein eigenes Eingabeformat; eine
    // Liste von Objekten passt erst nach dieser Umdeutung hinein. Geprüft ist
    // sie an dieser Stelle längst.
    tagesmuster: geprueft.muster
      ? (geprueft.muster as unknown as Prisma.InputJsonValue)
      : Prisma.DbNull,
    surchargeMode: surchargeMode ?? 'unternehmensregel',
    surchargeOverrides: surchargeOverrides ?? null,
  }

  const profile = await prisma.employeePlanningProfile.upsert({
    where: { employeeId: params.id },
    create: { employeeId: params.id, ...werte },
    update: werte,
  })
  return NextResponse.json({ profile })
}
