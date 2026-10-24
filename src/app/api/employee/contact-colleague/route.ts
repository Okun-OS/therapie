import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { notifyEmployee } from '@/lib/notify'

// §73: in-app message to a colleague (e.g. to discuss a wish conflict).
// Delivered via the notification rails (in-app + push + e-mail).
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['employee', 'admin'])
  if (session instanceof NextResponse) return session

  const { toEmployeeId, message } = await req.json() as { toEmployeeId?: string; message?: string }
  if (!toEmployeeId || !message?.trim()) {
    return NextResponse.json({ error: 'toEmployeeId und message erforderlich' }, { status: 400 })
  }
  if (message.length > 1000) {
    return NextResponse.json({ error: 'Nachricht zu lang (max. 1000 Zeichen)' }, { status: 400 })
  }

  const senderId = session.employeeId
  const sender = senderId ? await prisma.employee.findUnique({ where: { id: senderId } }) : null
  const recipient = await prisma.employee.findUnique({ where: { id: toEmployeeId } })
  if (!recipient) return NextResponse.json({ error: 'Empfänger nicht gefunden' }, { status: 404 })

  // Employees may only message colleagues at their own location
  if (session.role === 'employee') {
    if (!sender) return NextResponse.json({ error: 'Absender nicht gefunden' }, { status: 404 })
    if (sender.locationId !== recipient.locationId) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    }
  }

  const senderName = sender?.name ?? session.name ?? 'Ein Kollege'
  await notifyEmployee(toEmployeeId, {
    type: 'colleague_message',
    title: `Nachricht von ${senderName}`,
    body: message.trim(),
    url: '/employee/schedule',
  })

  return NextResponse.json({ ok: true })
}
