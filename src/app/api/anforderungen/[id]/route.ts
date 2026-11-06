import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { assertEmployeeAccess } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import { notifyEmployee } from '@/lib/notify'
import { sendEmail } from '@/lib/email'
import { getAppOrigin } from '@/lib/app-url'
import { dateiSpeichern, pruefeDatei, sichererDateiname } from '@/lib/file-storage'
import { naechsteFaelligkeit, type Nachweisart } from '@/lib/fristen'
import { darfWechseln, warumNicht, lage, type Seite } from '@/lib/anforderung'

export const dynamic = 'force-dynamic'

/**
 * §149 Der einzelne Vorgang: Gespräch, Einreichung, Abnahme.
 *
 * DIE EINE STELLE, AN DER DIE SEITE ENTSCHIEDEN WIRD
 * `seiteVon()`. Wer als Mitarbeiter angemeldet ist, ist der Mensch; alle
 * anderen sind der Betrieb. Daraus folgt alles Weitere — was jemand darf,
 * steht in `src/lib/anforderung.ts` und wird hier nur angewandt.
 *
 * WARUM DIE ABNAHME DIE FRIST ERFÜLLT
 * Weil das Ziel nicht die Datei ist, sondern eine gültige Frist. Ohne diesen
 * Schritt gäbe es zwei Wahrheiten: eine abgenommene Bescheinigung und eine
 * Frist, die weiter auf Rot steht. Der Motor (§146) rechnet das nächste
 * Ablaufdatum daraus selbst aus.
 */

function seiteVon(rolle: string): Seite {
  return rolle === 'employee' ? 'mitarbeiter' : 'betrieb'
}

async function holen(req: NextRequest, id: string) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return { antwort: session }

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return {
      antwort: NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 }),
    }
  }

  const a = await prisma.anforderung.findFirst({ where: { id, customerId } })
  if (!a) {
    return { antwort: NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 }) }
  }

  // Der Mitarbeiter kommt an seine eigenen, sonst an gar nichts. Für alle
  // anderen gilt die übliche Standortgrenze.
  if (session.role === 'employee') {
    if (a.employeeId !== session.employeeId) {
      return { antwort: NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 }) }
    }
  } else {
    const verweigert = await assertEmployeeAccess(session, a.employeeId)
    if (verweigert) return { antwort: verweigert }
  }

  return { session, customerId, a }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { antwort, session, a } = await holen(req, params.id)
  if (antwort) return antwort

  const beitraege = await prisma.anforderungBeitrag.findMany({
    where: { anforderungId: params.id }, orderBy: { createdAt: 'asc' },
  })
  const l = lage(a!, seiteVon(session!.role))

  return NextResponse.json({
    anforderung: {
      ...a,
      stand: l.stand, standText: l.text, hinweisText: l.hinweis,
      ueberfaellig: l.ueberfaellig, tageBis: l.tageBis,
    },
    beitraege,
    seite: seiteVon(session!.role),
  })
}

/**
 * Einen Beitrag schreiben — mit oder ohne Datei.
 *
 * Nimmt `multipart/form-data` (mit Anhang) und `application/json` (ohne)
 * entgegen. Ein Anhang von der Seite des Menschen setzt den Vorgang
 * zugleich auf „eingereicht": Wer eine Datei hochlädt, reicht ein. Ein
 * zweiter Knopf dafür wäre eine Falle — man lädt hoch, geht weg, und der
 * Betrieb sieht nichts.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { antwort, session, customerId, a } = await holen(req, params.id)
  if (antwort) return antwort

  const seite = seiteVon(session!.role)
  if (a!.status === 'erledigt' || a!.status === 'zurueckgezogen') {
    return NextResponse.json(
      { error: warumNicht(a!.status, 'eingereicht', seite) }, { status: 409 },
    )
  }

  let text = ''
  let anhang: { name: string; typ: string; daten: Buffer } | null = null

  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null)
    if (!form) {
      return NextResponse.json({ error: 'Der Upload kam nicht an.' }, { status: 400 })
    }
    text = String(form.get('text') ?? '')
    const datei = form.get('datei')
    if (datei instanceof File && datei.size > 0) {
      const puffer = Buffer.from(await datei.arrayBuffer())
      const geprueft = pruefeDatei(datei.name, datei.type, puffer.length)
      if (!geprueft.ok) {
        return NextResponse.json({ error: geprueft.fehler }, { status: 400 })
      }
      anhang = { name: datei.name, typ: datei.type, daten: puffer }
    }
  } else {
    const body = await req.json().catch(() => ({}))
    text = String(body.text ?? '')
  }

  text = text.slice(0, 5000).trim()
  if (!text && !anhang) {
    return NextResponse.json(
      { error: 'Ohne Text und ohne Datei gibt es nichts zu senden.' }, { status: 400 },
    )
  }

  let dateiId: string | null = null
  let dateiname: string | null = null
  if (anhang) {
    // §100 Die Datei liegt in der Personalakte der Person — nicht am Vorgang.
    // Sie gehört dorthin, wo Unterlagen liegen, und überlebt damit auch das
    // Abschließen des Vorgangs.
    const gespeichert = await dateiSpeichern({
      customerId: customerId!,
      locationId: a!.locationId,
      ownerType: 'employee',
      ownerId: a!.employeeId,
      kategorie: 'bescheinigung',
      dateiname: sichererDateiname(anhang.name),
      mimeType: anhang.typ,
      daten: anhang.daten,
      hochgeladenVon: session!.employeeId ?? session!.userId,
      hochgeladenVonName: session!.name ?? session!.email,
      notiz: `Eingereicht zu: ${a!.titel}`,
      // Wer sie selbst eingereicht hat, soll sie auch wiedersehen können.
      sichtbarFuerMitarbeiter: seite === 'mitarbeiter',
    })
    dateiId = gespeichert.id
    dateiname = gespeichert.dateiname
  }

  await prisma.anforderungBeitrag.create({
    data: {
      anforderungId: params.id, userId: session!.userId, seite,
      absenderName: session!.name ?? session!.email,
      text: text || `${dateiname} hochgeladen.`,
      dateiId, dateiname,
    },
  })

  // Eine Datei vom Menschen heißt: eingereicht.
  let neuerStand = a!.status
  if (seite === 'mitarbeiter' && anhang
      && darfWechseln(a!.status, 'eingereicht', 'mitarbeiter')) {
    await prisma.anforderung.update({
      where: { id: params.id },
      data: {
        status: 'eingereicht', statusAm: new Date(), eingereichtAm: new Date(),
      },
    })
    neuerStand = 'eingereicht'
  }

  // Die andere Seite erfährt davon. Ohne diese Zeile schreibt jemand in ein
  // Fenster, das niemand aufmacht.
  if (seite === 'mitarbeiter') {
    const empfaenger = a!.angefordertVon
      ? await prisma.user.findUnique({
        where: { id: a!.angefordertVon }, select: { email: true },
      })
      : null
    const person = await prisma.employee.findUnique({
      where: { id: a!.employeeId }, select: { name: true },
    })
    if (empfaenger?.email) {
      await sendEmail(
        empfaenger.email,
        anhang
          ? `Eingereicht: ${a!.titel} — ${person?.name ?? ''}`
          : `Antwort zu: ${a!.titel} — ${person?.name ?? ''}`,
        text || `${dateiname} wurde hochgeladen.`,
        {
          ctaUrl: `${getAppOrigin(req)}/admin/nachweise`,
          ctaLabel: 'Ansehen und prüfen',
        },
      ).catch(() => undefined)
    }
  } else {
    await notifyEmployee(a!.employeeId, {
      type: 'nachweis_nachricht',
      title: `Zu „${a!.titel}“`,
      body: text.slice(0, 300),
      requestId: params.id,
      url: `${getAppOrigin(req)}/employee/nachweise`,
    }).catch(() => undefined)
  }

  return NextResponse.json({ ok: true, stand: neuerStand, dateiId })
}

/**
 * Den Stand bewegen: abnehmen, nachfragen, zurückziehen, einreichen ohne Datei.
 *
 * Wer was darf, entscheidet `darfWechseln()` — und die Begründung, warum
 * nicht, kommt aus derselben Datei. Eine Fehlermeldung, die nur „nicht
 * erlaubt" sagt, lässt den Anwender raten.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { antwort, session, customerId, a } = await holen(req, params.id)
  if (antwort) return antwort

  const seite = seiteVon(session!.role)
  const body = await req.json().catch(() => ({}))
  const nach = String(body.status ?? '')

  if (!darfWechseln(a!.status, nach, seite)) {
    return NextResponse.json(
      { error: warumNicht(a!.status, nach, seite) }, { status: 400 },
    )
  }

  const notiz = String(body.notiz ?? '').slice(0, 5000).trim()
  if (nach === 'rueckfrage' && !notiz) {
    return NextResponse.json(
      {
        error: 'Eine Rückfrage ohne Frage ist keine. Schreib dazu, was fehlt — '
          + 'sonst reicht derselbe Nachweis noch einmal ein.',
      },
      { status: 400 },
    )
  }

  const daten: Record<string, unknown> = { status: nach, statusAm: new Date() }
  if (nach === 'eingereicht') daten.eingereichtAm = new Date()
  if (nach === 'erledigt') {
    daten.erledigtAm = new Date()
    daten.erledigtVon = session!.name ?? session!.email
  }

  await prisma.anforderung.update({ where: { id: params.id }, data: daten })

  // §146 Die Abnahme erfüllt die Frist. Das ist der eigentliche Zweck des
  // ganzen Vorgangs — ohne diesen Schritt stünde sie weiter auf Rot.
  let fristErfuellt = false
  if (nach === 'erledigt' && a!.fristId) {
    const frist = await prisma.frist.findFirst({
      where: { id: a!.fristId, customerId },
    })
    if (frist) {
      const art = frist.nachweisartId
        ? await prisma.nachweisart.findUnique({ where: { id: frist.nachweisartId } })
        : null
      const erfuelltAm = body.erfuelltAm ? new Date(String(body.erfuelltAm)) : new Date()
      // Die zuletzt eingereichte Datei wird an die Frist gehängt — sie ist
      // der Beleg, auf den sich die Abnahme stützt.
      const letzte = await prisma.anforderungBeitrag.findFirst({
        where: { anforderungId: params.id, dateiId: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { dateiId: true },
      })
      await prisma.frist.update({
        where: { id: frist.id },
        data: {
          erfuelltAm,
          faelligAm: art
            ? naechsteFaelligkeit(art as unknown as Nachweisart, erfuelltAm)
            : frist.faelligAm,
          ...(letzte?.dateiId ? { dateiId: letzte.dateiId } : {}),
        },
      })
      fristErfuellt = true
    }
  }

  await prisma.anforderungBeitrag.create({
    data: {
      anforderungId: params.id, userId: session!.userId, seite: 'system',
      absenderName: session!.name ?? session!.email,
      text: nach === 'erledigt'
        ? `Abgenommen.${notiz ? ` ${notiz}` : ''}`
          + (fristErfuellt ? ' Die Frist ist damit erfüllt.' : '')
        : nach === 'rueckfrage' ? `Rückfrage: ${notiz}`
          : nach === 'zurueckgezogen'
            ? `Zurückgezogen.${notiz ? ` ${notiz}` : ''}`
            : `Eingereicht.${notiz ? ` ${notiz}` : ''}`,
    },
  }).catch(() => undefined)

  // Wer jetzt am Zug ist, erfährt es.
  if (seite === 'betrieb') {
    await notifyEmployee(a!.employeeId, {
      type: nach === 'erledigt' ? 'nachweis_erledigt' : 'nachweis_rueckfrage',
      title: nach === 'erledigt'
        ? `Erledigt: ${a!.titel}`
        : nach === 'rueckfrage' ? `Rückfrage zu: ${a!.titel}`
          : `Nicht mehr nötig: ${a!.titel}`,
      body: nach === 'erledigt'
        ? 'Danke — das ist abgehakt.'
        : notiz || 'Bitte sieh noch einmal hinein.',
      requestId: params.id,
      url: `${getAppOrigin(req)}/employee/nachweise`,
    }).catch(() => undefined)
  }

  await logAudit({
    userId: session!.userId, userEmail: session!.email, userRole: session!.role,
    action: 'update', entityType: 'Anforderung', entityId: params.id,
    customerId, details: { status: nach, fristErfuellt },
  })

  return NextResponse.json({ ok: true, status: nach, fristErfuellt })
}
