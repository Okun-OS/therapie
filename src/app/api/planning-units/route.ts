import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { listPlanningUnitsByLocation, upsertPlanningUnit, updatePlanningUnitById, deletePlanningUnit } from '@/lib/schedule-entities'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const locationId = req.nextUrl.searchParams.get('locationId')
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
  if (!locationId || !name) return NextResponse.json({ error: 'locationId und name erforderlich' }, { status: 400 })

  const unit = await upsertPlanningUnit(locationId, { name, ...rest })
  return NextResponse.json({ unit })
}

// PUT — §71: update name/parentId/minStaff of a unit by id
export async function PUT(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  let body: { id?: string; name?: string; parentId?: string | null; minStaff?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }
  if (!body.id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const unit = await updatePlanningUnitById(body.id, {
    name: body.name,
    parentId: body.parentId,
    minStaff: body.minStaff,
  })
  if (!unit) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json({ unit })
}

export async function DELETE(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  await deletePlanningUnit(id)
  return NextResponse.json({ ok: true })
}
