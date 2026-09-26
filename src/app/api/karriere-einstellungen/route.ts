import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { slugMachen, fehltZurKarriereseite } from '@/lib/recruiting'

export const dynamic = 'force-dynamic'

/**
 * §148 Die Einstellungen der Karriereseite.
 *
 * WARUM EINE EIGENE SCHNITTSTELLE UND NICHT /api/org-settings
 * Weil das Einschalten dieser Seite eine Veröffentlichung ist. Es braucht
 * eine eigene Prüfung (Impressum vorhanden? Adresse frei?) und eine eigene
 * Spur im Protokoll. Als sieben weitere Felder in einem allgemeinen
 * Speichern-Knopf ginge beides unter.
 *
 * WER DAS DARF
 * Nur die Unternehmensebene. Eine Standortleitung schreibt Stellen aus — die
 * öffentliche Seite des Trägers samt Impressum ist eine Stufe darüber.
 */

const FELDER = {
  customerId: true, organizationName: true,
  karriereSlug: true, karriereAktiv: true, karriereUeberschrift: true,
  karriereText: true, karriereEmail: true, karriereImpressum: true,
  karriereDatenschutz: true,
} as const

export async function GET(req: NextRequest) {
  // Die Standortleitung darf mitlesen — sie braucht die Adresse der Seite,
  // um sie weiterzugeben, und den Hinweis, warum sie noch nicht online ist.
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ einstellungen: null })

  const e = await prisma.orgSettings.findUnique({
    where: { customerId }, select: FELDER,
  })
  if (!e) return NextResponse.json({ einstellungen: null })

  return NextResponse.json({
    einstellungen: e,
    vorschlag: slugMachen(e.organizationName),
    fehlt: fehltZurKarriereseite(e),
    darfAendern: session.role !== 'admin',
  })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const vorher = await prisma.orgSettings.findUnique({
    where: { customerId }, select: FELDER,
  })
  if (!vorher) {
    return NextResponse.json(
      { error: 'Für dieses Unternehmen gibt es noch keine Einstellungen.' },
      { status: 404 },
    )
  }

  const daten: Record<string, unknown> = {}

  if (body.karriereSlug !== undefined) {
    const gewuenscht = slugMachen(String(body.karriereSlug ?? ''))
    if (!gewuenscht || gewuenscht === 'stelle') {
      return NextResponse.json(
        { error: 'Diese Adresse ergibt keinen brauchbaren Link.' }, { status: 400 },
      )
    }
    const belegt = await prisma.orgSettings.findUnique({
      where: { karriereSlug: gewuenscht }, select: { customerId: true },
    })
    if (belegt && belegt.customerId !== customerId) {
      return NextResponse.json(
        {
          error: `Die Adresse „${gewuenscht}“ ist bereits vergeben. `
            + 'Bitte wähl eine andere — zum Beispiel mit dem Ortsnamen dahinter.',
        },
        { status: 409 },
      )
    }
    daten.karriereSlug = gewuenscht
  }

  for (const [feld, max] of [
    ['karriereUeberschrift', 200], ['karriereText', 5000],
    ['karriereEmail', 200], ['karriereImpressum', 5000],
    ['karriereDatenschutz', 10_000],
  ] as const) {
    if (body[feld] !== undefined) {
      daten[feld] = String(body[feld] ?? '').slice(0, max).trim() || null
    }
  }

  if (body.karriereAktiv !== undefined) {
    const an = body.karriereAktiv === true
    if (an) {
      // Gegen den Stand NACH der Änderung prüfen: Wer Impressum und Adresse
      // im selben Zug einträgt und einschaltet, soll nicht scheitern.
      const kuenftig = { ...vorher, ...daten }
      const fehlt = fehltZurKarriereseite(kuenftig as never)
      if (fehlt.length > 0) {
        return NextResponse.json(
          { error: 'Die Seite kann so noch nicht online gehen.', fehlt },
          { status: 400 },
        )
      }
    }
    daten.karriereAktiv = an
  }

  if (Object.keys(daten).length === 0) {
    return NextResponse.json({ einstellungen: vorher })
  }

  const einstellungen = await prisma.orgSettings.update({
    where: { customerId }, data: daten, select: FELDER,
  })

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'update', entityType: 'Karriereseite', entityId: customerId,
    customerId,
    details: {
      aktiv: einstellungen.karriereAktiv, adresse: einstellungen.karriereSlug,
    },
  })

  return NextResponse.json({
    einstellungen, fehlt: fehltZurKarriereseite(einstellungen),
  })
}
