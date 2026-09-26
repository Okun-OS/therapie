import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { recordClockIn, recordClockOut } from '@/lib/workforce-score-service'
import {
  pruefeAktion, bestimmeZeitpunkt, alsTag, alsUhrzeit, gearbeiteteMinuten,
  type Stempelaktion,
} from '@/lib/stempeluhr'

export const dynamic = 'force-dynamic'

/**
 * §137 POST /api/time-tracking/stempeln
 *   { aktion: 'kommen' | 'gehen' | 'pause-start' | 'pause-ende', zeitpunkt?: ISO }
 *
 * Ein Aufruf je Handgriff. Vorher musste der Browser vier Aufrufe in der
 * richtigen Reihenfolge machen und sich merken, welcher davon geklappt hat —
 * und auf der Startseite der Mitarbeiter-App stand ein Knopf „Einstempeln", der
 * überhaupt nichts getan hat außer die Anzeige umzuschalten.
 *
 * Man stempelt immer für sich selbst. Deshalb kommt die Person aus der Sitzung
 * und nicht aus der Anfrage: Wer für jemand anderen nachträgt, ist die
 * Standortleitung, und dafür gibt es einen eigenen Weg mit Namensnennung
 * (`/api/time-logs/backfill`).
 */
export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = session.employeeId
  if (!employeeId) {
    return NextResponse.json(
      { error: 'Dieser Zugang gehört zu keinem Mitarbeiter — gestempelt wird für sich selbst.' },
      { status: 403 },
    )
  }

  const body = await req.json().catch(() => ({})) as {
    aktion?: Stempelaktion; zeitpunkt?: string
  }
  const aktion = body.aktion
  if (!aktion || !['kommen', 'gehen', 'pause-start', 'pause-ende'].includes(aktion)) {
    return NextResponse.json({ error: 'Unbekannter Handgriff' }, { status: 400 })
  }

  const zeit = bestimmeZeitpunkt(body.zeitpunkt)

  // Der Zustand kommt aus der Datenbank, nicht aus dem Browser. Ein Gerät, das
  // eine Weile offline war, weiß nicht mehr, was inzwischen geschehen ist.
  const [laufenderLog, laufendeErfassung] = await Promise.all([
    prisma.timeLog.findFirst({
      where: { employeeId, clockOut: null },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.timeClockEntry.findFirst({
      where: { employeeId, clockOut: null },
      orderBy: { clockIn: 'desc' },
    }),
  ])

  const zustand = {
    laeuft: !!laufenderLog,
    pause: !!laufenderLog?.breakStart,
  }
  const erlaubt = pruefeAktion(aktion, zustand)
  if (!erlaubt.erlaubt) {
    // 409, nicht 400: Die Anfrage ist in Ordnung, nur der Zustand passt nicht.
    // Nach einem Funkloch ist das der Normalfall und kein Fehler des Geräts.
    return NextResponse.json({ error: erlaubt.text, zustand }, { status: 409 })
  }

  const mitarbeiter = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { locationId: true },
  })
  const locationId = mitarbeiter?.locationId ?? session.locationId
  if (!locationId && aktion === 'kommen') {
    return NextResponse.json(
      { error: 'Für diesen Zugang ist kein Standort hinterlegt.' }, { status: 400 },
    )
  }

  let hinweis = zeit.hinweis

  if (aktion === 'kommen') {
    const log = await prisma.timeLog.create({
      data: {
        employeeId,
        date: alsTag(zeit.zeitpunkt),
        clockIn: alsUhrzeit(zeit.zeitpunkt),
        clockInAt: zeit.zeitpunkt,
        locationId: locationId!,
        quelle: zeit.quelle,
      },
    })
    // Die zweite Seite — sie trägt die Pünktlichkeitspunkte. Schlägt sie fehl,
    // steht die Arbeitszeit trotzdem: Punkte sind nett, Lohn ist Pflicht.
    await recordClockIn(employeeId, log.date, locationId!, zeit.zeitpunkt).catch(() => undefined)
  }

  if (aktion === 'gehen') {
    const beginn = laufenderLog!.clockInAt ?? laufenderLog!.createdAt
    // Eine noch laufende Pause endet mit dem Ausstempeln — sonst zählte sie
    // bis in alle Ewigkeit weiter.
    let pausenMinuten = laufenderLog!.breakMinutes ?? 0
    if (laufenderLog!.breakStartAt) {
      pausenMinuten += gearbeiteteMinuten(laufenderLog!.breakStartAt, zeit.zeitpunkt)
      hinweis = (hinweis ? `${hinweis} ` : '')
        + 'Die laufende Pause wurde mit dem Ausstempeln beendet.'
    }

    const gesamt = Math.max(0, gearbeiteteMinuten(beginn, zeit.zeitpunkt) - pausenMinuten)
    await prisma.timeLog.update({
      where: { id: laufenderLog!.id },
      data: {
        clockOut: alsUhrzeit(zeit.zeitpunkt),
        totalMinutes: gesamt,
        breakMinutes: pausenMinuten,
        breakStart: null,
        breakStartAt: null,
        ...(zeit.quelle === 'offline' ? { quelle: 'offline' } : {}),
      },
    })
    if (laufendeErfassung) {
      await recordClockOut(laufendeErfassung.id, zeit.zeitpunkt).catch(() => undefined)
    }
  }

  if (aktion === 'pause-start') {
    await prisma.timeLog.update({
      where: { id: laufenderLog!.id },
      data: { breakStart: alsUhrzeit(zeit.zeitpunkt), breakStartAt: zeit.zeitpunkt },
    })
  }

  if (aktion === 'pause-ende') {
    const beginn = laufenderLog!.breakStartAt
    const dazu = beginn ? gearbeiteteMinuten(beginn, zeit.zeitpunkt) : 0
    await prisma.timeLog.update({
      where: { id: laufenderLog!.id },
      data: {
        breakMinutes: (laufenderLog!.breakMinutes ?? 0) + dazu,
        breakStart: null,
        breakStartAt: null,
      },
    })
  }

  // Immer der frische Zustand zurück — das Gerät muss nichts mitrechnen.
  const jetztLog = await prisma.timeLog.findFirst({
    where: { employeeId, clockOut: null },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    zustand: { laeuft: !!jetztLog, pause: !!jetztLog?.breakStart },
    log: jetztLog,
    quelle: zeit.quelle,
    hinweis,
  })
}

/**
 * GET /api/time-tracking/stempeln — der aktuelle Zustand.
 *
 * Eine eigene Abfrage, weil die App sie bei jedem Öffnen braucht: Wer gestern
 * vergessen hat auszustempeln, soll das sofort sehen.
 */
export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = session.employeeId
  if (!employeeId) return NextResponse.json({ zustand: { laeuft: false, pause: false } })

  const log = await prisma.timeLog.findFirst({
    where: { employeeId, clockOut: null },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    zustand: { laeuft: !!log, pause: !!log?.breakStart },
    log,
  })
}
