import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireRole, resolveLocationId } from '@/lib/session'
import { prisma } from '@/lib/prisma'

// §78 wizard AI assist: extract a STRUCTURED PROPOSAL from free text (or the
// stored onboarding answers). This endpoint writes NOTHING — the wizard shows
// every item with a checkbox and only human-confirmed items are applied via
// the normal CRUD endpoints.

export interface SetupProposal {
  arbeitstage?: string[]
  schichten: { name: string; von: string; bis: string; minStaff?: number }[]
  etagen: { name: string; minStaffFruehSpaet?: number }[]
  gruppen: { name: string; etage?: string; minStaffProTag?: number }[]
  basiswerte?: { maxWeeklyHours?: number; restHours?: number; maxConsecutiveDays?: number }
  regeln: string[]
}

const SYSTEM = `Du extrahierst Dienstplan-Konfiguration aus einer Betriebsbeschreibung.
Antworte NUR mit validem JSON nach diesem Schema:
{
  "arbeitstage": ["Mo","Di","Mi","Do","Fr"],
  "schichten": [{"name": "...", "von": "HH:MM", "bis": "HH:MM", "minStaff": 1}],
  "etagen": [{"name": "...", "minStaffFruehSpaet": 2}],
  "gruppen": [{"name": "...", "etage": "Name der Etage", "minStaffProTag": 2}],
  "basiswerte": {"maxWeeklyHours": 40, "restHours": 11, "maxConsecutiveDays": 5},
  "regeln": ["individuelle Regel als ein Satz", "..."]
}

EISERNE REGELN:
1. Übernimm AUSSCHLIESSLICH, was WÖRTLICH im Text steht. Erfinde nichts. Rate nichts.
2. Schichten nur mit im Text genannten Namen UND Uhrzeiten. Fehlt eines von beidem: Schicht weglassen.
3. Zahlen (minStaff, Besetzungen, Stunden) nur, wenn der Text sie nennt. Sonst Feld weglassen.
4. Etagen/Ebenen/Bereiche mit Gruppen: als "etagen" + "gruppen" mit Zuordnung. Keine Duplikate.
5. Jede individuelle Planungsregel (wer wann arbeitet, was besetzt sein muss, Ausnahmen) als eigener Satz in "regeln".
6. Leere Arrays sind völlig in Ordnung. Weniger ist besser als Erfundenes.`

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'okun'])
  if (session instanceof NextResponse) return session

  const locationId = await resolveLocationId(session)
  if (!locationId) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'KI nicht konfiguriert' }, { status: 503 })

  const body = await req.json().catch(() => ({})) as { text?: string }
  let text = body.text?.trim() ?? ''

  // No text supplied → use the stored onboarding answers
  if (!text) {
    const ob = await prisma.locationOnboarding.findUnique({ where: { locationId } })
    if (!ob) return NextResponse.json({ error: 'Kein Text und kein Onboarding vorhanden' }, { status: 400 })
    text = [
      ob.einrichtungsart, ob.organisationsstruktur, ob.personalstruktur,
      ob.arbeitszeiten, ob.dienstplanlogik, ob.pausenlogik,
      (ob.individuelleRegeln ?? []).map(r => `- ${r}`).join('\n'),
      ob.besonderheiten, ob.tagesablauf,
    ].filter(Boolean).join('\n\n')
  }
  if (!text.trim()) return NextResponse.json({ error: 'Keine auswertbaren Daten' }, { status: 400 })

  const client = new Anthropic({ apiKey })
  const request = (model: string) => client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: 'user', content: `Betriebsbeschreibung:\n\n${text.slice(0, 20000)}` }],
  })

  try {
    let message
    try {
      message = await request('claude-opus-4-7')
    } catch {
      message = await request('claude-sonnet-4-6')
    }
    const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const jsonMatch = raw.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Keine auswertbare KI-Antwort' }, { status: 502 })
    const parsed = JSON.parse(jsonMatch[0]) as Partial<SetupProposal>

    const isTime = (t: unknown): t is string => typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t)
    const proposal: SetupProposal = {
      arbeitstage: Array.isArray(parsed.arbeitstage)
        ? parsed.arbeitstage.filter((d): d is string => typeof d === 'string' && ['Mo','Di','Mi','Do','Fr','Sa','So'].includes(d))
        : undefined,
      schichten: (Array.isArray(parsed.schichten) ? parsed.schichten : [])
        .filter(s => s && typeof s.name === 'string' && s.name.trim() && isTime(s.von) && isTime(s.bis))
        .map(s => ({ name: s.name.trim(), von: s.von, bis: s.bis, minStaff: typeof s.minStaff === 'number' ? s.minStaff : undefined })),
      etagen: (Array.isArray(parsed.etagen) ? parsed.etagen : [])
        .filter(e => e && typeof e.name === 'string' && e.name.trim())
        .map(e => ({ name: e.name.trim(), minStaffFruehSpaet: typeof e.minStaffFruehSpaet === 'number' ? e.minStaffFruehSpaet : undefined })),
      gruppen: (Array.isArray(parsed.gruppen) ? parsed.gruppen : [])
        .filter(g => g && typeof g.name === 'string' && g.name.trim())
        .map(g => ({ name: g.name.trim(), etage: typeof g.etage === 'string' ? g.etage.trim() : undefined, minStaffProTag: typeof g.minStaffProTag === 'number' ? g.minStaffProTag : undefined })),
      basiswerte: parsed.basiswerte && typeof parsed.basiswerte === 'object' ? {
        maxWeeklyHours: typeof parsed.basiswerte.maxWeeklyHours === 'number' ? parsed.basiswerte.maxWeeklyHours : undefined,
        restHours: typeof parsed.basiswerte.restHours === 'number' ? parsed.basiswerte.restHours : undefined,
        maxConsecutiveDays: typeof parsed.basiswerte.maxConsecutiveDays === 'number' ? parsed.basiswerte.maxConsecutiveDays : undefined,
      } : undefined,
      regeln: (Array.isArray(parsed.regeln) ? parsed.regeln : [])
        .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
        .map(r => r.trim()),
    }

    return NextResponse.json({ proposal })
  } catch (err) {
    console.error('[setup-extract] failed:', err)
    return NextResponse.json({ error: 'KI-Analyse fehlgeschlagen' }, { status: 502 })
  }
}
