import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess, locationFilter } from '@/lib/scope'
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

// GET /api/employee-planning-profile?employeeId=xxx  oder  ?locationId=xxx
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'employee'])
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  const locationId = req.nextUrl.searchParams.get('locationId')

  /*
   * §227 Alle Profile eines Standorts auf einmal.
   *
   * Der Dienstplan braucht zu jedem Menschen das Tagesmuster, um einen
   * Krankheitstag mit den Stunden gutzuschreiben, die ohne ihn angefallen
   * wären. Sechzehn einzelne Abfragen beim Öffnen des Plans wären sechzehn
   * Gelegenheiten, dass eine davon nicht ankommt — und dann steht bei einem
   * Menschen eine falsche Zahl, ohne dass es auffällt.
   *
   * Hier kommt NUR, was der Plan rechnet: Stundenzahl und Muster. Die
   * Abholzeiten und die Planungsnotiz bleiben, wo sie sind — ein Feld, das
   * eine Oberfläche nicht braucht, hat in ihrer Antwort nichts zu suchen.
   */
  if (!employeeId && locationId) {
    /*
     * §227 Die Rolle muss hier eigens geprüft werden.
     *
     * `locationFilter` ist ein Standortfilter und kein Rollenschloss: Der
     * Standortbereich eines Mitarbeiters umfasst alle Kolleginnen und Kollegen
     * (siehe §109 in `scope.ts`). Beim ersten Versuch gab diese Liste deshalb
     * jedem angemeldeten Mitarbeiter die Stundenzahl der ganzen Belegschaft —
     * nachgemessen am 24.10.2026 mit HTTP 200, wo 403 hingehört.
     *
     * Das eigene Profil bleibt über `?employeeId=` erreichbar; dort entscheidet
     * `assertEmployeeAccess`, und das lässt genau den eigenen Datensatz durch.
     */
    if (session.role !== 'admin' && session.role !== 'company' && session.role !== 'okun') {
      return NextResponse.json(
        { error: 'Die Profile eines Standorts sieht nur die Leitung.' }, { status: 403 },
      )
    }
    const erlaubt = await locationFilter(session, locationId)
    if (erlaubt instanceof NextResponse) return erlaubt

    const belegschaft = await prisma.employee.findMany({
      where: { locationId }, select: { id: true },
    })
    const profile = await prisma.employeePlanningProfile.findMany({
      where: { employeeId: { in: belegschaft.map(e => e.id) } },
      select: { employeeId: true, planungsStundenSoll: true, tagesmuster: true },
    })
    return NextResponse.json({ profile: null, profile_liste: profile })
  }

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
  // §200 Nur noch die Schichtvorliebe. Abholzeiten, Wochenend-Vereinbarung,
  // Folgetage und Planungsnotiz hat kein Rechenkern gelesen; sie sind aus der
  // Maske entfernt und werden auch hier nicht mehr angenommen.
  const { employeeId, shiftPreference } = body

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
    },
    update: {
      ...(shiftPreference !== undefined && { shiftPreference }),
    },
  })

  return NextResponse.json({ profile })
}
