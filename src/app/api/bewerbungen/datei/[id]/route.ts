import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { bewerbungsFilter } from '@/lib/bewerber-zugriff'
import { dateiInhalt } from '@/lib/file-storage'

export const dynamic = 'force-dynamic'

/**
 * §148 Eine Bewerbungsunterlage herunterladen.
 *
 * WARUM DAS NICHT ÜBER /api/files LÄUFT
 * Weil dort die Zugriffsprüfung auf Mitarbeiter und Standorte gebaut ist —
 * eine Datei, die einer Bewerbung gehört, fiele dort in den Standortzweig und
 * würde abgelehnt. Das ist das richtige Verhalten, aber kein Weg zur Datei.
 *
 * Geprüft wird deshalb hier, und zwar über die Bewerbung: Wer die Bewerbung
 * sehen darf, darf auch ihre Unterlagen sehen. Ein Lebenslauf enthält
 * Geburtsdatum, Anschrift und manchmal ein Foto — er hat in keiner fremden
 * Hand etwas zu suchen.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const datei = await prisma.storedFile.findFirst({
    where: {
      id: params.id, customerId, ownerType: 'bewerbung', deletedAt: null,
    },
    select: { id: true, ownerId: true, dateiname: true, mimeType: true },
  })
  if (!datei) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const bewerbung = await prisma.bewerbung.findFirst({
    where: { id: datei.ownerId, ...(await bewerbungsFilter(session, customerId)) },
    select: { id: true },
  })
  if (!bewerbung) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const inhalt = await dateiInhalt(params.id)
  if (!inhalt) return NextResponse.json({ error: 'Inhalt nicht verfügbar' }, { status: 404 })

  const anzeigbar = inhalt.mimeType === 'application/pdf'
    || inhalt.mimeType.startsWith('image/')
  return new NextResponse(new Uint8Array(inhalt.inhalt), {
    headers: {
      'Content-Type': inhalt.mimeType,
      'Content-Length': String(inhalt.inhalt.length),
      'Content-Disposition':
        `${anzeigbar ? 'inline' : 'attachment'}; filename="${inhalt.dateiname}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
