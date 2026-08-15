import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId, resolveLocationId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { generateConstraintCode } from '@/lib/custom-constraint-generator'

// GET  /api/admin/custom-constraints  — list for location
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'okun'])
  if (session instanceof NextResponse) return session

  const locationId = await resolveLocationId(session)
  if (!locationId) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })

  const constraints = await prisma.customConstraint.findMany({
    where: { locationId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, description: true, code: true, status: true, errorLog: true, createdAt: true },
  })

  return NextResponse.json({ constraints })
}

// POST /api/admin/custom-constraints  — generate code for a natural-language rule
export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'okun'])
  if (session instanceof NextResponse) return session

  const locationId = await resolveLocationId(session)
  if (!locationId) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  const body = await req.json()
  const { name, description } = body as { name?: string; description?: string }
  if (!name?.trim() || !description?.trim()) {
    return NextResponse.json({ error: 'Name und Beschreibung erforderlich' }, { status: 400 })
  }

  try {
    const code = await generateConstraintCode(name.trim(), description.trim())
    if (!code) {
      return NextResponse.json(
        { error: 'Die KI hat diese Regel als nicht planbar eingestuft (keine Dienstplan-Beschränkung).' },
        { status: 422 },
      )
    }

    const constraint = await prisma.customConstraint.create({
      data: {
        locationId,
        customerId,
        name: name.trim(),
        description: description.trim(),
        code,
        status: 'pending',
      },
    })

    return NextResponse.json({ constraint }, { status: 201 })
  } catch (err) {
    console.error('[custom-constraints] generation error', err)
    const msg = err instanceof Error && err.message.includes('ANTHROPIC_API_KEY') ? 'KI nicht konfiguriert' : 'KI-Fehler bei Code-Generierung'
    return NextResponse.json({ error: msg }, { status: msg === 'KI nicht konfiguriert' ? 503 : 502 })
  }
}
