import { NextRequest, NextResponse } from 'next/server'
import { listEmployees } from '@/lib/entities'
import { getVacationRules } from '@/lib/vacation-entities'
import { notifyEmployee } from '@/lib/notify'
import { requireRole } from '@/lib/session'
import { locationFilter } from '@/lib/scope'

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  let body: { locationId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { locationId } = body
  // §110 Standortprüfung: Die Rolle allein genügt nicht — eine Leitung darf nur
  // den EIGENEN Standort verändern, nicht den eines fremden Kunden.
  const erlaubt = await locationFilter(session, locationId)
  if (erlaubt instanceof NextResponse) return erlaubt

  if (!locationId) {
    return NextResponse.json({ error: 'locationId ist erforderlich' }, { status: 400 })
  }

  const allEmployees = await listEmployees()
  const employees = allEmployees.filter(e => e.locationId === locationId && e.role === 'employee' && e.active)

  /*
   * §231 Die Aufforderung gilt jetzt den ANTRÄGEN, nicht den Wunschmonaten.
   *
   * Vorher stand hier „trage deine Urlaubswünsche ein" und führte in eine
   * zweite Maske mit bevorzugten Monaten. Die ist entfallen: Aus „Juli" und
   * „Juli" ließ sich keine Überschneidung erkennen, und genau das zu sehen ist
   * der Zweck der Jahresplanung. Die Frist steht in der Nachricht, weil sie
   * der Grund ist, jetzt zu handeln und nicht irgendwann.
   */
  const regeln = await getVacationRules(locationId)
  const frist = regeln?.antragsfrist
  const bisWann = frist
    ? ` Bitte bis zum ${frist.split('-').reverse().join('.')} einreichen — alles, was `
      + 'bis dahin da ist, wird gemeinsam geplant.'
    : ' Bitte den Urlaub im Mitarbeiterportal beantragen.'

  await Promise.all(
    employees.map(emp =>
      notifyEmployee(emp.id, {
        type: 'vacation-wishes-campaign',
        title: 'Urlaub für die Jahresplanung beantragen',
        body: `Die Jahresurlaubsplanung startet.${bisWann}`,
        url: '/employee/vacation',
      }),
    ),
  )

  return NextResponse.json({ notified: employees.length })
}
