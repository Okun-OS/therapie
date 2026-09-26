import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'

/**
 * §139 Ein Telefon für native Benachrichtigungen hinterlegen.
 *
 * DIE PERSON KOMMT AUS DER SITZUNG, NICHT AUS DER ANFRAGE.
 * Beim Web-Push (§111) war das einmal anders, und man konnte das EIGENE Gerät
 * als Empfänger für die Meldungen einer anderen Person eintragen — ab dann las
 * man deren Dienstpläne und Ausfälle mit. Hier gibt es diese Möglichkeit gar
 * nicht erst: Wer angemeldet ist, meldet sein eigenes Gerät an, sonst niemand.
 *
 * DIE KENNUNG IST EINDEUTIG, NICHT DIE PERSON.
 * Ein Diensttelefon wechselt den Besitzer. Meldet sich dort jemand Neues an,
 * übernimmt er den Eintrag. Bliebe der alte stehen, bekäme der Vorgänger
 * weiterhin die Dienstpläne seines Nachfolgers aufs Telefon.
 */

const PLATTFORMEN = ['ios', 'android']

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  if (!session.employeeId) {
    return NextResponse.json(
      { error: 'Dieser Zugang ist keinem Mitarbeiter zugeordnet.' }, { status: 403 })
  }

  const { kennung, plattform } = await req.json().catch(() => ({}))

  if (typeof kennung !== 'string' || kennung.length < 16 || kennung.length > 512) {
    return NextResponse.json({ error: 'Gerätekennung fehlt oder ist unbrauchbar' },
      { status: 400 })
  }
  if (!PLATTFORMEN.includes(plattform)) {
    return NextResponse.json({ error: 'Unbekannte Plattform' }, { status: 400 })
  }

  await prisma.geraet.upsert({
    where: { kennung },
    update: { employeeId: session.employeeId, plattform },
    create: { kennung, plattform, employeeId: session.employeeId },
  })

  return NextResponse.json({ ok: true })
}

/**
 * Das Gerät wieder abmelden — beim Abmelden aus der App.
 *
 * Ohne das bekäme das Telefon weiterhin Benachrichtigungen für jemanden, der
 * sich abgemeldet hat. Auf einem geteilten Diensttelefon wäre das ein
 * Datenleck im Sperrbildschirm.
 */
export async function DELETE(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const { kennung } = await req.json().catch(() => ({}))
  if (typeof kennung !== 'string' || !kennung) {
    return NextResponse.json({ error: 'Gerätekennung fehlt' }, { status: 400 })
  }

  // Nur das eigene Gerät. Sonst könnte jeder mit einer fremden Kennung dafür
  // sorgen, dass ein anderer keine Ausfallmeldungen mehr bekommt.
  const geraet = await prisma.geraet.findUnique({ where: { kennung } })
  if (!geraet || geraet.employeeId !== session.employeeId) {
    // Kein Unterschied zwischen „gibt es nicht" und „gehört dir nicht" —
    // sonst lässt sich damit herausfinden, welche Kennungen hinterlegt sind.
    return NextResponse.json({ ok: true })
  }

  await prisma.geraet.delete({ where: { kennung } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
