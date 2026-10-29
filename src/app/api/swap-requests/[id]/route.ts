import { NextRequest, NextResponse } from 'next/server'
import { respondToSwapRequest } from '@/lib/schedule-entities'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { notifyEmployee } from '@/lib/notify'
import { sendEmail } from '@/lib/email'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { status } = await req.json()
  if (status !== 'accepted' && status !== 'declined') {
    return NextResponse.json({ error: 'status muss accepted oder declined sein' }, { status: 400 })
  }

  const swap = await prisma.swapRequest.findUnique({ where: { id: params.id } })
  if (!swap) return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 })
  if (swap.status !== 'pending') {
    return NextResponse.json({ error: 'Anfrage wurde bereits beantwortet' }, { status: 409 })
  }
  // Only the target employee (or leadership) may respond
  if (session.role === 'employee' && session.employeeId !== swap.targetEmployeeId) {
    return NextResponse.json({ error: 'Nur der angefragte Mitarbeiter kann antworten' }, { status: 403 })
  }

  if (status === 'declined') {
    await respondToSwapRequest(params.id, status)
  }

  if (status === 'accepted') {
    /*
     * §267 Erst tauschen, dann bestätigen — und beides zusammen oder gar
     * nicht.
     *
     * DIE MELDUNG
     * „Ich glaube, es gibt einen Fehler, wenn man bei dem Dienst tauscht,
     *  dass die dann auf einmal gar keinen Dienst mehr haben, obwohl da
     *  getauscht wurde quasi und der Diensttausch nicht richtig vonstatten
     *  geht."
     *
     * WAS HIER STAND
     * Die Anfrage wurde ZUERST auf „angenommen" gesetzt. Danach wurden die
     * beiden Einträge gesucht — und wenn einer davon nicht mehr da war,
     * passierte einfach nichts. Die Anfrage blieb trotzdem auf „angenommen"
     * stehen, beide Menschen bekamen „Schichttausch bestätigt", und im
     * Dienstplan hatte sich nichts geändert.
     *
     * Gemerkt hat das nur die Leitung — in einer E-Mail, in der ganz unten
     * stand: „Achtung: Die Einträge konnten nicht automatisch getauscht
     * werden." Die beiden Beteiligten erfuhren es nicht.
     *
     * WANN DAS PASSIERT
     * Wer seinen Dienst loswerden will, fragt mehrere Leute. Die erste
     * Zusage führt den Tausch aus; danach gehört der Dienst jemand anderem.
     * Sagt die zweite Person später auch zu, findet die Suche nichts mehr.
     * Das ist kein Randfall, sondern der Normalfall bei einem kurzfristigen
     * Ausfall.
     *
     * WAS JETZT PASSIERT
     * Gesucht wird zuerst. Fehlt einer der beiden Dienste, wird abgelehnt und
     * die Anfrage bleibt offen — dann kann die Leitung oder die anfragende
     * Person sie zurückziehen. Und der Tausch selbst läuft samt Bestätigung
     * in EINEM Vorgang: Entweder sind beide Dienste getauscht UND die Anfrage
     * ist bestätigt, oder nichts von beidem.
     */
    const [reqEntry, tgtEntry] = await Promise.all([
      prisma.scheduleEntry.findFirst({
        where: { employeeId: swap.requesterId, date: swap.requesterDate, shiftId: swap.requesterShiftId },
      }),
      prisma.scheduleEntry.findFirst({
        where: { employeeId: swap.targetEmployeeId, date: swap.targetDate, shiftId: swap.targetShiftId },
      }),
    ])

    if (!reqEntry || !tgtEntry) {
      return NextResponse.json({
        error: !reqEntry && !tgtEntry
          ? 'Keiner der beiden Dienste steht noch so im Plan. Der Tausch lässt '
            + 'sich nicht mehr ausführen.'
          : !reqEntry
            ? `Der Dienst am ${swap.requesterDate} gehört ${swap.requesterName} nicht mehr `
              + '— vermutlich wurde er schon anderweitig getauscht.'
            : `Dein Dienst am ${swap.targetDate} steht nicht mehr so im Plan.`,
      }, { status: 409 })
    }

    try {
      await prisma.$transaction(async (tx) => {
        /*
         * `updateMany` mit der bisherigen Zuordnung in der Bedingung, nicht
         * `update` auf die Kennung allein. Der Unterschied zählt, wenn zwei
         * Zusagen im selben Augenblick eintreffen: Wer zu spät kommt, ändert
         * dann nichts und bekommt eine Absage, statt den Dienst der ersten
         * Person zu überschreiben.
         */
        const hin = await tx.scheduleEntry.updateMany({
          where: { id: reqEntry.id, employeeId: swap.requesterId },
          data: { employeeId: swap.targetEmployeeId, note: `Getauscht mit ${swap.requesterName}` },
        })
        const her = await tx.scheduleEntry.updateMany({
          where: { id: tgtEntry.id, employeeId: swap.targetEmployeeId },
          data: { employeeId: swap.requesterId, note: `Getauscht mit ${swap.targetEmployeeName}` },
        })
        const gebucht = await tx.swapRequest.updateMany({
          where: { id: params.id, status: 'pending' },
          data: { status: 'accepted', respondedAt: new Date().toISOString() },
        })
        if (hin.count !== 1 || her.count !== 1 || gebucht.count !== 1) {
          // Wirft und nimmt damit alles zurück — auch die Bestätigung.
          throw new Error('tausch-nicht-mehr-moeglich')
        }
      })
    } catch {
      return NextResponse.json({
        error: 'Der Tausch ließ sich nicht ausführen — der Plan hat sich '
          + 'inzwischen geändert. Bitte die Seite neu laden.',
      }, { status: 409 })
    }

    await notifyEmployee(swap.requesterId, {
      type: 'swap_accepted',
      title: 'Schichttausch bestätigt',
      body: `${swap.targetEmployeeName} hat deinen Schichttausch bestätigt: Du übernimmst ${swap.targetDate}, ${swap.targetEmployeeName} übernimmt ${swap.requesterDate}.`,
      requestId: swap.id,
      url: '/employee/schedule?tab=swaps',
    }).catch(() => {})

    // Inform leadership about the executed swap
    const admin = await prisma.user.findFirst({
      where: { role: 'admin', locationId: swap.locationId },
      select: { email: true },
    })
    if (admin?.email) {
      await sendEmail(
        admin.email,
        'Schichttausch durchgeführt',
        `${swap.requesterName} und ${swap.targetEmployeeName} haben Schichten getauscht:\n` +
        `${swap.requesterName}: ${swap.requesterDate} → ${swap.targetDate}\n` +
        `${swap.targetEmployeeName}: ${swap.targetDate} → ${swap.requesterDate}\n` +
        // §267 Hier stand ein „Achtung, bitte manuell prüfen" für den Fall,
        // dass der Tausch nicht ausgeführt werden konnte. Den Fall gibt es
        // nicht mehr: Dann wird abgelehnt, statt zu bestätigen. Wer diese
        // E-Mail bekommt, kann sich darauf verlassen.
        'Der Dienstplan wurde automatisch aktualisiert.',
      ).catch(() => {})
    }
  } else {
    await notifyEmployee(swap.requesterId, {
      type: 'swap_declined',
      title: 'Schichttausch abgelehnt',
      body: `${swap.targetEmployeeName} hat deine Tausch-Anfrage für ${swap.requesterDate} abgelehnt.`,
      requestId: swap.id,
      url: '/employee/schedule?tab=swaps',
    }).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
