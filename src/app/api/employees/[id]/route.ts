import { NextRequest, NextResponse } from 'next/server'
import { getEmployeeById, updateEmployee } from '@/lib/entities'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employee = await getEmployeeById(params.id)
  if (!employee) return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })
  return NextResponse.json({ employee })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const updates = await req.json()
  const employee = await updateEmployee(params.id, updates)
  if (!employee) return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })
  return NextResponse.json({ employee })
}
