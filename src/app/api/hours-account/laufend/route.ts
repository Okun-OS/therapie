import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getHoursAccountSummary } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'

export const dynamic = 'force-dynamic'

/**
 * §247 Das Stundenkonto als EINE Zahl.
 *
 * DIE MELDUNG, ZUM ZWEITEN MAL
 * „Es macht keinen Sinn, dass das Stundenkonto auf 0 steht und darunter minus
 * 98 Stunden in diesem Monat. Macht gar keinen Sinn."
 *
 * §243 hatte die zweite Zahl benannt daneben gestellt — in der Annahme, zwei
 * Zahlen mit zwei Namen widersprächen sich nicht. Das war falsch gedacht: Über
 * einer Kachel steht „Stundenkonto", und was darunter steht, liest jeder als
 * dieselbe Sache. Zwei Namen helfen nicht, wenn die Überschrift eine ist.
 *
 * WARUM DIE 0 ÜBERHAUPT DASTAND
 * `Employee.hoursBalance` wächst an genau einer Stelle: beim Freigeben eines
 * Monatsabschlusses. Solange keiner freigegeben ist, steht da null — und
 * gleichzeitig weist die Zeiterfassung den laufenden Monat aus. Beide Zahlen
 * waren richtig und beide unvollständig.
 *
 * WAS HIER GERECHNET WIRD
 * Freigegebener Stand plus alles, was seitdem offen ist — bis einschließlich
 * heute. Das ist die Zahl, die jemand meint, wenn er fragt „wie stehe ich?".
 *
 * WARUM NICHT EINFACH „FREIGEGEBEN PLUS DIESER MONAT"
 * Weil dann die Monate dazwischen fehlten. Bei einem Betrieb, der seit August
 * keinen Abschluss freigegeben hat, wären August und September still unter
 * den Tisch gefallen — ein halber Stand mit dem Etikett des ganzen.
 *
 * WIE WEIT ZURÜCK
 * Bis zum Monat nach dem letzten freigegebenen Abschluss, höchstens aber
 * achtzehn Monate. Die Grenze ist da, damit ein Konto, das noch nie
 * abgeschlossen wurde, nicht beliebig viele Monate durchrechnet; dass sie
 * gegriffen hat, steht in der Antwort (`abgeschnitten`), damit die Oberfläche
 * nicht so tun muss, als sei die Zahl vollständig.
 */

const HOECHSTENS_MONATE = 18

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId') ?? session.employeeId
  if (!employeeId) return NextResponse.json({ konto: null })

  // §109 Zeitdaten gehören genau einer Person.
  const verwehrt = await assertEmployeeAccess(session, employeeId)
  if (verwehrt) return verwehrt

  const person = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { hoursBalance: true, weeklyHours: true, joinedAt: true },
  })
  if (!person) return NextResponse.json({ konto: null })

  const freigegebenMinuten = Math.round((person.hoursBalance ?? 0) * 60)

  /*
   * Ab wann gerechnet wird: der Monat NACH dem letzten freigegebenen
   * Abschluss. Was darin steckt, ist bereits im Stundenkonto enthalten — es
   * noch einmal zu zählen hieße, den Saldo zu verdoppeln.
   */
  const letzter = await prisma.monthlyClosing.findFirst({
    where: { employeeId, releasedAt: { not: null } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    select: { year: true, month: true },
  })

  const heute = new Date()
  const bis = { jahr: heute.getFullYear(), monat: heute.getMonth() + 1 }

  let ab = letzter
    ? naechsterMonat(letzter.year, letzter.month)
    : eintrittOderGrenze(person.joinedAt, bis)

  // Nie weiter zurück als die Grenze — und nie in die Zukunft.
  const grenze = vorMonaten(bis, HOECHSTENS_MONATE - 1)
  const abgeschnitten = vergleiche(ab, grenze) < 0
  if (abgeschnitten) ab = grenze
  if (vergleiche(ab, bis) > 0) ab = bis

  let offenMinuten = 0
  const monate: { jahr: number; monat: number; minuten: number }[] = []
  for (let m = ab; vergleiche(m, bis) <= 0; m = naechsterMonat(m.jahr, m.monat)) {
    /*
     * Ein Monat, für den es bereits einen FREIGEGEBENEN Abschluss gibt, wird
     * übersprungen — auch wenn er nach dem letzten liegt. Abschlüsse müssen
     * nicht lückenlos in der Reihenfolge freigegeben worden sein.
     */
    const schonDrin = await prisma.monthlyClosing.findFirst({
      where: { employeeId, year: m.jahr, month: m.monat, releasedAt: { not: null } },
      select: { id: true },
    })
    if (schonDrin) continue

    const s = await getHoursAccountSummary(
      employeeId, m.jahr, m.monat, person.weeklyHours ?? undefined, heute)
    const delta = s.istMinutes + s.overtimeMinutes - s.sollMinutes
    offenMinuten += delta
    if (delta !== 0) monate.push({ jahr: m.jahr, monat: m.monat, minuten: delta })
  }

  return NextResponse.json({
    konto: {
      freigegebenMinuten,
      offenMinuten,
      gesamtMinuten: freigegebenMinuten + offenMinuten,
      abJahr: ab.jahr,
      abMonat: ab.monat,
      abgeschnitten,
      monate,
    },
  })
}

// ── Monatsrechnen, ohne Zeitzonen ─────────────────────────────────────────

interface Monat { jahr: number; monat: number }

function naechsterMonat(jahr: number, monat: number): Monat {
  return monat >= 12 ? { jahr: jahr + 1, monat: 1 } : { jahr, monat: monat + 1 }
}

function vorMonaten(m: Monat, anzahl: number): Monat {
  const gesamt = m.jahr * 12 + (m.monat - 1) - anzahl
  return { jahr: Math.floor(gesamt / 12), monat: (gesamt % 12) + 1 }
}

function vergleiche(a: Monat, b: Monat): number {
  return a.jahr !== b.jahr ? a.jahr - b.jahr : a.monat - b.monat
}

/**
 * Ohne je freigegebenen Abschluss: ab dem Eintritt.
 *
 * Vor dem Eintritt gibt es kein Soll — dort zu rechnen erzeugte Minusstunden
 * für eine Zeit, in der die Person noch gar nicht da war.
 */
function eintrittOderGrenze(joinedAt: string | null | undefined, bis: Monat): Monat {
  const teile = (joinedAt ?? '').split('-')
  const jahr = Number(teile[0])
  const monat = Number(teile[1])
  if (!Number.isFinite(jahr) || !Number.isFinite(monat) || monat < 1 || monat > 12) {
    return vorMonaten(bis, HOECHSTENS_MONATE - 1)
  }
  return { jahr, monat }
}
