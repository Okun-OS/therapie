import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { generateConstraintCode } from '@/lib/custom-constraint-generator'

// PUT /api/admin/custom-constraints/[id]  — update status or code
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = requireRole(req, ['admin', 'okun'])
  if (session instanceof NextResponse) return session

  const existing = await prisma.customConstraint.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  if (session.role !== 'okun') {
    const customerId = await resolveCustomerId(session)
    if (existing.customerId !== customerId) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const body = await req.json() as { status?: string; code?: string; errorLog?: string | null; action?: string }

  // §76: retry a failed/stranded generation for this single rule
  if (body.action === 'regenerate') {
    try {
      const code = await generateConstraintCode(existing.name, existing.description)
      if (!code) {
        const updated = await prisma.customConstraint.update({
          where: { id: params.id },
          data: { status: 'rejected', errorLog: 'Von der KI als nicht planbare Regel eingestuft.' },
        })
        return NextResponse.json({ constraint: updated })
      }
      const updated = await prisma.customConstraint.update({
        where: { id: params.id },
        data: { code, status: 'pending', errorLog: null },
      })
      return NextResponse.json({ constraint: updated })
    } catch (err) {
      const updated = await prisma.customConstraint.update({
        where: { id: params.id },
        data: { status: 'error', errorLog: (err instanceof Error ? err.message : String(err)).slice(0, 500) },
      })
      return NextResponse.json({ constraint: updated })
    }
  }

  const allowed = ['pending', 'active', 'rejected']
  if (body.status && !allowed.includes(body.status)) {
    return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 })
  }

  const updated = await prisma.customConstraint.update({
    where: { id: params.id },
    data: {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.code !== undefined ? { code: body.code } : {}),
      ...(body.errorLog !== undefined ? { errorLog: body.errorLog } : {}),
    },
  })

  return NextResponse.json({ constraint: updated })
}

// DELETE /api/admin/custom-constraints/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = requireRole(req, ['admin', 'okun'])
  if (session instanceof NextResponse) return session

  const existing = await prisma.customConstraint.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  if (session.role !== 'okun') {
    const customerId = await resolveCustomerId(session)
    if (existing.customerId !== customerId) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  await prisma.customConstraint.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
