import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { recordClockIn, recordClockOut } from '@/lib/workforce-score-service'
import {
  pruefeAktion, bestimmeZeitpunkt, alsTag, alsUhrzeit, gearbeiteteMinuten,
  type Stempelaktion,
} from '@/lib/stempeluhr'
import {
  abweichungBeimGehen, grundTaugt, alsDauer, dauer,
  type Dienstzeit,
} from '@/lib/stempelgrund'

export const dynamic = 'force-dynamic'

/**
 * §203 Der für diesen Tag geplante Dienst — oder `null`.
 *
 * Die Zeiten am Eintrag gehen vor: Eine Standortleitung kann einen Dienst für
 * eine einzelne Person verschieben, ohne die Schicht für alle zu ändern. Ohne
 * diesen Vorrang fragte das Programm nach einer Begründung für eine
 * Abweichung, die die Leitung selbst angeordnet hat.
 */
async function geplanterDienst(
  employeeId: string, tag: string,
): Promise<Dienstzeit | null> {
  const eintrag = await prisma.scheduleEntry.findFirst({
    where: { employeeId, date: tag, status: { not: 'cancelled' } },
    orderBy: { createdAt: 'asc' },
  })
  if (!eintrag) return null

  if (eintrag.startTime && eintrag.endTime) {
    return { von: eintrag.startTime, bis: eintrag.endTime }
  }

  const schicht = await prisma.shift.findUnique({ where: { id: eintrag.shiftId } })
  if (!schicht) return null
  return { von: schicht.startTime, bis: schicht.endTime }
}

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
    aktion?: Stempelaktion; zeitpunkt?: string; grund?: string
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

  const tag = alsTag(zeit.zeitpunkt)
  let nachfrage: { art: string; text: string; logId: string } | undefined

  if (aktion === 'kommen') {
    /*
     * §203 Ohne geplanten Dienst wird gefragt, nicht gesperrt.
     *
     * Gesperrt wäre falsch: Es gibt den Einspringer, die Übergabe, den
     * Notfall — und wer dann nicht stempeln kann, arbeitet unbezahlt. Was
     * fehlt, ist nicht die Erlaubnis, sondern die Erklärung. Die wird hier
     * verlangt, und zwar in dem Moment, in dem sie noch jemand weiß.
     *
     * Die Prüfung steht auf dem Server und nicht nur im Browser: Ein Gerät,
     * das die Rückfrage überspringt, soll nicht die Lücke sein.
     */
    const plan = await geplanterDienst(employeeId, tag)
    if (!plan && !grundTaugt(body.grund)) {
      return NextResponse.json({
        error: 'Für heute ist kein Dienst geplant. Bitte sag kurz, warum du '
          + 'trotzdem arbeitest.',
        code: 'GRUND_NOETIG',
        frage: {
          art: 'ohne-dienst',
          titel: 'Du hast heute keinen Dienst',
          text: 'Trotzdem einstempeln? Dann schreib bitte kurz dazu, warum — '
            + 'das spart deiner Leitung am Monatsende eine Rückfrage.',
        },
      }, { status: 422 })
    }

    const log = await prisma.timeLog.create({
      data: {
        employeeId,
        date: tag,
        clockIn: alsUhrzeit(zeit.zeitpunkt),
        clockInAt: zeit.zeitpunkt,
        locationId: locationId!,
        quelle: zeit.quelle,
        ...(plan ? {} : {
          grundKommen: String(body.grund).trim().slice(0, 500),
          abweichung: 'ohne-dienst',
        }),
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
    const ende = alsUhrzeit(zeit.zeitpunkt)

    /*
     * §203 Passt die gearbeitete Zeit zum Plan?
     *
     * Verglichen wird die DAUER, nicht die Uhrzeit des Gehens: Wer eine halbe
     * Stunde später kommt und eine halbe Stunde später geht, hat seinen
     * Dienst voll gearbeitet. Ihn dafür um eine Begründung zu bitten wäre
     * Schikane — und eine Rückfrage, die ohne Anlass kommt, wird weggeklickt
     * und ist dann auch dort wertlos, wo es darauf ankommt.
     *
     * Der Plan wird zum TAG DES BEGINNS gesucht. Bei einem Nachtdienst, der
     * um 00:30 endet, steht der Plan beim Vortag — der 06:00-Dienst des
     * Folgetags hat damit nichts zu tun.
     */
    const plan = await geplanterDienst(employeeId, laufenderLog!.date)
    const abw = abweichungBeimGehen(
      plan, { von: laufenderLog!.clockIn, bis: ende })

    await prisma.timeLog.update({
      where: { id: laufenderLog!.id },
      data: {
        clockOut: ende,
        totalMinutes: gesamt,
        breakMinutes: pausenMinuten,
        breakStart: null,
        breakStartAt: null,
        ...(abw ? { abweichung: abw.art } : {}),
        ...(zeit.quelle === 'offline' ? { quelle: 'offline' } : {}),
      },
    })

    if (abw) {
      nachfrage = {
        art: abw.art,
        logId: laufenderLog!.id,
        text: abw.art === 'ohne-dienst'
          ? `Du hast ${alsDauer(abw.minuten)} gearbeitet, ohne dass für heute `
            + 'ein Dienst geplant war.'
          : `Geplant war ${abw.plan!.von}–${abw.plan!.bis} `
            + `(${alsDauer(dauer(abw.plan!.von, abw.plan!.bis) ?? 0)}). `
            + `Du hast ${alsDauer(abw.minuten)} `
            + `${abw.art === 'laenger' ? 'länger gearbeitet' : 'weniger gearbeitet'}.`,
      }
    }
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
    // §203 Gesetzt, wenn die gearbeitete Zeit nicht zum Plan passt. Der
    // Stempel ist dann bereits gesetzt — gefragt wird DANACH, damit niemand
    // vor einem Pflichtfeld steht, der nur nach Hause will.
    nachfrage,
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
