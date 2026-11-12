import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { allowedLocationScope, assertEmployeeAccess } from '@/lib/scope'
import {
  lage, darfSehen, naechsteFaelligkeit, giltFuerPerson, abgleichen,
  DRINGLICHKEIT, type Nachweisart, type Frist as FristTyp,
} from '@/lib/fristen'

export const dynamic = 'force-dynamic'

/**
 * §146 Der Stand der Fristen — wer was wann braucht.
 *
 * DREI SICHTEN AUF DIESELBEN DATEN
 *   ohne Parameter      alle Personen im eigenen Bereich, nach Dringlichkeit
 *   ?employeeId=…       eine Person
 *   (Rolle employee)    nur die eigenen
 *
 * DIE SICHTBARKEIT WIRD HIER DURCHGESETZT, NICHT IN DER OBERFLÄCHE.
 * Eine Standortleitung bekommt Arten, die auf „nur Unternehmen" stehen, gar
 * nicht erst in die Antwort — weder Name noch Zahl. Eine Liste, die „3 weitere
 * (nicht sichtbar)" anzeigt, verrät schon, dass es etwas gibt.
 */

function alsNachweisart(a: {
  id: string; name: string; gattung: string; giltFuer: string
  giltFuerWerte: string[]; faelligkeit: string; abstandMonate: number | null
  vorwarnTage: number; nachweisNoetig: boolean; sichtbarkeit: string
  folge: string; grundlage: string | null; aktiv: boolean
}): Nachweisart {
  return a as unknown as Nachweisart
}

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ eintraege: [], personen: [] })

  const gefragt = req.nextUrl.searchParams.get('employeeId')

  // Ein Mitarbeiter sieht ausschließlich seine eigenen Fristen — nie die einer
  // Kollegin. Wer welche Belehrung schuldig ist, geht niemanden sonst etwas an.
  let employeeIds: string[]
  if (session.role === 'employee') {
    if (!session.employeeId) return NextResponse.json({ eintraege: [], personen: [] })
    employeeIds = [session.employeeId]
  } else if (gefragt) {
    const verweigert = await assertEmployeeAccess(session, gefragt)
    if (verweigert) return verweigert
    employeeIds = [gefragt]
  } else {
    const scope = await allowedLocationScope(session)
    const leute = await prisma.employee.findMany({
      where: {
        customerId, active: true, datenGesperrtAm: null,
        ...(scope.kind === 'all' ? {} : { locationId: { in: scope.ids } }),
      },
      select: { id: true },
    })
    employeeIds = leute.map(l => l.id)
  }
  if (employeeIds.length === 0) {
    return NextResponse.json({ eintraege: [], personen: [] })
  }

  const [arten, fristen, personen] = await Promise.all([
    prisma.nachweisart.findMany({ where: { customerId } }),
    prisma.frist.findMany({ where: { employeeId: { in: employeeIds } } }),
    prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true, position: true, locationId: true },
    }),
  ])

  const artNach = new Map(arten.map(a => [a.id, a]))
  const personNach = new Map(personen.map(p => [p.id, p]))
  const heute = new Date()

  const eintraege = fristen
    .map(f => {
      const art = f.nachweisartId ? artNach.get(f.nachweisartId) : null
      // Von Hand angelegte Fristen (ohne Art) sind für die Leitung sichtbar —
      // sie hat sie selbst gesetzt.
      const sichtbarkeit = art?.sichtbarkeit ?? 'leitung'
      if (!darfSehen({ sichtbarkeit } as Nachweisart, session.role)
        && session.role !== 'employee') return null
      // Ein Mitarbeiter sieht seine eigenen immer — es sind seine.
      const vorwarn = art?.vorwarnTage ?? 56
      const l = lage(f as unknown as FristTyp, { vorwarnTage: vorwarn }, heute)
      const person = personNach.get(f.employeeId)
      return {
        id: f.id,
        employeeId: f.employeeId,
        personName: person?.name ?? 'Unbekannt',
        locationId: person?.locationId ?? null,
        nachweisartId: f.nachweisartId,
        bezeichnung: f.bezeichnung,
        gattung: f.gattung,
        erfuelltAm: f.erfuelltAm,
        faelligAm: f.faelligAm,
        befreitAm: f.befreitAm,
        befreitGrund: f.befreitGrund,
        dateiId: f.dateiId,
        notiz: f.notiz,
        stand: l.stand,
        standText: l.text,
        tageBis: l.tageBis,
        folge: art?.folge ?? 'warnen',
        grundlage: art?.grundlage ?? null,
        nachweisNoetig: art?.nachweisNoetig ?? true,
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      const d = DRINGLICHKEIT[a!.stand] - DRINGLICHKEIT[b!.stand]
      if (d !== 0) return d
      return (a!.tageBis ?? 9999) - (b!.tageBis ?? 9999)
    })

  return NextResponse.json({
    eintraege,
    personen: personen.map(p => ({ id: p.id, name: p.name })),
    zusammenfassung: {
      abgelaufen: eintraege.filter(e => e!.stand === 'abgelaufen').length,
      fehlt: eintraege.filter(e => e!.stand === 'fehlt').length,
      laeuftAb: eintraege.filter(e => e!.stand === 'laeuft_ab').length,
    },
  })
}

/**
 * Fristen für eine Person aus dem Katalog anlegen.
 *
 * Wird beim Einstellen gebraucht, nach einem Positionswechsel und wenn der
 * Betrieb seinen Katalog erweitert hat. Legt nur an, was fehlt — und wirft
 * nichts weg: In einer alten Frist steckt ein Dokument.
 */
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    employeeId?: string
    /** Eine einzelne Art von Hand zuweisen */
    nachweisartId?: string
    /** Oder eine freie Frist ohne Katalogeintrag */
    bezeichnung?: string
    faelligAm?: string
    gattung?: string
  }

  if (!body.employeeId) {
    return NextResponse.json({ error: 'employeeId fehlt' }, { status: 400 })
  }
  const verweigert = await assertEmployeeAccess(session, body.employeeId)
  if (verweigert) return verweigert

  const person = await prisma.employee.findUnique({
    where: { id: body.employeeId },
    select: { id: true, position: true, qualifications: true, joinedAt: true, active: true },
  })
  if (!person) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  // Eine freie Frist ohne Katalogeintrag — etwa ein Probezeitende.
  if (body.bezeichnung && !body.nachweisartId) {
    const frist = await prisma.frist.create({
      data: {
        employeeId: person.id, customerId,
        bezeichnung: body.bezeichnung.trim(),
        gattung: body.gattung === 'vertrag' ? 'vertrag' : 'nachweis',
        faelligAm: body.faelligAm ? new Date(body.faelligAm) : null,
      },
    })
    return NextResponse.json({ frist })
  }

  const arten = await prisma.nachweisart.findMany({ where: { customerId, aktiv: true } })
  const vorhandene = await prisma.frist.findMany({ where: { employeeId: person.id } })

  // Eine einzelne Art zuweisen (der Fall „gilt für: einzeln").
  const anzulegen = body.nachweisartId
    ? arten.filter(a => a.id === body.nachweisartId)
    : abgleichen(
      arten.map(alsNachweisart),
      person as never,
      vorhandene as unknown as FristTyp[],
    ).anzulegen

  if (anzulegen.length === 0) {
    return NextResponse.json({ angelegt: 0, hinweis: 'Nichts Neues.' })
  }

  let angelegt = 0
  for (const art of anzulegen) {
    const a = alsNachweisart(art as never)
    try {
      await prisma.frist.create({
        data: {
          employeeId: person.id, customerId, nachweisartId: a.id,
          bezeichnung: a.name, gattung: a.gattung,
          faelligAm: naechsteFaelligkeit(a, null, person.joinedAt),
        },
      })
      angelegt++
    } catch {
      // Die Eindeutigkeit (employeeId + nachweisartId) fängt Doppelte ab.
    }
  }

  return NextResponse.json({ angelegt })
}

/**
 * Eine Frist erfüllen, befreien oder ändern.
 *
 * Der wichtigste Fall ist „erfüllt am": Daraus rechnet der Motor das nächste
 * Ablaufdatum selbst aus. Wer es von Hand setzen will, kann `faelligAm`
 * mitschicken — das gewinnt.
 */
export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json().catch(() => ({})) as {
    id?: string
    erfuelltAm?: string | null
    faelligAm?: string | null
    befreitGrund?: string | null
    befreien?: boolean
    dateiId?: string | null
    notiz?: string | null
  }
  if (!body.id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const frist = await prisma.frist.findUnique({ where: { id: body.id } })
  if (!frist) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const verweigert = await assertEmployeeAccess(session, frist.employeeId)
  if (verweigert) return verweigert

  // Wer befreit, muss sagen warum. Sonst ist es keine Befreiung, sondern
  // Vergessen — und in einem Jahr weiß niemand mehr, ob es Absicht war.
  if (body.befreien && !String(body.befreitGrund ?? '').trim()) {
    return NextResponse.json(
      { error: 'Eine Befreiung braucht eine Begründung.' }, { status: 400 })
  }

  const art = frist.nachweisartId
    ? await prisma.nachweisart.findUnique({ where: { id: frist.nachweisartId } })
    : null

  // Sichtbarkeit gilt auch beim Schreiben: Was eine Leitung nicht sehen darf,
  // darf sie auch nicht ändern.
  if (art && !darfSehen(alsNachweisart(art as never), session.role)) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  const erfuellt = body.erfuelltAm !== undefined
    ? (body.erfuelltAm ? new Date(body.erfuelltAm) : null)
    : frist.erfuelltAm

  const person = await prisma.employee.findUnique({
    where: { id: frist.employeeId }, select: { joinedAt: true },
  })

  const gerechnet = art
    ? naechsteFaelligkeit(alsNachweisart(art as never), erfuellt, person?.joinedAt)
    : frist.faelligAm

  const aktualisiert = await prisma.frist.update({
    where: { id: body.id },
    data: {
      erfuelltAm: erfuellt,
      faelligAm: body.faelligAm !== undefined
        ? (body.faelligAm ? new Date(body.faelligAm) : null)
        : gerechnet,
      ...(body.befreien !== undefined
        ? {
          befreitAm: body.befreien ? new Date() : null,
          befreitGrund: body.befreien ? String(body.befreitGrund).trim() : null,
        }
        : {}),
      ...(body.dateiId !== undefined ? { dateiId: body.dateiId } : {}),
      ...(body.notiz !== undefined ? { notiz: body.notiz } : {}),
    },
  })

  return NextResponse.json({ frist: aktualisiert })
}

/**
 * Eine Frist entfernen.
 *
 * Der Abgleich aus dem Katalog räumt NIE von selbst weg — in einer alten Frist
 * stecken ein Dokument und eine Vorgeschichte. Ein Mensch darf das trotzdem:
 * Wer versehentlich etwas zugewiesen hat, soll es auch wieder loswerden.
 *
 * Wo ein Nachweisdokument hängt, bleibt die Datei in der Personalakte. Sie
 * gehört dorthin und nicht an diesen Eintrag.
 */
export async function DELETE(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const frist = await prisma.frist.findUnique({ where: { id } })
  if (!frist) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const verweigert = await assertEmployeeAccess(session, frist.employeeId)
  if (verweigert) return verweigert

  // Auch hier gilt die Sichtbarkeit: Was eine Leitung nicht sehen darf, darf
  // sie auch nicht wegräumen.
  if (frist.nachweisartId) {
    const art = await prisma.nachweisart.findUnique({ where: { id: frist.nachweisartId } })
    if (art && !darfSehen(alsNachweisart(art as never), session.role)) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    }
  }

  await prisma.frist.delete({ where: { id } })
  return NextResponse.json({ entfernt: true })
}
