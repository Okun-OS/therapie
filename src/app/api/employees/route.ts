import { NextRequest, NextResponse } from 'next/server'
import { listEmployees, locationIdsForBereiche } from '@/lib/entities'
import { addEmployeeWithInvitation, LocationCustomerMismatchError } from '@/lib/invitations'
import { requireRole, resolveCustomerId, resolveBereichIds } from '@/lib/session'
import { getAppOrigin } from '@/lib/app-url'
import { logAudit } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { urlaubskonto, type Urlaubskonto } from '@/lib/urlaubskonto'

export const dynamic = 'force-dynamic'

/**
 * §238 Das Urlaubskonto kommt vom Server — und zwar für ALLE Masken.
 *
 * DER WEG BIS HIERHER, UND WARUM ER ZU KURZ WAR
 * §235 hat Urlaubsseite und Profil auf `urlaubskonto.ts` gebracht. Das war
 * richtig und hat nicht gereicht: Gemeldet kam zurück, dass auf „Mein Tag"
 * weiter 16 stand. §238 hat auch die umgestellt — und beim Nachsehen lagen
 * noch VIERZEHN weitere Stellen da, die `vacationDaysTotal − vacationDaysUsed`
 * selbst rechnen. In der Belegschaftsliste, in den Berichten, in der
 * Unternehmensansicht, und zweimal in dem, was einem Sprachmodell über einen
 * Menschen erzählt wird.
 *
 * Eine gemeinsame Funktion hilft nur den Stellen, die sie aufrufen. Solange
 * die Zahl im Mitarbeiterdatensatz NICHT dabeisteht, rechnet jede Maske, die
 * sie braucht, wieder selbst — und jede neue Maske fängt wieder von vorn an.
 * Darum steht sie jetzt an der Antwort: Wer `/api/employees` liest, bekommt
 * sie mitgeliefert und hat keinen Grund mehr, sie herzuleiten.
 *
 * ZWEI ZAHLEN, WEIL ES ZWEI FRAGEN SIND
 *   verfuegbar  was noch BEANTRAGT werden kann (offene Anträge abgezogen)
 *   offen       was dieses Jahr noch ZUSTEHT (die rechtliche Zahl)
 * Welche eine Maske zeigt, entscheidet sie — aber herleiten muss sie keine
 * mehr.
 *
 * EINE Abfrage für alle, nicht eine je Person: Bei sechzehn Menschen wären
 * das sechzehn Gelegenheiten, dass eine nicht ankommt.
 */
async function mitUrlaubskonto<T extends { id: string }>(
  employees: T[],
): Promise<(T & { urlaub: Urlaubskonto })[]> {
  if (employees.length === 0) return []
  const antraege = await prisma.vacationRequest.findMany({
    where: { employeeId: { in: employees.map(e => e.id) } },
    select: { employeeId: true, status: true, days: true },
  })
  const jeMensch = new Map<string, { status: string; days: number }[]>()
  for (const a of antraege) {
    const liste = jeMensch.get(a.employeeId) ?? []
    liste.push({ status: a.status, days: a.days })
    jeMensch.set(a.employeeId, liste)
  }
  return employees.map(e => ({
    ...e,
    urlaub: urlaubskonto(
      e as { vacationDaysTotal?: number | null; vacationDaysUsed?: number | null },
      jeMensch.get(e.id) ?? [],
    ),
  }))
}

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId') ?? undefined

  if (session.role === 'okun') {
    // OKUN-Admins dürfen plattformweit lesen, aber immer auf locationId eingrenzen wenn angegeben
    const employees = await listEmployees(undefined, locationId)
    return NextResponse.json({ employees: await mitUrlaubskonto(employees) })
  }

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ employees: [] })

  let employees = await listEmployees(customerId, locationId)

  // Bereichsleiter: zusätzlich auf ihre Bereiche einschränken
  if (session.role === 'company') {
    const bereichIds = await resolveBereichIds(session)
    if (bereichIds.length > 0) {
      const allowedLocationIds = await locationIdsForBereiche(bereichIds)
      employees = employees.filter(e => e.locationId && allowedLocationIds.includes(e.locationId))
    }
  }

  // §108: Ein Mitarbeiter braucht die Liste seiner Kollegen — für den
  // Dienstplan, für Tauschanfragen, fürs Einspringen. Er bekam bisher aber
  // deren VOLLE Daten mit: Stundenkonto, Urlaubsanspruch und verbrauchte
  // Urlaubstage. Das sind Personaldaten und gehen einen Kollegen nichts an.
  //
  // Die eigenen Daten bleiben vollständig — die Mitarbeiter-App zeigt darüber
  // das eigene Stundenkonto und den Resturlaub an.
  const mitKonto = await mitUrlaubskonto(employees)

  if (session.role === 'employee') {
    const gefiltert = mitKonto.map(e =>
      e.id === session.employeeId ? e : kollegenSicht(e),
    )
    return NextResponse.json({ employees: gefiltert })
  }

  return NextResponse.json({ employees: mitKonto })
}

/**
 * §108 Was ein Mitarbeiter über eine Kollegin wissen darf: wer sie ist, was sie
 * kann und wo sie arbeitet. Nicht: was sie verdient, wie viel sie vorgearbeitet
 * hat oder wie viel Urlaub ihr noch bleibt.
 */
function kollegenSicht(e: unknown): Record<string, unknown> {
  const {
    hoursBalance: _hb,
    vacationDaysTotal: _vt,
    vacationDaysUsed: _vu,
    // §238 Das gerechnete Konto geht eine Kollegin genauso wenig an wie die
    // Zahlen, aus denen es entsteht. Ohne diese Zeile hätte die neue Angabe
    // die Sperre von §108 von hinten wieder aufgemacht.
    urlaub: _uk,
    weeklyHours: _wh,
    workDaysPerWeek: _wd,
    preferences: _p,
    birthDate: _bd,
    phone: _ph,
    employmentType: _et,
    ...sichtbar
  } = e as Record<string, unknown>
  return sichtbar
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const { name, email, position, weeklyHours, locationId } = body

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!EMAIL_RE.test(email?.trim() ?? '')) return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 })

  if (!name?.trim() || !email?.trim() || !position?.trim() || !weeklyHours || !locationId) {
    return NextResponse.json({ error: 'name, email, position, weeklyHours und locationId sind erforderlich' }, { status: 400 })
  }

  const expectedCustomerId = session.role === 'okun' ? undefined : await resolveCustomerId(session)
  if (session.role !== 'okun' && !expectedCustomerId) {
    return NextResponse.json({ error: 'Kein Mandant für diesen Nutzer hinterlegt' }, { status: 403 })
  }

  try {
    const { employee, emailSent } = await addEmployeeWithInvitation(
      {
        name,
        email,
        position,
        weeklyHours,
        workDaysPerWeek: body.workDaysPerWeek,
        workDays: body.workDays,
        dailyTargetHours: body.dailyTargetHours,
        fixedOffDays: body.fixedOffDays,
        locationId,
        expectedCustomerId,
        phone: body.phone,
        birthDate: body.birthDate,
        roleType: body.roleType,
        employmentType: body.employmentType,
        gruppe: body.gruppe,
        bereich: body.bereich,
        multiGroupCapable: body.multiGroupCapable,
        fixedLocations: body.fixedLocations,
        qualifications: body.qualifications,
        allowedTasks: body.allowedTasks,
        contractVacationDays: body.contractVacationDays,
        hoursBalanceOffset: body.hoursBalanceOffset,
        preApprovedVacations: body.preApprovedVacations,
      },
      getAppOrigin(req),
      { sendInvitation: body.sendInvitation !== false },
    )

    logAudit({
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      action: 'create',
      entityType: 'employee',
      entityId: employee.id,
      customerId: employee.customerId ?? undefined,
      details: { name: employee.name, email: employee.email },
    }).catch(() => {})

    return NextResponse.json({ employee, emailSent })
  } catch (err: unknown) {
    if (err instanceof LocationCustomerMismatchError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    if (err instanceof Error && err.message === 'Standort nicht gefunden') {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    const prismaErr = err as { code?: string }
    if (prismaErr?.code === 'P2002') {
      return NextResponse.json({ error: 'Diese E-Mail-Adresse ist bereits im System registriert.' }, { status: 409 })
    }
    console.error('employees POST', err)
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
