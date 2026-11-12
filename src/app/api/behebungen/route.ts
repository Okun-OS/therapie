import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { logAudit } from '@/lib/audit'

/**
 * §142 Die menschliche Seite von Stufe 3.
 *
 * Der Lauf meldet seine Behebungen über den schmalen Schlüsselzugang
 * (`/api/okun/funde/behebung`). Hier entscheidet ein Mensch darüber — mit
 * seiner Anmeldung, nicht mit einem Schlüssel. Die zwei Wege sind bewusst
 * getrennt: Was der Lauf darf, soll niemals davon abhängen, wer gerade
 * angemeldet ist, und was ein Mensch darf, niemals von einem Schlüssel in
 * einer Umgebungsvariablen.
 *
 * Freigeben und Verwerfen kann nur OKUN. Eine Standortleitung entscheidet über
 * Dienstpläne, nicht über den Quelltext des Programms.
 */

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const alle = await prisma.behebung.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json({
    behebungen: alle,
    // Die eine Zahl, die auf die Seite gehört: Wie viele warten auf dich?
    wartend: alle.filter(b => b.status === 'wartet').length,
  })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const { id, status, notiz } = await req.json().catch(() => ({}))

  if (!id || !['freigegeben', 'verworfen'].includes(status)) {
    return NextResponse.json(
      { error: 'id und ein gültiger Status (freigegeben | verworfen) sind erforderlich' },
      { status: 400 },
    )
  }

  const behebung = await prisma.behebung.findUnique({ where: { id } })
  if (!behebung) {
    return NextResponse.json({ error: 'Behebung nicht gefunden' }, { status: 404 })
  }

  // Was schon draußen ist, lässt sich hier nicht mehr freigeben — das wäre
  // eine Zustimmung im Nachhinein und damit keine.
  if (behebung.status === 'ausgerollt') {
    return NextResponse.json(
      {
        error: 'Diese Behebung ist bereits ausgerollt. Zum Zurücknehmen den '
          + 'Commit rückgängig machen — eine nachträgliche Freigabe gibt es nicht.',
      },
      { status: 409 },
    )
  }

  const aktualisiert = await prisma.behebung.update({
    where: { id },
    data: {
      status,
      entschiedenVon: session.name ?? session.email,
      entschiedenAm: new Date(),
      entscheidNotiz: typeof notiz === 'string' ? notiz.trim().slice(0, 1000) : null,
    },
  })

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'update', entityType: 'Behebung', entityId: id,
    details: { status, kennung: behebung.kennung, dateien: behebung.dateien },
  })

  // Ein verworfener Vorschlag bedeutet nicht, dass der Fund erledigt ist —
  // er bedeutet, dass dieser Weg es nicht war. Der Fund bleibt offen.
  return NextResponse.json({ behebung: aktualisiert })
}
