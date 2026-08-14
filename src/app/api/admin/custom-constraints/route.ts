import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId, resolveLocationId } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

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

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'KI nicht konfiguriert' }, { status: 503 })

  const client = new Anthropic({ apiKey })

  const systemPrompt = `Du bist ein Experte für OR-Tools CP-SAT Constraint Programming in Python.
Deine Aufgabe ist es, Python-Code zu generieren, der als Zusatzbeschränkung in ein CP-SAT Dienstplan-Modell eingefügt wird.

Verfügbare Variablen im Ausführungskontext:
- model: cp_model.CpModel  — das CP-SAT Modell
- X: dict[(ei, di, si), BoolVar]  — Zuweisung: Mitarbeiter ei an Tag di in Schicht si
- employees: list[dict]  — Liste der Mitarbeiter; jeder hat: id, name, einheiten, wochenstundenSoll, qualifikationen, verfuegbareSchichtTypen
- shifts: list[dict]  — Liste der Schichten; jede hat: id, name, typ, von, bis, minBesetzungGesamt
- days: list[str]  — Planungstage als "YYYY-MM-DD"
- day_idx: dict[str, int]  — Tag-String → Index in days
- shift_idx: dict[str, int]  — Schicht-ID → Index in shifts
- n_emp, n_days, n_shifts: int  — Dimensionen

Wichtige Regeln für den generierten Code:
1. Füge KEINE Importe hinzu und definiere KEINE Funktionen — nur direkte Statements
2. Verwende ausschließlich model.add(...) für Constraints; model.minimize ist nicht erlaubt
3. Greife auf employees[ei] und shifts[si] per Index zu; nutze .get() mit Fallback bei dict-Feldern
4. Fange potenzielle KeyErrors ab, wenn du auf Schicht-IDs oder Tage zugreifst (mit shift_idx.get(), day_idx.get())
5. Halte den Code so knapp wie möglich — maximal 20 Zeilen
6. Kommentiere den Code kurz auf Deutsch

Antworte NUR mit dem Python-Code, ohne Markdown-Fencing, ohne Erklärungen.`

  const userPrompt = `Regel: ${name}
Beschreibung: ${description}

Generiere den CP-SAT Python-Code für diese Planungsregel.`

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const code = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    if (!code) return NextResponse.json({ error: 'Keine Code-Antwort von KI' }, { status: 502 })

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
    return NextResponse.json({ error: 'KI-Fehler bei Code-Generierung' }, { status: 502 })
  }
}
