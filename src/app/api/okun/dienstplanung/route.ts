import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { verfuegbareRegelpakete, type Regelpaket } from '@/lib/regelpakete'
import { einrichtungAnwenden, berichtText } from '@/lib/paket-einrichtung'

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

  // §202 Was am Standort eingerichtet ist — damit OKUN sieht, ob nach der
  // Zuweisung wirklich geplant werden kann, ohne die Seite des Kunden zu öffnen.
  const ids = standorte.map(s => s.id)
  const [dienste, einheiten] = await Promise.all([
    prisma.shift.groupBy({ by: ['locationId'], where: { locationId: { in: ids } }, _count: true }),
    prisma.planningUnit.groupBy({ by: ['locationId'], where: { locationId: { in: ids } }, _count: true }),
  ])
  const dienstzeitenVon = new Map(dienste.map(d => [d.locationId, d._count]))
  const einheitenVon = new Map(einheiten.map(e => [e.locationId, e._count]))

  const bekannteIds = new Set(pakete.pakete.map(p => p.id))

  return NextResponse.json({
    standorte: standorte.map(s => ({
      ...s,
      kunde: s.customerId ? kundeVon.get(s.customerId) ?? null : null,
      dienstzeiten: dienstzeitenVon.get(s.id) ?? 0,
      einheiten: einheitenVon.get(s.id) ?? 0,
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
    /** §202 Die Einrichtung des zugeordneten Pakets anlegen, soweit sie fehlt. */
    einrichtungAnwenden?: boolean
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
  let paket: Regelpaket | undefined
  if (body.rulePackId) {
    const { pakete, erreichbar } = await verfuegbareRegelpakete()
    paket = pakete.find(p => p.id === body.rulePackId)
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

  /*
   * §202 Mit dem Paket kommt seine Einrichtung: Dienstzeiten, Etagen und
   * Gruppen, Arbeitstage, Basiswerte — soweit sie am Standort fehlen. Erst
   * damit „greift" die Zuweisung: Vorher hatte ein Standort Regeln für Dienste,
   * die es nicht gab, und keinen Plan.
   *
   * `einrichtungAnwenden` ohne neues Paket ist für Standorte, denen ihr Paket
   * schon vor §202 zugeordnet wurde.
   */
  if (!paket && body.einrichtungAnwenden && aktualisiert.rulePackId) {
    paket = (await verfuegbareRegelpakete()).pakete.find(p => p.id === aktualisiert.rulePackId)
  }
  const einrichtung = paket ? await einrichtungAnwenden(aktualisiert.id, paket.einrichtung) : null

  const teile: string[] = []
  if (body.rulePackId !== undefined) {
    teile.push(body.rulePackId
      ? `Regelpaket „${body.rulePackId}" zugeordnet`
      : 'Regelpaket entfernt')
  }
  const eingerichtet = berichtText(einrichtung)
  if (eingerichtet) teile.push(eingerichtet)
  if (paket && !paket.einrichtung) {
    teile.push('Dieses Paket bringt keine Dienstzeiten mit — sie müssen ins Paket, bevor geplant werden kann')
  }
  if (freischalten) teile.push('Dienstplanung freigeschaltet')
  if (sperren) teile.push('Dienstplanung gesperrt')

  return NextResponse.json({
    standort: aktualisiert,
    einrichtung,
    hinweis: teile.length > 0
      ? `${aktualisiert.name}: ${teile.join(', ')}.`
      : 'Nichts geändert.',
  })
}
