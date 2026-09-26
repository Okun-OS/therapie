import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { allowedLocationScope } from '@/lib/scope'
import { bewerbungsFilter } from '@/lib/bewerber-zugriff'
import { logAudit } from '@/lib/audit'
import {
  BEWERBUNGSSTAENDE, BEENDET, standErlaubt, loeschenAb, pruefeBewerbung,
} from '@/lib/recruiting'

export const dynamic = 'force-dynamic'

/**
 * §148 Bewerbungen — das CRM für Bewerber.
 *
 * WARUM DIE STANDORTLEITUNG HIER MITREDEN DARF
 * Weil sie die Person einstellt und das Gespräch führt. Sie sieht die
 * Bewerbungen auf die Anzeigen ihres Standorts — und die
 * Initiativbewerbungen, die bei ihr eingegangen sind. Fremde Standorte
 * bleiben draußen: Eine Bewerbung ist eine Personalangelegenheit und keine
 * Rundschau.
 *
 * WARUM JEDE ÄNDERUNG EIN EREIGNIS SCHREIBT
 * §15 Abs.4 AGG gibt einem abgelehnten Bewerber zwei Monate, Ansprüche geltend
 * zu machen. Wer dann nicht belegen kann, wann abgesagt wurde und warum, steht
 * schlecht da. Der Verlauf ist zugleich das, was ein Bewerber-CRM überhaupt
 * brauchbar macht: Man sieht, wer wann mit wem gesprochen hat.
 */

const FELDER = {
  id: true, customerId: true, stelleId: true, stelleTitel: true,
  locationId: true, name: true, email: true, telefon: true, nachricht: true,
  quelle: true, status: true, statusAm: true, gespraechAm: true,
  gespraechOrt: true, notiz: true, poolBis: true, employeeId: true,
  uebernommenAm: true, loeschenAb: true, createdAt: true, updatedAt: true,
} as const

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ bewerbungen: [] })

  const stelleId = req.nextUrl.searchParams.get('stelleId')
  const bewerbungen = await prisma.bewerbung.findMany({
    where: {
      ...(await bewerbungsFilter(session, customerId)),
      ...(stelleId ? { stelleId } : {}),
    },
    orderBy: [{ statusAm: 'desc' }],
    select: FELDER,
  })

  // Die Unterlagen gehören zur Bewerbung und werden hier mitgezählt, damit die
  // Liste zeigen kann, wo ein Lebenslauf liegt und wo nicht.
  const dateien = await prisma.storedFile.findMany({
    where: {
      customerId, ownerType: 'bewerbung',
      ownerId: { in: bewerbungen.map(b => b.id) }, deletedAt: null,
    },
    select: { id: true, ownerId: true, dateiname: true, groesse: true, mimeType: true },
  })
  const jeBewerbung = new Map<string, typeof dateien>()
  for (const d of dateien) {
    const liste = jeBewerbung.get(d.ownerId) ?? []
    liste.push(d)
    jeBewerbung.set(d.ownerId, liste)
  }

  return NextResponse.json({
    bewerbungen: bewerbungen.map(b => ({ ...b, dateien: jeBewerbung.get(b.id) ?? [] })),
    staende: BEWERBUNGSSTAENDE,
  })
}

/**
 * Eine Bewerbung von Hand einpflegen.
 *
 * Der wichtigste Fall im Alltag: Jemand ruft an oder kommt vorbei. Ohne diesen
 * Weg landet die Hälfte der Bewerber in einem Notizbuch, und das Programm
 * zeigt ein Bild, das nicht stimmt.
 */
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const geprueft = pruefeBewerbung(body)
  if (!geprueft.ok || !geprueft.werte) {
    return NextResponse.json(
      { error: geprueft.fehler ?? 'Die Angaben sind unvollständig.' }, { status: 400 },
    )
  }

  // Die Stelle muss zum eigenen Betrieb gehören und im eigenen Bereich liegen.
  let stelle = null
  if (body.stelleId) {
    const scope = await allowedLocationScope(session)
    stelle = await prisma.stelle.findFirst({
      where: { id: String(body.stelleId), customerId },
      select: { id: true, titel: true, locationId: true },
    })
    if (!stelle) return NextResponse.json({ error: 'Stelle nicht gefunden' }, { status: 404 })
    if (scope.kind !== 'all' && stelle.locationId
        && !scope.ids.includes(stelle.locationId)) {
      return NextResponse.json({ error: 'Kein Zugriff auf diesen Standort' }, { status: 403 })
    }
  }

  const bewerbung = await prisma.bewerbung.create({
    data: {
      customerId,
      stelleId: stelle?.id ?? null,
      stelleTitel: stelle?.titel ?? null,
      locationId: stelle?.locationId ?? null,
      ...geprueft.werte,
      quelle: ['eingepflegt', 'empfehlung', 'initiativ', 'boerse']
        .includes(String(body.quelle)) ? String(body.quelle) : 'eingepflegt',
      notiz: String(body.notiz ?? '').slice(0, 5000).trim() || null,
    },
    select: FELDER,
  })

  await prisma.bewerbungEreignis.create({
    data: {
      bewerbungId: bewerbung.id, art: 'eingegangen',
      text: `Von Hand eingepflegt${stelle ? ` zur Stelle „${stelle.titel}“` : ''}.`,
      vonName: session.name ?? session.email,
    },
  })
  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'create', entityType: 'Bewerbung', entityId: bewerbung.id,
    customerId, details: { quelle: bewerbung.quelle },
  })

  return NextResponse.json({ bewerbung })
}

/**
 * Den Stand bewegen, eine Notiz schreiben, ein Gespräch eintragen.
 *
 * Bei jedem Wechsel in einen Endstand (Absage oder Einstellung) wird die
 * Löschfrist gesetzt — das ist der einzige Ort, an dem sie entsteht. Ohne ihn
 * bliebe jede Bewerbung für immer liegen, und genau das ist der Fehler, den
 * Aufsichtsbehörden bei Bewerberdaten am häufigsten finden.
 */
export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const vorhanden = await prisma.bewerbung.findFirst({
    where: { id, ...(await bewerbungsFilter(session, customerId)) },
  })
  if (!vorhanden) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const daten: Record<string, unknown> = {}
  const ereignisse: { art: string; text: string }[] = []

  if (body.status !== undefined && body.status !== vorhanden.status) {
    const neu = String(body.status)
    if (!standErlaubt(vorhanden.status, neu)) {
      return NextResponse.json(
        {
          error: vorhanden.status === 'eingestellt'
            ? 'Diese Person ist eingestellt — daran wird nichts mehr geändert.'
            : neu === 'eingestellt'
              ? 'Eine Einstellung entsteht über die Übernahme, nicht über den Stand.'
              : `Der Wechsel von „${vorhanden.status}“ nach „${neu}“ ist nicht vorgesehen.`,
        },
        { status: 400 },
      )
    }
    daten.status = neu
    daten.statusAm = new Date()
    // Endstand erreicht: Die Uhr für das Löschen beginnt zu laufen. Kommt die
    // Bewerbung zurück ins Verfahren, wird die Frist wieder entfernt.
    daten.loeschenAb = BEENDET.includes(neu) ? loeschenAb(new Date()) : null
    ereignisse.push({
      art: 'stand',
      text: `Stand: ${BEWERBUNGSSTAENDE[neu as keyof typeof BEWERBUNGSSTAENDE]}`
        + (body.grund ? ` — ${String(body.grund).slice(0, 500)}` : ''),
    })
  }

  if (body.notiz !== undefined) {
    daten.notiz = String(body.notiz ?? '').slice(0, 5000).trim() || null
  }
  if (body.gespraechAm !== undefined) {
    daten.gespraechAm = body.gespraechAm ? new Date(String(body.gespraechAm)) : null
    daten.gespraechOrt = String(body.gespraechOrt ?? '').slice(0, 300).trim() || null
    if (daten.gespraechAm) {
      ereignisse.push({
        art: 'einladung',
        text: `Gespräch am ${new Date(String(body.gespraechAm)).toLocaleString('de-DE')}`
          + (daten.gespraechOrt ? `, ${daten.gespraechOrt}` : ''),
      })
    }
  }
  if (body.poolBis !== undefined) {
    // Die Einwilligung in den Bewerberpool. Sie muss vom Bewerber kommen —
    // das Programm kann sie nur festhalten, nicht erteilen.
    daten.poolBis = body.poolBis ? new Date(String(body.poolBis)) : null
    ereignisse.push({
      art: 'notiz',
      text: body.poolBis
        ? `Einwilligung in den Bewerberpool bis ${String(body.poolBis).slice(0, 10)}`
        : 'Einwilligung in den Bewerberpool zurückgenommen',
    })
  }

  if (Object.keys(daten).length === 0) {
    return NextResponse.json({ bewerbung: vorhanden })
  }

  const bewerbung = await prisma.bewerbung.update({
    where: { id }, data: daten, select: FELDER,
  })

  for (const e of ereignisse) {
    await prisma.bewerbungEreignis.create({
      data: { bewerbungId: id, ...e, vonName: session.name ?? session.email },
    })
  }
  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'update', entityType: 'Bewerbung', entityId: id,
    customerId, details: { status: daten.status ?? vorhanden.status },
  })

  return NextResponse.json({ bewerbung })
}
