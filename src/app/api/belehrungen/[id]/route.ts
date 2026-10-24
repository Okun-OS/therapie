import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { allowedLocationScope } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import { notifyEmployee } from '@/lib/notify'
import { getAppOrigin } from '@/lib/app-url'
import {
  fehltZumVerteilen, darfAendern, warumNichtAendern, darfBestaetigen,
  guete, stand, geraetKurz, rundenTitel, naechsteRunde, WIEDERHOLUNGEN,
} from '@/lib/belehrung'

export const dynamic = 'force-dynamic'

/**
 * §150 Die einzelne Runde: verteilen, bestätigen, erinnern, wiederholen.
 *
 * WARUM DAS VERTEILEN DIE BELEGE SCHON ANLEGT
 * Weil die Frage, die ein Betrieb wirklich hat, „wer fehlt noch?" lautet — und
 * die lässt sich nur beantworten, wenn von Anfang an feststeht, wer gemeint
 * war. Entstünde der Eintrag erst beim Klick, wäre jemand, der nie klickt,
 * unsichtbar. Genau der ist aber der Grund für das Ganze.
 *
 * WARUM SPÄTER EINGESTELLTE NICHT NACHGETRAGEN WERDEN
 * Eine Runde ist eine Momentaufnahme der Belegschaft. Wer im Mai anfängt, hat
 * die Aprilbelehrung nicht bekommen und kann sie nicht bestätigt haben — ein
 * nachträglich erzeugter Eintrag würde das verwischen. Für ihn wird eine neue
 * Runde verteilt.
 */

const FELDER = {
  id: true, customerId: true, titel: true, beschreibung: true,
  dateiId: true, dateiname: true, pruefsumme: true, bestaetigungstext: true,
  status: true, fristBis: true, wiederholung: true, vorlageVon: true,
  oeffnenNoetig: true, verteiltAm: true, geschlossenAm: true,
  erstelltVonName: true, createdAt: true,
} as const

async function holen(req: NextRequest, id: string) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return { antwort: session }

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return {
      antwort: NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 }),
    }
  }
  const b = await prisma.belehrung.findFirst({
    where: { id, customerId }, select: FELDER,
  })
  if (!b) {
    return { antwort: NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 }) }
  }
  // Ein Mitarbeiter kommt nur an eine Runde heran, die an ihn verteilt wurde.
  if (session.role === 'employee') {
    if (b.status === 'entwurf') {
      return { antwort: NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 }) }
    }
    const beleg = await prisma.belehrungBestaetigung.findFirst({
      where: { belehrungId: id, employeeId: session.employeeId ?? '' },
      select: { id: true },
    })
    if (!beleg) {
      return { antwort: NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 }) }
    }
  }
  return { session, customerId, b }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { antwort, session, b } = await holen(req, params.id)
  if (antwort) return antwort

  if (session!.role === 'employee') {
    const beleg = await prisma.belehrungBestaetigung.findFirst({
      where: { belehrungId: params.id, employeeId: session!.employeeId ?? '' },
    })
    return NextResponse.json({
      belehrung: {
        id: b!.id, titel: b!.titel, beschreibung: b!.beschreibung,
        dateiname: b!.dateiname, bestaetigungstext: b!.bestaetigungstext,
        status: b!.status, fristBis: b!.fristBis, oeffnenNoetig: b!.oeffnenNoetig,
      },
      beleg: beleg && {
        angesehenAm: beleg.angesehenAm, bestaetigtAm: beleg.bestaetigtAm,
        wortlaut: beleg.wortlaut, geraet: beleg.geraet,
      },
      darf: darfBestaetigen(b!, beleg ?? {}),
    })
  }

  // Für den Betrieb: die Namensliste — wer hat, wer nicht.
  const scope = await allowedLocationScope(session!)
  const belege = await prisma.belehrungBestaetigung.findMany({
    where: {
      belehrungId: params.id,
      ...(scope.kind === 'all' ? {} : { locationId: { in: scope.ids } }),
    },
    orderBy: [{ bestaetigtAm: 'asc' }, { personName: 'asc' }],
  })

  return NextResponse.json({
    belehrung: b,
    fehlt: fehltZumVerteilen(b!),
    stand: stand(belege),
    belege: belege.map(x => ({
      id: x.id, employeeId: x.employeeId, personName: x.personName,
      zugestelltAm: x.zugestelltAm, angesehenAm: x.angesehenAm,
      bestaetigtAm: x.bestaetigtAm, geraet: x.geraet,
      wortlaut: x.wortlaut, pruefsumme: x.pruefsumme,
      guete: guete(x),
    })),
  })
}

/**
 * Ändern — solange es erlaubt ist.
 *
 * Ab dem Verteilen ist fast alles festgeschrieben. Was nicht, steht in
 * `NACH_VERTEILEN_AENDERBAR`; die Begründung für das Übrige kommt aus
 * derselben Datei, damit sie nicht zweimal formuliert wird.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { antwort, session, customerId, b } = await holen(req, params.id)
  if (antwort) return antwort
  if (session!.role === 'employee') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const daten: Record<string, unknown> = {}

  for (const feld of [
    'titel', 'beschreibung', 'bestaetigungstext', 'fristBis', 'wiederholung',
    'oeffnenNoetig',
  ]) {
    if (body[feld] === undefined) continue
    if (!darfAendern(b!.status, feld)) {
      return NextResponse.json(
        { error: warumNichtAendern(b!.status, feld) }, { status: 409 },
      )
    }
    if (feld === 'fristBis') {
      daten.fristBis = body.fristBis ? new Date(String(body.fristBis)) : null
    } else if (feld === 'wiederholung') {
      daten.wiederholung = String(body.wiederholung) in WIEDERHOLUNGEN
        ? String(body.wiederholung) : null
    } else if (feld === 'oeffnenNoetig') {
      daten.oeffnenNoetig = body.oeffnenNoetig === true
    } else {
      const wert = String(body[feld] ?? '').slice(0, 5000).trim()
      if (feld === 'titel' && !wert) {
        return NextResponse.json({ error: 'Ein Titel fehlt.' }, { status: 400 })
      }
      daten[feld] = wert || null
    }
  }

  if (Object.keys(daten).length === 0) return NextResponse.json({ belehrung: b })

  const belehrung = await prisma.belehrung.update({
    where: { id: params.id }, data: daten, select: FELDER,
  })
  await logAudit({
    userId: session!.userId, userEmail: session!.email, userRole: session!.role,
    action: 'update', entityType: 'Belehrung', entityId: params.id,
    customerId, details: { felder: Object.keys(daten) },
  })
  return NextResponse.json({ belehrung, fehlt: fehltZumVerteilen(belehrung) })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { antwort, session, customerId, b } = await holen(req, params.id)
  if (antwort) return antwort

  const body = await req.json().catch(() => ({}))
  const aktion = String(body.aktion ?? '')

  // ── Bestätigen: das Einzige, was ein Mitarbeiter hier darf ───────────────
  if (aktion === 'bestaetigen') {
    if (session!.role !== 'employee' || !session!.employeeId) {
      return NextResponse.json(
        {
          error: 'Bestätigen kann nur die Person selbst. Eine Belehrung, die '
            + 'jemand für einen anderen abhakt, belegt nichts.',
        },
        { status: 403 },
      )
    }
    const beleg = await prisma.belehrungBestaetigung.findFirst({
      where: { belehrungId: params.id, employeeId: session!.employeeId },
    })
    if (!beleg) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

    const darf = darfBestaetigen(b!, beleg)
    if (!darf.ok) return NextResponse.json({ error: darf.grund }, { status: 400 })

    const person = await prisma.employee.findUnique({
      where: { id: session!.employeeId }, select: { name: true },
    })

    // Die drei Kopien: Name, Wortlaut, Fingerabdruck — aus diesem Augenblick.
    // Ein Beleg, der auf die heutige Fassung verweist, belegt nichts.
    const aktualisiert = await prisma.belehrungBestaetigung.update({
      where: { id: beleg.id },
      data: {
        bestaetigtAm: new Date(),
        personName: person?.name ?? beleg.personName,
        wortlaut: b!.bestaetigungstext,
        pruefsumme: b!.pruefsumme,
        geraet: geraetKurz(req.headers.get('user-agent')),
      },
    })

    await logAudit({
      userId: session!.userId, userEmail: session!.email, userRole: session!.role,
      action: 'create', entityType: 'BelehrungBestaetigung', entityId: beleg.id,
      customerId, details: { belehrung: b!.titel },
    })

    return NextResponse.json({
      ok: true,
      bestaetigtAm: aktualisiert.bestaetigtAm,
      guete: guete(aktualisiert),
    })
  }

  // ── Alles Weitere ist Sache des Betriebs ─────────────────────────────────
  if (session!.role === 'employee') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  if (aktion === 'verteilen') {
    if (b!.status !== 'entwurf') {
      return NextResponse.json(
        { error: 'Diese Runde ist bereits verteilt.' }, { status: 409 },
      )
    }
    const fehlt = fehltZumVerteilen(b!)
    if (fehlt.length > 0) {
      return NextResponse.json(
        { error: 'Die Belehrung kann so noch nicht raus.', fehlt }, { status: 400 },
      )
    }

    // An wen: alle aktiven Leute des Betriebs, die diese Sitzung sehen darf.
    // Eine Leitung verteilt an ihren Standort, die Unternehmensebene an alle.
    const scope = await allowedLocationScope(session!)
    const leute = await prisma.employee.findMany({
      where: {
        customerId, active: true, datenGesperrtAm: null,
        ...(scope.kind === 'all' ? {} : { locationId: { in: scope.ids } }),
        ...(Array.isArray(body.employeeIds) && body.employeeIds.length > 0
          ? { id: { in: body.employeeIds.map(String) } } : {}),
      },
      select: { id: true, name: true, locationId: true },
    })
    if (leute.length === 0) {
      return NextResponse.json(
        { error: 'Es gibt niemanden, an den verteilt werden könnte.' },
        { status: 400 },
      )
    }

    await prisma.belehrungBestaetigung.createMany({
      data: leute.map(l => ({
        belehrungId: params.id, employeeId: l.id, customerId: customerId!,
        locationId: l.locationId, personName: l.name,
      })),
      skipDuplicates: true,
    })
    await prisma.belehrung.update({
      where: { id: params.id },
      data: { status: 'verteilt', verteiltAm: new Date() },
    })

    for (const l of leute) {
      await notifyEmployee(l.id, {
        type: 'belehrung',
        title: `Zu bestätigen: ${b!.titel}`,
        body: b!.fristBis
          ? `Bitte bis ${b!.fristBis.toLocaleDateString('de-DE')} lesen und bestätigen.`
          : 'Bitte lesen und bestätigen.',
        requestId: params.id,
        url: `${getAppOrigin(req)}/employee/nachweise`,
      }).catch(() => undefined)
    }

    await logAudit({
      userId: session!.userId, userEmail: session!.email, userRole: session!.role,
      action: 'update', entityType: 'Belehrung', entityId: params.id,
      customerId, details: { verteilt: leute.length },
    })

    return NextResponse.json({ ok: true, verteilt: leute.length })
  }

  if (aktion === 'erinnern') {
    if (b!.status !== 'verteilt') {
      return NextResponse.json(
        { error: 'Erinnern geht nur an einer laufenden Runde.' }, { status: 409 },
      )
    }
    const scope = await allowedLocationScope(session!)
    const offen = await prisma.belehrungBestaetigung.findMany({
      where: {
        belehrungId: params.id, bestaetigtAm: null,
        ...(scope.kind === 'all' ? {} : { locationId: { in: scope.ids } }),
      },
      select: { id: true, employeeId: true, erinnertAm: true },
    })
    // Dieselbe Zurückhaltung wie bei den Anforderungen (§149): höchstens
    // einmal in sieben Tagen. Eine tägliche Mahnung liest niemand mehr.
    const grenze = Date.now() - 7 * 86_400_000
    const dran = offen.filter(o => !o.erinnertAm || o.erinnertAm.getTime() < grenze)

    for (const o of dran) {
      await notifyEmployee(o.employeeId, {
        type: 'belehrung_erinnerung',
        title: `Erinnerung: ${b!.titel}`,
        body: 'Die Belehrung ist noch offen. Bitte lesen und bestätigen.',
        requestId: params.id,
        url: `${getAppOrigin(req)}/employee/nachweise`,
      }).catch(() => undefined)
    }
    if (dran.length > 0) {
      await prisma.belehrungBestaetigung.updateMany({
        where: { id: { in: dran.map(d => d.id) } },
        data: { erinnertAm: new Date() },
      })
    }

    return NextResponse.json({
      erinnert: dran.length,
      offen: offen.length,
      ...(dran.length === 0 && offen.length > 0
        ? {
          hinweis: 'Hier wurde vor Kurzem schon erinnert. Eine Mahnung alle '
            + 'paar Tage liest noch jemand — eine tägliche nicht mehr.',
        }
        : {}),
    })
  }

  if (aktion === 'schliessen') {
    if (b!.status !== 'verteilt') {
      return NextResponse.json(
        { error: 'Nur eine laufende Runde lässt sich schließen.' }, { status: 409 },
      )
    }
    await prisma.belehrung.update({
      where: { id: params.id },
      data: { status: 'geschlossen', geschlossenAm: new Date() },
    })
    return NextResponse.json({ ok: true })
  }

  if (aktion === 'wiederholen') {
    // Eine neue Runde aus derselben Vorlage. Das Dokument wird nicht kopiert,
    // sondern geteilt: Es ist dieselbe Datei, und der Fingerabdruck belegt
    // genau das. Wer ein neues Dokument hat, lädt eine neue Belehrung hoch.
    const neu = await prisma.belehrung.create({
      data: {
        customerId: customerId!,
        titel: rundenTitel(b!.titel),
        beschreibung: b!.beschreibung,
        dateiId: b!.dateiId, dateiname: b!.dateiname, pruefsumme: b!.pruefsumme,
        bestaetigungstext: b!.bestaetigungstext,
        oeffnenNoetig: b!.oeffnenNoetig,
        wiederholung: b!.wiederholung,
        vorlageVon: b!.id,
        fristBis: b!.wiederholung && b!.verteiltAm
          ? naechsteRunde(new Date(), b!.wiederholung) : null,
        erstelltVon: session!.userId,
        erstelltVonName: session!.name ?? session!.email,
      },
      select: FELDER,
    })
    return NextResponse.json({ belehrung: neu })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}

/**
 * Einen Entwurf löschen.
 *
 * Nur einen Entwurf. An einer verteilten Runde hängen Belege — sie zu löschen
 * hieße, den Nachweis zu vernichten, für den das Ganze gebaut wurde.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { antwort, session, customerId, b } = await holen(req, params.id)
  if (antwort) return antwort
  if (session!.role === 'employee') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  if (b!.status !== 'entwurf') {
    return NextResponse.json(
      {
        error: 'An dieser Runde hängen Bestätigungen. Sie wird geschlossen, '
          + 'nicht gelöscht — sonst wäre der Nachweis weg, für den sie da ist.',
      },
      { status: 409 },
    )
  }

  if (b!.dateiId) {
    await prisma.storedFile.update({
      where: { id: b!.dateiId }, data: { deletedAt: new Date() },
    }).catch(() => undefined)
  }
  await prisma.belehrung.delete({ where: { id: params.id } })

  await logAudit({
    userId: session!.userId, userEmail: session!.email, userRole: session!.role,
    action: 'delete', entityType: 'Belehrung', entityId: params.id,
    customerId, details: { titel: b!.titel },
  })
  return NextResponse.json({ ok: true })
}
