import { NextRequest, NextResponse } from 'next/server'
import { createAndSendPasswordReset } from '@/lib/password-reset'
import { getAppOrigin } from '@/lib/app-url'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email || typeof email !== 'string' || !email.trim()) {
    return NextResponse.json({ error: 'E-Mail ist erforderlich' }, { status: 400 })
  }

  // Bewusst kein Hinweis, ob die E-Mail existiert (verhindert Enumeration) –
  // daher immer { ok: true } zurückgeben, auch wenn der Versand intern fehlschlägt.
  try {
    await createAndSendPasswordReset(getAppOrigin(req), email)
  } catch {}

  return NextResponse.json({ ok: true })
}
