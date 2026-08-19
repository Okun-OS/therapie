import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { assertEmployeeAccess, allowedLocationScope } from '@/lib/scope'
import { prisma } from '@/lib/prisma'
import { dateiInhalt, dateiLoeschen, mitarbeiterDarfSehen, DATEI_FELDER } from '@/lib/file-storage'
import type { SessionPayload } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * §100 Gemeinsame Zugriffsprüfung für eine einzelne Datei.
 * Steht bewusst an einer Stelle: Ein Krankenschein, der über einen vergessenen
 * Pfad einsehbar ist, ist ein Datenschutzvorfall, kein Schönheitsfehler.
 */
async function pruefeZugriff(session: SessionPayload, id: string) {
  const datei = await prisma.storedFile.findFirst({
    where: { id, deletedAt: null },
    select: { ...DATEI_FELDER, hochgeladenVon: true },
  })
  if (!datei) {
    return { fehler: NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 }) }
  }

  if (datei.ownerType === 'employee') {
    const verweigert = await assertEmployeeAccess(session, datei.ownerId)
    if (verweigert) return { fehler: verweigert }
  } else {
    const scope = await allowedLocationScope(session)
    if (scope.kind !== 'all' && !scope.ids.includes(datei.ownerId)) {
      return { fehler: NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 }) }
    }
  }

  // Der Mitarbeiter darf auch in der eigenen Akte nicht alles sehen —
  // interne Vermerke der Leitung gehören ihm nicht.
  if (session.role === 'employee'
      && !mitarbeiterDarfSehen(datei, session.employeeId ?? '', session.userId)) {
    return { fehler: NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 }) }
  }

  return { datei }
}

// GET /api/files/[id] — Datei herunterladen
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['employee', 'admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const { fehler } = await pruefeZugriff(session, params.id)
  if (fehler) return fehler

  const inhalt = await dateiInhalt(params.id)
  if (!inhalt) return NextResponse.json({ error: 'Inhalt nicht verfügbar' }, { status: 404 })

  // inline für PDFs und Bilder (Vorschau), sonst Download erzwingen
  const anzeigbar = inhalt.mimeType === 'application/pdf' || inhalt.mimeType.startsWith('image/')
  return new NextResponse(new Uint8Array(inhalt.inhalt), {
    headers: {
      'Content-Type': inhalt.mimeType,
      'Content-Length': String(inhalt.inhalt.length),
      'Content-Disposition': `${anzeigbar ? 'inline' : 'attachment'}; filename="${inhalt.dateiname}"`,
      // Personalunterlagen gehören nicht in Zwischenspeicher
      'Cache-Control': 'private, no-store',
    },
  })
}

// PATCH /api/files/[id] — Freigabe, Notiz und Gültigkeit ändern
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const { fehler } = await pruefeZugriff(session, params.id)
  if (fehler) return fehler

  const body = await req.json().catch(() => ({})) as {
    sichtbarFuerMitarbeiter?: boolean
    notiz?: string | null
    kategorie?: string
    gueltigVon?: string | null
    gueltigBis?: string | null
  }

  const aktualisiert = await prisma.storedFile.update({
    where: { id: params.id },
    data: {
      ...(body.sichtbarFuerMitarbeiter !== undefined && { sichtbarFuerMitarbeiter: body.sichtbarFuerMitarbeiter }),
      ...(body.notiz !== undefined && { notiz: body.notiz }),
      ...(body.kategorie !== undefined && { kategorie: body.kategorie }),
      ...(body.gueltigVon !== undefined && { gueltigVon: body.gueltigVon }),
      ...(body.gueltigBis !== undefined && { gueltigBis: body.gueltigBis }),
    },
    select: DATEI_FELDER,
  })
  return NextResponse.json({ datei: aktualisiert })
}

// DELETE /api/files/[id] — weich löschen (Aufbewahrungsfristen)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const { fehler } = await pruefeZugriff(session, params.id)
  if (fehler) return fehler

  await dateiLoeschen(params.id)
  return NextResponse.json({ ok: true })
}
