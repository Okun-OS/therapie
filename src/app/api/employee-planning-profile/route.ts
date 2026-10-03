import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { prisma } from '@/lib/prisma'

/**
 * §181 Das Planungsprofil über die Kennung im Abfrageteil.
 *
 * DIESE ROUTE HATTE GAR KEINE ZUGRIFFSPRÜFUNG
 * Die Schwesterroute `/api/employees/[id]/planning-profile` bekam sie in §171.
 * Diese hier blieb übersehen — und sie ist die gefährlichere von beiden: Sie
 * lässt auch die Rolle „employee" herein. Jede angemeldete Person konnte damit
 * das Planungsprofil JEDES Menschen lesen und überschreiben, auch beim
 * Wettbewerber, sobald sie eine Kennung kannte.
 *
 * Harmlos ist das nicht. Kinderabholzeiten, Wochenendvereinbarung und die
 * dauerhafte Planungsnotiz lassen Familienverhältnisse erkennen; das
 * Tagesmuster sagt, wie viel jemand arbeitet.
 *
 * Gefunden beim Durchstich (§181), nicht durch eine Meldung.
 */

// GET /api/employee-planning-profile?employeeId=xxx
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'employee'])
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }

  const verwehrt = await assertEmployeeAccess(session, employeeId)
  if (verwehrt) return verwehrt

  const profile = await prisma.employeePlanningProfile.findUnique({ where: { employeeId } })
  return NextResponse.json({ profile })
}

// PUT /api/employee-planning-profile  { employeeId, shiftPreference, ... }
export async function PUT(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'employee'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { employeeId, shiftPreference, childPickupTimes, maxConsecutiveDays, weekendRule, planningNote } = body

  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }

  // §181 Die Schreibrichtung war die gefährlichere von beiden: Ohne diese
  // Zeile konnte jede angemeldete Person in das Planungsprofil jedes anderen
  // Menschen hineinschreiben — Kinderabholzeiten, Wochenendvereinbarung,
  // Planungsnotiz. Beim Durchstich stand der Lesezugriff schon geschützt da
  // und der Schreibzugriff noch offen.
  const verwehrt = await assertEmployeeAccess(session, employeeId)
  if (verwehrt) return verwehrt

  // §181 Das Tagesmuster steht hier bewusst nicht in der Liste. Es ist eine
  // Angabe aus dem Arbeitsvertrag, keine Vorliebe — wer seine eigenen
  // Dienstlängen setzen dürfte, könnte sich eine Vier-Tage-Woche eintragen.
  // Geändert wird es über `/api/employees/[id]/planning-profile`, und zwar
  // nur von der Leitung und nur zusammen mit der Stundenzahl.
  const profile = await prisma.employeePlanningProfile.upsert({
    where: { employeeId },
    create: {
      employeeId,
      shiftPreference: shiftPreference ?? 'keine',
      childPickupTimes: childPickupTimes ?? [],
      maxConsecutiveDays: maxConsecutiveDays ?? 0,
      weekendRule: weekendRule ?? null,
      planningNote: planningNote ?? null,
    },
    update: {
      ...(shiftPreference !== undefined && { shiftPreference }),
      ...(childPickupTimes !== undefined && { childPickupTimes }),
      ...(maxConsecutiveDays !== undefined && { maxConsecutiveDays }),
      ...(weekendRule !== undefined && { weekendRule }),
      ...(planningNote !== undefined && { planningNote }),
    },
  })

  return NextResponse.json({ profile })
}
