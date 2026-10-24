import { NextRequest, NextResponse } from 'next/server'
import { respondToOvertimeRequest } from '@/lib/time-tracking-entities'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const { status, respondedBy, approvedMinutes, adminComment } = await req.json()
  if (!status || !respondedBy) {
    return NextResponse.json({ error: 'status und respondedBy sind erforderlich' }, { status: 400 })
  }

  // §109: Eine Leitung konnte Antraege FREMDER Standorte genehmigen — es wurde
  // nur die Rolle geprueft, nicht die Zustaendigkeit.
  const antrag = await prisma.overtimeRequest.findUnique({
    where: { id: params.id },
    select: { employeeId: true },
  })
  if (!antrag) return NextResponse.json({ error: 'Antrag nicht gefunden' }, { status: 404 })
  const verweigert = await assertEmployeeAccess(session, antrag.employeeId)
  if (verweigert) return verweigert

  await respondToOvertimeRequest(params.id, status, respondedBy, approvedMinutes, adminComment)
  return NextResponse.json({ success: true })
}

/**
 * §204 DELETE /api/overtime-requests/[id] — den eigenen Antrag zurückziehen.
 *
 * WAS VORHER FEHLTE
 * Nichts führte hier heraus. Wer sich beim Ausstempeln vertippt hatte oder
 * versehentlich Mehrarbeit gemeldet hatte, bekam den Antrag nicht mehr weg;
 * die Leitung konnte ihn nur genehmigen oder ablehnen. Ein Mensch musste
 * also eine fremde Entscheidung über seinen eigenen Irrtum erbitten — und in
 * der Liste der Leitung stand ein Posten, der nie gemeint war.
 *
 * WER UND WANN
 * Nur der Antragsteller selbst, und nur **solange nichts entschieden ist**.
 * Beides ist wichtig:
 *
 *   – Die Leitung darf hier nicht löschen. Sie hat zwei Werkzeuge,
 *     genehmigen und ablehnen, und beide hinterlassen eine Spur. Ein stilles
 *     Verschwinden eines fremden Antrags wäre etwas anderes: Dann stünde
 *     Aussage gegen Aussage darüber, ob er je gestellt wurde.
 *   – Ein entschiedener Antrag bleibt. „Zurückziehen" nach der Genehmigung
 *     hieße, eine Entscheidung zu tilgen, an der womöglich schon eine
 *     Auszahlung hängt.
 *
 * WARUM WIRKLICH GELÖSCHT WIRD UND NICHT NUR UMGESCHALTET
 * Weil der Antrag die Spur nicht trägt. Was wirklich passiert ist, steht am
 * Zeiteintrag: `abweichung` und `grundGehen` (§203) bleiben unberührt. Die
 * Leitung sieht also weiterhin „länger geblieben, Übergabe hat gedauert" —
 * nur eben nicht mehr als offenen Posten, über den sie entscheiden soll.
 * Ein Status „zurückgezogen" wäre dagegen eine Zeile, die jede Liste und
 * jede Auswertung ab jetzt mitschleppen müsste, ohne je etwas zu bedeuten.
 *
 * Das Protokoll hält den Vorgang fest — dort gehören Spuren hin, nicht in
 * eine Statusspalte, die nebenbei auch noch Arbeit macht.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const antrag = await prisma.overtimeRequest.findUnique({
    where: { id: params.id },
    select: {
      id: true, employeeId: true, status: true, date: true,
      overtimeMinutes: true, reason: true,
    },
  })
  if (!antrag) {
    return NextResponse.json({ error: 'Antrag nicht gefunden' }, { status: 404 })
  }

  if (!session.employeeId || session.employeeId !== antrag.employeeId) {
    // Bewusst 403 und nicht 404: Dass es den Antrag gibt, weiß der Aufrufer
    // ohnehin, wenn er die Kennung hat. Eine irreführende Antwort hilft hier
    // niemandem und erschwert nur die Fehlersuche.
    return NextResponse.json(
      { error: 'Einen Überstundenantrag kann nur zurückziehen, wer ihn gestellt hat.' },
      { status: 403 },
    )
  }

  if (antrag.status !== 'pending') {
    return NextResponse.json({
      error: 'Über diesen Antrag ist schon entschieden worden. '
        + 'Wende dich an deine Leitung, wenn etwas nicht stimmt.',
      code: 'SCHON_ENTSCHIEDEN',
    }, { status: 409 })
  }

  await prisma.overtimeRequest.delete({ where: { id: antrag.id } })

  await logAudit({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: 'delete',
    entityType: 'OvertimeRequest',
    entityId: antrag.id,
    customerId: (await resolveCustomerId(session)) ?? undefined,
    details: {
      zurueckgezogen: true,
      datum: antrag.date,
      minuten: antrag.overtimeMinutes,
      grund: antrag.reason,
    },
  })

  return NextResponse.json({ ok: true })
}
