import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { locationFilter } from '@/lib/scope'
import { listPlanningUnitsByLocation, upsertPlanningUnit, updatePlanningUnitById, deletePlanningUnit } from '@/lib/schedule-entities'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')

  // §112 Vorher liessen sich die Einheiten jedes Standorts abrufen.
  if (locationId) {
    const erlaubtGet = await locationFilter(session, locationId)
    if (erlaubtGet instanceof NextResponse) return erlaubtGet
  }
  if (!locationId) return NextResponse.json({ error: 'locationId erforderlich' }, { status: 400 })

  const units = await listPlanningUnitsByLocation(locationId)
  return NextResponse.json({ units })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  let body: { locationId?: string; name?: string; type?: string; description?: string; capacity?: number; address?: string; notes?: string; sortOrder?: number; parentId?: string | null; minStaff?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { locationId, name, ...rest } = body

  // §112 Eine fremde Leitung konnte an diesem Standort Einheiten anlegen.
  const erlaubtPost = await locationFilter(session, locationId)
  if (erlaubtPost instanceof NextResponse) return erlaubtPost
  if (!locationId || !name) return NextResponse.json({ error: 'locationId und name erforderlich' }, { status: 400 })

  const unit = await upsertPlanningUnit(locationId, { name, ...rest })
  return NextResponse.json({ unit })
}

// PUT — §71: update name/parentId/minStaff of a unit by id
export async function PUT(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  let body: {
    id?: string; name?: string; parentId?: string | null; minStaff?: number
    abgabeGesperrtBis?: string | null; abgabeGrund?: string | null
    unterwegsVon?: string | null; unterwegsBis?: string | null; unterwegsGrund?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }
  if (!body.id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  // §112 Eine fremde Leitung konnte bisher jede Einheit über ihre Kennung
  // ändern — geprüft wurde nur die Rolle.
  const bestand = await prisma.planningUnit.findUnique({
    where: { id: body.id }, select: { locationId: true },
  })
  if (!bestand) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  const erlaubtPut = await locationFilter(session, bestand.locationId)
  if (erlaubtPut instanceof NextResponse) return erlaubtPut

  /*
   * §182 „Diese Gruppe ist unterwegs" — und warum beide Daten zusammengehören.
   *
   * Ein Zeitraum mit Anfang und ohne Ende ist keine Fahrt, sondern eine
   * Schließung auf unbestimmte Zeit. Die Gruppe fiele aus jeder künftigen
   * Planung heraus, und in sechs Monaten fragt sich jemand, warum Gruppe 3
   * nie besetzt wird. Deshalb: entweder beides oder nichts.
   */
  const tagForm = /^\d{4}-\d{2}-\d{2}$/
  const von = body.unterwegsVon?.trim() || null
  const bis = body.unterwegsBis?.trim() || null
  if ((von === null) !== (bis === null)) {
    return NextResponse.json({
      error: 'Für „unterwegs" braucht es beide Daten — von und bis. '
        + 'Ein Zeitraum ohne Ende würde diese Gruppe dauerhaft aus der Planung nehmen.',
    }, { status: 400 })
  }
  if (von && bis) {
    if (!tagForm.test(von) || !tagForm.test(bis)) {
      return NextResponse.json({ error: 'Die Daten müssen im Format JJJJ-MM-TT stehen.' }, { status: 400 })
    }
    if (bis < von) {
      return NextResponse.json({ error: 'Das Ende liegt vor dem Anfang.' }, { status: 400 })
    }
  }
  if (body.abgabeGesperrtBis && !tagForm.test(body.abgabeGesperrtBis.trim())) {
    return NextResponse.json({ error: 'Die Abgabesperre braucht ein Datum im Format JJJJ-MM-TT.' }, { status: 400 })
  }

  const unit = await updatePlanningUnitById(body.id, {
    name: body.name,
    parentId: body.parentId,
    minStaff: body.minStaff,
    // §166 Die Abgabesperre. Ein leerer Wert hebt sie auf — eine Sperre ohne
    // Ablaufdatum staende in zwei Jahren noch da.
    ...(body.abgabeGesperrtBis !== undefined
      ? { abgabeGesperrtBis: body.abgabeGesperrtBis?.trim() || null }
      : {}),
    ...(body.abgabeGrund !== undefined
      ? { abgabeGrund: body.abgabeGrund?.trim() || null }
      : {}),
    ...(body.unterwegsVon !== undefined ? { unterwegsVon: von } : {}),
    ...(body.unterwegsBis !== undefined ? { unterwegsBis: bis } : {}),
    ...(body.unterwegsGrund !== undefined
      ? { unterwegsGrund: body.unterwegsGrund?.trim() || null }
      : {}),
  })
  if (!unit) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json({ unit })
}

export async function DELETE(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const id = req.nextUrl.searchParams.get('id')

  // §112 Loeschen war allein ueber die ID moeglich — auch an fremden Standorten.
  if (id) {
    const einheit = await prisma.planningUnit.findUnique({
      where: { id }, select: { locationId: true },
    })
    if (!einheit) return NextResponse.json({ error: 'Einheit nicht gefunden' }, { status: 404 })
    const erlaubtDel = await locationFilter(session, einheit.locationId)
    if (erlaubtDel instanceof NextResponse) return erlaubtDel
  }
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  await deletePlanningUnit(id)
  return NextResponse.json({ ok: true })
}
