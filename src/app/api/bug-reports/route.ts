import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import {
  bewerten, istHeikel, startStatus, brauchtFreigabe, neueKennung,
} from '@/lib/funde'

export const dynamic = 'force-dynamic'

/**
 * §133 Funde melden und bearbeiten.
 *
 *   POST   einen Fund melden — Käfer-Knopf oder ausführliches Formular
 *   GET    die eigenen Funde; OKUN sieht alle
 *   PATCH  Status, Freigabe, Rückfrage, Antwort
 *
 * §133 Der POST war bisher OHNE Anmeldung erreichbar. Ein offener Weg, der
 * Datensätze anlegt, ist eine Einladung zum Vollmüllen — und die Meldung wäre
 * ohne Absender ohnehin wertlos.
 */

export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const text = (k: string) => {
    const w = body[k]
    return typeof w === 'string' && w.trim() ? w.trim() : null
  }

  const art = text('art') ?? 'fehler'
  const bereich = text('bereich') ?? 'sonstiges'

  const meldung = {
    art, bereich,
    title: text('title'),
    description: text('description'),
    schritte: text('schritte'),
    erwartet: text('erwartet'),
    haeufigkeit: text('haeufigkeit'),
  }
  if (!meldung.title) {
    return NextResponse.json({ error: 'Eine Überschrift ist nötig.' }, { status: 400 })
  }

  // Die Bewertung entsteht auf dem Server, nicht im Browser. Sonst könnte ein
  // unvollständiger Fund sich selbst für vollständig erklären.
  const bewertung = bewerten(meldung)
  const heikel = istHeikel(bereich, body.heikel === true)
  const customerId = await resolveCustomerId(session)

  const eintrag = await prisma.bugReport.create({
    data: {
      ticketId: neueKennung(art),
      status: startStatus(art),
      art, bereich,
      ebene: text('ebene') ?? session.role,
      title: meldung.title,
      description: meldung.description,
      schritte: meldung.schritte,
      erwartet: meldung.erwartet,
      haeufigkeit: meldung.haeufigkeit,
      heikel,
      severity: text('severity') ?? 'normal',
      priority: heikel ? 'high' : (text('priority') ?? 'normal'),
      meldeQualitaet: bewertung.stufe,
      freigabe: brauchtFreigabe(art) ? 'offen' : null,
      version: text('version'),
      // Der Absender kommt aus der Sitzung, nicht aus dem Formular — eine
      // Meldung im Namen eines anderen soll es nicht geben.
      userId: session.userId,
      userName: session.name ?? session.email,
      userRole: session.role,
      customerId,
      customerName: session.customerName ?? null,
      page: text('page'),
      browser: text('browser'),
      os: text('os'),
      screenSize: text('screenSize'),
      consoleErrors: text('consoleErrors'),
      lastActions: text('lastActions'),
    },
  })

  return NextResponse.json({
    ticketId: eintrag.ticketId,
    id: eintrag.id,
    bewertung,
    freigabePflichtig: brauchtFreigabe(art),
  })
}

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const status = req.nextUrl.searchParams.get('status')
  const art = req.nextUrl.searchParams.get('art')

  // §133 Wer nicht OKUN ist, sieht ausschließlich die eigenen Meldungen. Eine
  // Fundliste ist eine Mängelliste des Betriebs — sie geht andere nichts an.
  const nurEigene = session.role !== 'okun'

  const funde = await prisma.bugReport.findMany({
    where: {
      ...(nurEigene ? { userId: session.userId } : {}),
      ...(status && status !== 'all' ? { status } : {}),
      ...(art && art !== 'all' ? { art } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({ reports: funde, nurEigene })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const body = await req.json().catch(() => ({})) as {
    id?: string
    status?: string; priority?: string; adminNotes?: string
    freigabe?: 'freigegeben' | 'abgelehnt'; freigabeNotiz?: string
    rueckfrage?: string; antwort?: string
    vorschlag?: string; erledigtNotiz?: string
  }
  if (!body.id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const fund = await prisma.bugReport.findUnique({ where: { id: body.id } })
  if (!fund) return NextResponse.json({ error: 'Fund nicht gefunden' }, { status: 404 })

  // Der Melder darf genau eines: auf eine Rückfrage antworten. Alles andere —
  // Status, Freigabe, Bewertung — gehört OKUN.
  const istOkun = session.role === 'okun'
  if (!istOkun) {
    if (fund.userId !== session.userId || typeof body.antwort !== 'string') {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }
    const aktualisiert = await prisma.bugReport.update({
      where: { id: body.id },
      data: {
        antwort: body.antwort,
        // Mit der Antwort geht der Fund zurück in die Bearbeitung.
        ...(fund.status === 'rueckfrage' ? { status: 'open' } : {}),
      },
    })
    return NextResponse.json({ report: aktualisiert })
  }

  // §133 Die Freigabe ist eine Entscheidung, keine Statusänderung. Sie wird mit
  // Namen und Zeitpunkt festgehalten — auch die Ablehnung, damit derselbe
  // Vorschlag nicht in drei Wochen erneut auf dem Tisch liegt.
  const freigabeDaten = body.freigabe
    ? {
      freigabe: body.freigabe,
      freigabeVon: session.name ?? session.email,
      freigabeAm: new Date(),
      freigabeNotiz: body.freigabeNotiz ?? null,
      status: body.freigabe === 'freigegeben' ? 'freigegeben' : 'abgelehnt',
    }
    : {}

  const aktualisiert = await prisma.bugReport.update({
    where: { id: body.id },
    data: {
      ...freigabeDaten,
      ...(body.status ? { status: body.status } : {}),
      ...(body.priority ? { priority: body.priority } : {}),
      ...(body.adminNotes !== undefined ? { adminNotes: body.adminNotes } : {}),
      ...(body.vorschlag !== undefined ? { vorschlag: body.vorschlag } : {}),
      ...(body.rueckfrage !== undefined
        ? { rueckfrage: body.rueckfrage, status: 'rueckfrage' } : {}),
      ...(body.erledigtNotiz !== undefined
        ? { erledigtNotiz: body.erledigtNotiz, erledigtAm: new Date(), status: 'resolved' }
        : {}),
    },
  })
  return NextResponse.json({ report: aktualisiert })
}
