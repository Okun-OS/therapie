import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { verfuegbareRegelpakete } from '@/lib/regelpakete'

export const dynamic = 'force-dynamic'

/**
 * §126/§127 Dienstplanung je Standort einrichten und freischalten.
 *
 * Das Geschäftsmodell aus `PRODUKT-NOTIZEN.md`: Alles außer der Dienstplanung
 * ist Standard und läuft sofort. Die Dienstplanung wird für jeden Kunden von
 * Hand programmiert — als versioniertes Regelpaket im Rechendienst.
 *
 * Bis das Paket steht, bleibt die Dienstplanung gesperrt. Ein Kunde, der
 * ungebaute Dienstplanung ausprobiert, bekommt einen schlechten Plan und ein
 * falsches Bild vom Produkt — genau das ist im August passiert.
 *
 * Deshalb liegt beides HIER und nicht beim Kunden: Nur OKUN ordnet ein Paket
 * zu und schaltet frei. Der Kunde kann das weder sehen noch ändern.
 *
 * GET   → alle Standorte mit Stand, dazu die verfügbaren Pakete
 * PATCH → Paket zuordnen und/oder freischalten
 */

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const [standorte, pakete] = await Promise.all([
    prisma.location.findMany({
      where: { active: true },
      select: {
        id: true, name: true, customerId: true,
        rulePackId: true, dienstplanungFrei: true,
        dienstplanungFreiSeit: true, dienstplanungFreiVon: true,
        dienstplanungHinweis: true,
      },
      orderBy: { name: 'asc' },
    }),
    verfuegbareRegelpakete(),
  ])

  const kunden = await prisma.customer.findMany({ select: { id: true, name: true } })
  const kundeVon = new Map(kunden.map(k => [k.id, k.name]))

  const bekannteIds = new Set(pakete.pakete.map(p => p.id))

  return NextResponse.json({
    standorte: standorte.map(s => ({
      ...s,
      kunde: s.customerId ? kundeVon.get(s.customerId) ?? null : null,
      // Ein zugeordnetes Paket kann nach einem Deploy verschwunden sein.
      // Das muss auffallen, bevor der Kunde einen Plan ohne seine Regeln bekommt.
      paketFehlt: !!s.rulePackId && pakete.erreichbar && !bekannteIds.has(s.rulePackId),
    })),
    pakete: pakete.pakete,
    rechendienstErreichbar: pakete.erreichbar,
    hinweis: pakete.erreichbar
      ? `${pakete.pakete.length} Regelpakete im Rechendienst.`
      : 'Der Rechendienst ist nicht erreichbar — die Paketliste kann nicht geprüft werden.',
  })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json().catch(() => ({})) as {
    locationId?: string
    rulePackId?: string | null
    dienstplanungFrei?: boolean
    hinweis?: string | null
  }
  if (!body.locationId) {
    return NextResponse.json({ error: 'locationId fehlt' }, { status: 400 })
  }

  const standort = await prisma.location.findUnique({
    where: { id: body.locationId },
    select: { id: true, name: true, rulePackId: true, dienstplanungFrei: true },
  })
  if (!standort) {
    return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
  }

  // Ein Paket, das es nicht gibt, wird nicht zugeordnet. Sonst merkt es
  // niemand, bis der erste Plan ohne die Regeln des Kunden herauskommt.
  if (body.rulePackId) {
    const { pakete, erreichbar } = await verfuegbareRegelpakete()
    if (erreichbar && !pakete.some(p => p.id === body.rulePackId)) {
      return NextResponse.json({
        error: `Das Regelpaket „${body.rulePackId}" gibt es im Rechendienst nicht. `
          + `Vorhanden: ${pakete.map(p => p.id).join(', ') || '—'}.`,
      }, { status: 400 })
    }
    if (!erreichbar) {
      return NextResponse.json({
        error: 'Der Rechendienst ist nicht erreichbar — solange lässt sich nicht prüfen, '
          + 'ob es das Paket gibt. Bitte später erneut versuchen.',
      }, { status: 503 })
    }
  }

  // Freischalten ohne Paket ist möglich, aber es soll bewusst geschehen:
  // ein Standort ohne Paket plant nach den Standardregeln.
  const freischalten = body.dienstplanungFrei === true
  const sperren = body.dienstplanungFrei === false

  const aktualisiert = await prisma.location.update({
    where: { id: body.locationId },
    data: {
      ...(body.rulePackId !== undefined ? { rulePackId: body.rulePackId || null } : {}),
      ...(freischalten ? {
        dienstplanungFrei: true,
        dienstplanungFreiSeit: new Date().toISOString().slice(0, 10),
        dienstplanungFreiVon: session.name ?? session.userId,
      } : {}),
      ...(sperren ? { dienstplanungFrei: false } : {}),
      ...(body.hinweis !== undefined ? { dienstplanungHinweis: body.hinweis || null } : {}),
    },
    select: {
      id: true, name: true, rulePackId: true, dienstplanungFrei: true,
      dienstplanungFreiSeit: true, dienstplanungFreiVon: true, dienstplanungHinweis: true,
    },
  })

  const teile: string[] = []
  if (body.rulePackId !== undefined) {
    teile.push(body.rulePackId
      ? `Regelpaket „${body.rulePackId}" zugeordnet`
      : 'Regelpaket entfernt')
  }
  if (freischalten) teile.push('Dienstplanung freigeschaltet')
  if (sperren) teile.push('Dienstplanung gesperrt')

  return NextResponse.json({
    standort: aktualisiert,
    hinweis: teile.length > 0
      ? `${aktualisiert.name}: ${teile.join(', ')}.`
      : 'Nichts geändert.',
  })
}
