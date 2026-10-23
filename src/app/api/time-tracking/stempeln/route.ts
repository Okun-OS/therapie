import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { recordClockIn, recordClockOut } from '@/lib/workforce-score-service'
import {
  pruefeAktion, bestimmeZeitpunkt, alsTag, alsUhrzeit, gearbeiteteMinuten,
  type Stempelaktion,
} from '@/lib/stempeluhr'
import {
  abweichungBeimGehen, abweichungBeimKommen, grundTaugt, alsDauer, dauer,
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
    const jetztUhr = alsUhrzeit(zeit.zeitpunkt)
    /*
     * §219 Gefragt wird nicht nur, OB ein Dienst geplant ist, sondern auch,
     * ob dies der geplante ist.
     *
     * Vorher reichte irgendein Dienst am Tag: Wer um 23 Uhr einstempelte,
     * während 07:15 im Plan stand, wurde nichts gefragt. Die Abweichung fiel
     * dann erst beim Gehen auf — und auch nur, wenn obendrein die Dauer nicht
     * stimmte. Wer um 23 Uhr anfängt und acht Stunden bleibt, hat eine
     * tadellose Dauer und trotzdem nicht den Dienst gearbeitet, der im Plan
     * stand.
     */
    const abwKommen = abweichungBeimKommen(plan, jetztUhr)
    if (abwKommen && !grundTaugt(body.grund)) {
      const spaet = abwKommen.art === 'kommen-spaet'
      return NextResponse.json({
        error: abwKommen.art === 'ohne-dienst'
          ? 'Für heute ist kein Dienst geplant. Bitte sag kurz, warum du '
            + 'trotzdem arbeitest.'
          : `Dein Dienst beginnt um ${abwKommen.plan!.von}. Bitte sag kurz, `
            + 'warum du zu einer anderen Zeit anfängst.',
        code: 'GRUND_NOETIG',
        frage: {
          art: abwKommen.art,
          titel: abwKommen.art === 'ohne-dienst'
            ? 'Du hast heute keinen Dienst'
            : spaet ? 'Du fängst später an als geplant'
              : 'Du fängst früher an als geplant',
          text: abwKommen.art === 'ohne-dienst'
            ? 'Trotzdem einstempeln? Dann schreib bitte kurz dazu, warum — '
              + 'das spart deiner Leitung am Monatsende eine Rückfrage.'
            : `Geplant ist ${abwKommen.plan!.von}–${abwKommen.plan!.bis}, `
              + `jetzt ist es ${jetztUhr} — ${alsDauer(abwKommen.minuten)} `
              + `${spaet ? 'später' : 'früher'}. Schreib bitte kurz dazu, `
              + 'warum. Das spart deiner Leitung am Monatsende eine Rückfrage.',
        },
      }, { status: 422 })
    }

    const log = await prisma.timeLog.create({
      data: {
        employeeId,
        date: tag,
        clockIn: jetztUhr,
        clockInAt: zeit.zeitpunkt,
        locationId: locationId!,
        quelle: zeit.quelle,
        // §219 Der Grund gehört an den Eintrag, gleich welche der drei
        // Abweichungen es war — sonst stünde später eine Begründung ohne
        // Anlass oder ein Anlass ohne Begründung da.
        ...(abwKommen ? {
          grundKommen: String(body.grund).trim().slice(0, 500),
          abweichung: abwKommen.art,
        } : {}),
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

    /*
     * §219 Eine beim Kommen vermerkte Abweichung wird nicht überschrieben.
     *
     * Wer um 23 Uhr angefangen und dafür einen Grund geschrieben hat, soll am
     * Ende nicht als „ohne Dienst" oder „Stunden fehlen" dastehen, wenn das
     * schon erklärt ist. Steht beim Gehen zusätzlich etwas Neues an — die
     * Stunden stimmen nicht —, gewinnt das Neue, denn danach wird bezahlt.
     */
    const kommenVermerkt = laufenderLog!.abweichung
      && String(laufenderLog!.abweichung).startsWith('kommen-')

    await prisma.timeLog.update({
      where: { id: laufenderLog!.id },
      data: {
        clockOut: ende,
        totalMinutes: gesamt,
        breakMinutes: pausenMinuten,
        breakStart: null,
        breakStartAt: null,
        ...(abw ? { abweichung: abw.art }
          : kommenVermerkt ? {} : { abweichung: null }),
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
          /*
           * §219 Hier stand „Du bist früher gegangen". Das war falsch:
           * Verglichen wird die DAUER, nicht die Uhrzeit. Wer um 14 Uhr
           * anfängt und um 22:30 geht, ist nicht früher gegangen — ihm
           * fehlen Stunden. Genau so stand es dann auf dem Bildschirm, und
           * es war nicht zu erklären.
           */
          : `Geplant war ${abw.plan!.von}–${abw.plan!.bis} `
            + `(${alsDauer(dauer(abw.plan!.von, abw.plan!.bis) ?? 0)}). `
            + `Gearbeitet hast du ${alsDauer(gesamt)} — `
            + `${alsDauer(abw.minuten)} ${abw.art === 'laenger' ? 'mehr' : 'weniger'}.`,
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
