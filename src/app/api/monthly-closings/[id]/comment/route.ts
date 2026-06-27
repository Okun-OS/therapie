import { NextRequest, NextResponse } from 'next/server'
import { addMonthlyClosingComment } from '@/lib/time-tracking-entities'
import { requireRole } from '@/lib/session'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['admin', 'company'])
  if (session instanceof NextResponse) return session

  const { author, text } = await req.json()
  if (!author?.trim() || !text?.trim()) {
    return NextResponse.json({ error: 'author und text sind erforderlich' }, { status: 400 })
  }

  await addMonthlyClosingComment(params.id, author, text)
  return NextResponse.json({ success: true })
}
