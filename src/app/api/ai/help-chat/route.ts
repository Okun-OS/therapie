import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import {
  frageAssistenten, assistentEingerichtet, type AssistentNachricht,
} from '@/lib/assistent'

/**
 * Das Hilfe-Fenster hinter dem Fragezeichen (§140).
 *
 * §145 Der Systemtext und der Aufruf liegen in `src/lib/assistent.ts` — sie
 * werden auch vom Gespräch „OKUN Assistent" unter Nachrichten benutzt. Zwei
 * Kopien wären nach dem ersten Umbau auseinandergelaufen, und derselbe Mensch
 * bekäme auf dieselbe Frage zwei verschiedene Antworten.
 */
export async function POST(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  if (!assistentEingerichtet()) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 500 })
  }

  let body: { messages: AssistentNachricht[]; currentPage?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { messages, currentPage } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages ist erforderlich' }, { status: 400 })
  }

  const reply = await frageAssistenten(messages, currentPage)
  if (reply === null) {
    return NextResponse.json(
      { error: 'Der Assistent antwortet gerade nicht.' }, { status: 500 })
  }

  return NextResponse.json({ reply })
}
