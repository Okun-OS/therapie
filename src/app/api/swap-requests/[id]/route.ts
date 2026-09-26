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

  await respondToSwapRequest(params.id, status)

  if (status === 'accepted') {
    // §73: actually swap the two schedule entries (exchange the employees)
    const [reqEntry, tgtEntry] = await Promise.all([
      prisma.scheduleEntry.findFirst({
        where: { employeeId: swap.requesterId, date: swap.requesterDate, shiftId: swap.requesterShiftId },
      }),
      prisma.scheduleEntry.findFirst({
        where: { employeeId: swap.targetEmployeeId, date: swap.targetDate, shiftId: swap.targetShiftId },
      }),
    ])
    if (reqEntry && tgtEntry) {
      await prisma.$transaction([
        prisma.scheduleEntry.update({
          where: { id: reqEntry.id },
          data: { employeeId: swap.targetEmployeeId, note: `Getauscht mit ${swap.requesterName}` },
        }),
        prisma.scheduleEntry.update({
          where: { id: tgtEntry.id },
          data: { employeeId: swap.requesterId, note: `Getauscht mit ${swap.targetEmployeeName}` },
        }),
      ])
    }

    await notifyEmployee(swap.requesterId, {
      type: 'swap_accepted',
      title: 'Schichttausch bestätigt',
      body: `${swap.targetEmployeeName} hat deinen Schichttausch bestätigt: Du übernimmst ${swap.targetDate}, ${swap.targetEmployeeName} übernimmt ${swap.requesterDate}.`,
      requestId: swap.id,
      url: '/employee/schedule',
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
        (reqEntry && tgtEntry ? 'Der Dienstplan wurde automatisch aktualisiert.' : 'Achtung: Die Einträge konnten nicht automatisch getauscht werden — bitte manuell prüfen.'),
      ).catch(() => {})
    }
  } else {
    await notifyEmployee(swap.requesterId, {
      type: 'swap_declined',
      title: 'Schichttausch abgelehnt',
      body: `${swap.targetEmployeeName} hat deine Tausch-Anfrage für ${swap.requesterDate} abgelehnt.`,
      requestId: swap.id,
      url: '/employee/schedule',
    }).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
