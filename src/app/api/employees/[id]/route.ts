import { NextRequest, NextResponse } from 'next/server'
import { getEmployeeById, updateEmployee } from '@/lib/entities'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const employee = await getEmployeeById(params.id)
  if (!employee) return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })
  return NextResponse.json({ employee })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const updates = await req.json()
  const employee = await updateEmployee(params.id, updates)
  if (!employee) return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })
  return NextResponse.json({ employee })
}
