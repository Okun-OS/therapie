import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { grundTaugt, dauer } from '@/lib/stempelgrund'
import { OVERTIME_REASONS } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * §203 POST /api/time-tracking/begruendung
 *   { logId, grund }
 *
 * Der Grund für eine Abweichung, nachgereicht unmittelbar nach dem
 * Ausstempeln.
 *
 * WARUM EIN EIGENER AUFRUF UND NICHT TEIL DES AUSSTEMPELNS
 * Weil der Stempel auf keinen Fall an der Begründung hängen darf. Wer am Ende
 * einer Doppelschicht auf „Ausstempeln" drückt, muss ausgestempelt sein —
 * auch wenn ihm das Telefon im selben Moment abstürzt, der Akku leer wird
 * oder er die Rückfrage wegwischt. Die gearbeitete Zeit ist Lohn; die
 * Begründung ist Erklärung. Das eine darf das andere nicht blockieren.
 *
 * Fehlt die Begründung, bleibt die Abweichung trotzdem vermerkt. Die
 * Standortleitung sieht dann „länger geblieben, ohne Angabe" — das ist eine
 * ehrliche Auskunft und besser als eine Zahl ohne jeden Hinweis.
 *
 * WER DARF
 * Nur der Mensch, dem die Zeitbuchung gehört. Eine Begründung ist eine
 * Aussage über den eigenen Arbeitstag; sie im Namen eines anderen zu
 * schreiben wäre genau das, was man später niemandem erklären kann.
 */
export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = session.employeeId
  if (!employeeId) {
    return NextResponse.json(
      { error: 'Dieser Zugang gehört zu keinem Mitarbeiter.' }, { status: 403 },
    )
  }

  const { logId, grund, kategorie } = await req.json().catch(() => ({})) as {
    logId?: string; grund?: string; kategorie?: string
  }
  if (!logId) {
    return NextResponse.json({ error: 'Welche Zeitbuchung?' }, { status: 400 })
  }
  if (!grundTaugt(grund)) {
    return NextResponse.json(
      { error: 'Bitte schreib kurz, woran es lag — ein paar Worte genügen.' },
      { status: 400 },
    )
  }

  // Nicht `update` mit `where: { id }`: Dann ließe sich mit einer fremden
  // Kennung eine fremde Buchung beschriften. Erst nachsehen, wem sie gehört.
  const log = await prisma.timeLog.findFirst({
    where: { id: logId, employeeId },
    select: { id: true, abweichung: true },
  })
  if (!log) {
    return NextResponse.json({ error: 'Zeitbuchung nicht gefunden' }, { status: 404 })
  }

  const text = String(grund).trim().slice(0, 500)
  const aktualisiert = await prisma.timeLog.update({
    where: { id: log.id },
    data: { grundGehen: text },
    select: {
      id: true, abweichung: true, grundGehen: true,
      date: true, employeeId: true, locationId: true,
      totalMinutes: true,
    },
  })

  /*
   * §203 Wer länger geblieben ist, stellt damit zugleich den
   * Überstundenantrag.
   *
   * Diesen Antrag gab es schon — ausgelöst wurde er aber von einer zweiten
   * Stempeluhr auf „Meine Zeiten", die jetzt weg ist. Ihn dort zu lassen
   * hätte geheißen: eine Maske, die niemand mehr erreicht, und daneben eine
   * neue Begründung, die nirgends ankommt. Beides zusammen ist schlimmer als
   * eines von beidem.
   *
   * Der Antrag entsteht deshalb hier, mit derselben Begründung. Ohne ihn
   * bliebe Mehrarbeit ein Vermerk am Zeiteintrag — und aus einem Vermerk
   * wird keine bezahlte Überstunde.
   */
  let antrag: { id: string } | null = null
  if (aktualisiert.abweichung === 'laenger') {
    const mehr = await mehrminuten(aktualisiert)
    if (mehr > 0) {
      const person = await prisma.employee.findUnique({
        where: { id: employeeId }, select: { name: true },
      })
      antrag = await prisma.overtimeRequest.create({
        data: {
          employeeId,
          employeeName: person?.name ?? session.name ?? 'Unbekannt',
          locationId: aktualisiert.locationId,
          date: aktualisiert.date,
          timeLogId: aktualisiert.id,
          overtimeMinutes: mehr,
          /*
           * Die Kategorie kommt von der Person, geraten wird nichts. Wählt
           * sie keine, steht „Sonstiges" da — und die Leitung liest den
           * freien Text. Eine erfundene Kategorie wäre schlimmer als keine:
           * In der Übersicht stünde dann „Personalmangel", wo „Übergabe"
           * gemeint war, und danach wird Personal geplant.
           */
          reason: (OVERTIME_REASONS as readonly string[]).includes(String(kategorie))
            ? String(kategorie)
            : 'Sonstiges',
          comment: text,
          submittedAt: new Date().toISOString(),
        },
        select: { id: true },
      }).catch(() => null)
    }
  }

  return NextResponse.json({ ok: true, log: aktualisiert, antrag })
}

/**
 * Wie viele Minuten über dem Plan? Aus denselben Daten wie beim Ausstempeln,
 * damit im Antrag dieselbe Zahl steht wie in der Rückfrage.
 */
async function mehrminuten(log: {
  employeeId: string; date: string; totalMinutes: number | null
}): Promise<number> {
  if (!log.totalMinutes) return 0
  const eintrag = await prisma.scheduleEntry.findFirst({
    where: { employeeId: log.employeeId, date: log.date, status: { not: 'cancelled' } },
    orderBy: { createdAt: 'asc' },
  })
  if (!eintrag) return log.totalMinutes
  let von = eintrag.startTime
  let bis = eintrag.endTime
  if (!von || !bis) {
    const schicht = await prisma.shift.findUnique({ where: { id: eintrag.shiftId } })
    von = schicht?.startTime ?? null
    bis = schicht?.endTime ?? null
  }
  const geplant = von && bis ? dauer(von, bis) : null
  if (geplant === null) return log.totalMinutes
  return Math.max(0, log.totalMinutes - geplant)
}
