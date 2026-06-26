import { NextRequest, NextResponse } from 'next/server'
import { removeTaskType } from '@/lib/mock-data'
import { removeAllowedTaskFromEmployees } from '@/lib/entities'

export async function DELETE(_req: NextRequest, { params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name)
  removeTaskType(name)
  await removeAllowedTaskFromEmployees(name)
  return NextResponse.json({ success: true })
}
