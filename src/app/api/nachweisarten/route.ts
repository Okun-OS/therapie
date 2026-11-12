import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { darfSehen, type Nachweisart } from '@/lib/fristen'
import { VORLAGEN, vorlage } from '@/lib/nachweis-vorlagen'

export const dynamic = 'force-dynamic'

/**
 * §146 Der Katalog der Nachweise und Fristen — er gehört dem Kunden.
 *
 * WER IHN ÄNDERN DARF
 * Nur die Unternehmensebene. Eine Standortleitung entscheidet über Dienstpläne,
 * nicht darüber, welche Pflichtnachweise der Betrieb führt — das ist eine
 * Entscheidung über Recht und Haftung, und sie gilt für alle Standorte.
 *
 * WER IHN SEHEN DARF
 * Die Standortleitung sieht die Arten, die für sie freigegeben sind. Sie
 * braucht sie: Ohne zu wissen, dass es „Belehrung §43 IfSG" gibt, kann sie mit
 * der Warnung nichts anfangen. Was auf „nur Unternehmen" steht, bekommt sie gar
 * nicht erst zu sehen — ausgeblendet, nicht ausgegraut.
 */

const GATTUNGEN = ['nachweis', 'vertrag']
const GILT_FUER = ['alle', 'positionen', 'qualifikationen', 'einzeln']
const FAELLIGKEITEN = ['einmalig', 'einstellung', 'wiederkehrend', 'einstellung_und_wiederkehrend']
const SICHTBARKEITEN = ['leitung', 'unternehmen']
const FOLGEN = ['warnen', 'sperren']

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ arten: [], vorlagen: VORLAGEN })

  const alle = await prisma.nachweisart.findMany({
    where: { customerId },
    orderBy: [{ gattung: 'asc' }, { reihenfolge: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json({
    arten: alle.filter(a => darfSehen(a as unknown as Nachweisart, session.role)),
    // Die Vorlagen kommen mit, damit ein leerer Katalog nicht leer bleibt.
    vorlagen: session.role === 'admin' ? [] : VORLAGEN,
    darfAendern: session.role !== 'admin',
  })
}

function pruefe(b: Record<string, unknown>): string | null {
  if (typeof b.name !== 'string' || b.name.trim().length < 2) {
    return 'Ein Name ist nötig.'
  }
  if (b.gattung !== undefined && !GATTUNGEN.includes(b.gattung as string)) {
    return 'Unbekannte Gattung.'
  }
  if (b.giltFuer !== undefined && !GILT_FUER.includes(b.giltFuer as string)) {
    return 'Unbekannte Angabe bei „gilt für".'
  }
  if (b.faelligkeit !== undefined && !FAELLIGKEITEN.includes(b.faelligkeit as string)) {
    return 'Unbekannte Fälligkeit.'
  }
  if (b.sichtbarkeit !== undefined && !SICHTBARKEITEN.includes(b.sichtbarkeit as string)) {
    return 'Unbekannte Sichtbarkeit.'
  }
  if (b.folge !== undefined && !FOLGEN.includes(b.folge as string)) {
    return 'Unbekannte Folge.'
  }
  // Wiederkehrend ohne Abstand wäre eine Frist, die nie wieder fällig wird —
  // sie stünde für immer auf grün und niemand merkte es.
  const wiederkehrend = b.faelligkeit === 'wiederkehrend'
    || b.faelligkeit === 'einstellung_und_wiederkehrend'
  if (wiederkehrend && !(Number(b.abstandMonate) > 0)) {
    return 'Eine wiederkehrende Frist braucht einen Abstand in Monaten — sonst '
      + 'wird sie nie wieder fällig und steht für immer auf grün.'
  }
  const beschraenkt = b.giltFuer === 'positionen' || b.giltFuer === 'qualifikationen'
  if (beschraenkt && !(Array.isArray(b.giltFuerWerte) && b.giltFuerWerte.length > 0)) {
    return 'Wenn es nur für bestimmte Positionen oder Qualifikationen gilt, '
      + 'muss mindestens eine angegeben sein.'
  }
  return null
}

function daten(b: Record<string, unknown>) {
  return {
    name: String(b.name).trim(),
    gattung: (b.gattung as string) ?? 'nachweis',
    giltFuer: (b.giltFuer as string) ?? 'alle',
    giltFuerWerte: Array.isArray(b.giltFuerWerte)
      ? (b.giltFuerWerte as string[]).filter(w => typeof w === 'string' && w.trim())
      : [],
    faelligkeit: (b.faelligkeit as string) ?? 'wiederkehrend',
    abstandMonate: b.abstandMonate != null ? Number(b.abstandMonate) : null,
    vorwarnTage: Number(b.vorwarnTage ?? 56),
    nachweisNoetig: b.nachweisNoetig !== false,
    sichtbarkeit: (b.sichtbarkeit as string) ?? 'leitung',
    folge: (b.folge as string) ?? 'warnen',
    grundlage: typeof b.grundlage === 'string' ? b.grundlage.trim() || null : null,
    aktiv: b.aktiv !== false,
    reihenfolge: Number(b.reihenfolge ?? 0),
  }
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  // Eine ganze Vorlage übernehmen — der übliche erste Handgriff.
  if (typeof body.vorlage === 'string') {
    const v = vorlage(body.vorlage)
    if (!v) return NextResponse.json({ error: 'Unbekannte Vorlage' }, { status: 400 })

    const vorhanden = await prisma.nachweisart.findMany({
      where: { customerId }, select: { name: true },
    })
    const schonDa = new Set(vorhanden.map(a => a.name.toLowerCase()))

    // Was schon da ist, wird NICHT überschrieben. Wer seinen Abstand von zwei
    // auf drei Jahre gesetzt hat, soll ihn nicht durch einen zweiten Klick auf
    // die Vorlage wieder verlieren.
    const neu = v.eintraege.filter(e => !schonDa.has(e.name.toLowerCase()))
    if (neu.length > 0) {
      await prisma.nachweisart.createMany({
        data: neu.map((e, i) => ({ ...e, customerId, reihenfolge: i })),
      })
    }

    await logAudit({
      userId: session.userId, userEmail: session.email, userRole: session.role,
      action: 'create', entityType: 'Nachweisart', entityId: v.schluessel,
      customerId, details: { vorlage: v.schluessel, angelegt: neu.length },
    })

    return NextResponse.json({
      angelegt: neu.length,
      uebersprungen: v.eintraege.length - neu.length,
    })
  }

  const fehler = pruefe(body)
  if (fehler) return NextResponse.json({ error: fehler }, { status: 400 })

  const art = await prisma.nachweisart.create({
    data: { ...daten(body), customerId },
  })
  return NextResponse.json({ art })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  if (typeof body.id !== 'string') {
    return NextResponse.json({ error: 'id fehlt' }, { status: 400 })
  }

  const vorhanden = await prisma.nachweisart.findUnique({ where: { id: body.id } })
  if (!vorhanden || (customerId && vorhanden.customerId !== customerId)) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  const fehler = pruefe({ ...vorhanden, ...body })
  if (fehler) return NextResponse.json({ error: fehler }, { status: 400 })

  const art = await prisma.nachweisart.update({
    where: { id: body.id },
    data: daten({ ...vorhanden, ...body }),
  })
  return NextResponse.json({ art })
}

/**
 * Eine Art abschalten — nicht löschen.
 *
 * An einer Art hängen die Fristen der Menschen, und darin stecken Dokumente
 * und Daten. Sie wegzuwerfen, weil jemand den Katalog aufräumt, wäre ein
 * stiller Datenverlust. Abgeschaltete Arten erzeugen nichts Neues mehr und
 * verschwinden aus den Listen.
 */
export async function DELETE(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const vorhanden = await prisma.nachweisart.findUnique({ where: { id } })
  if (!vorhanden || (customerId && vorhanden.customerId !== customerId)) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  const offen = await prisma.frist.count({ where: { nachweisartId: id } })
  await prisma.nachweisart.update({ where: { id }, data: { aktiv: false } })

  return NextResponse.json({
    abgeschaltet: true,
    hinweis: offen > 0
      ? `${offen} vorhandene Einträge bleiben erhalten — sie enthalten `
        + 'Nachweise und Daten. Neue entstehen keine mehr.'
      : 'Abgeschaltet.',
  })
}
