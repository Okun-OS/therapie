import { NextRequest, NextResponse } from 'next/server'
import { escalateRequest } from '@/lib/substitution-service'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const request = await escalateRequest(params.id)
    return NextResponse.json({ request })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fehler bei der Eskalation' }, { status: 400 })
  }
}
