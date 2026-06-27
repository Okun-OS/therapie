import { NextRequest, NextResponse } from 'next/server'
import { escalateRequest } from '@/lib/substitution-service'
import { requireRole } from '@/lib/session'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  try {
    const request = await escalateRequest(params.id)
    return NextResponse.json({ request })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler bei der Eskalation' }, { status: 400 })
  }
}
