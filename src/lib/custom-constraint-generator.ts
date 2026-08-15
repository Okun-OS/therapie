import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

// §70/§74: natural-language planning rule → CP-SAT Python constraint code.
// Shared by the admin generator UI and the onboarding batch pipeline.

export const CONSTRAINT_SYSTEM_PROMPT = `Du bist ein Experte für OR-Tools CP-SAT Constraint Programming in Python.
Deine Aufgabe ist es, Python-Code zu generieren, der als Zusatzbeschränkung in ein CP-SAT Dienstplan-Modell eingefügt wird.

Verfügbare Variablen im Ausführungskontext:
- model: cp_model.CpModel  — das CP-SAT Modell
- X: dict[(ei, di, si), BoolVar]  — Zuweisung: Mitarbeiter ei an Tag di in Schicht si
- employees: list[dict]  — Liste der Mitarbeiter; jeder hat: id, name, einheiten, stammEinheitId, wochenstundenSoll, qualifikationen, verfuegbareSchichtTypen
- shifts: list[dict]  — Liste der Schichten; jede hat: id, name, typ, von, bis, minBesetzungGesamt
- days: list[str]  — Planungstage als "YYYY-MM-DD"
- weekdays: list[int]  — Wochentag je Planungstag (0=Montag … 6=Sonntag), parallel zu days
- day_idx: dict[str, int]  — Tag-String → Index in days
- shift_idx: dict[str, int]  — Schicht-ID → Index in shifts
- n_emp, n_days, n_shifts: int  — Dimensionen
- gruppen: list[dict]  — Planungseinheiten vom Typ "gruppe" (leer, wenn keine Gruppenplanung aktiv); jede hat: id, name, mindestbesetzung, etageId
- G: dict[(ei, di, gi), BoolVar]  — Gruppenzuweisung: Mitarbeiter ei steht an Tag di in Gruppe gi (nur wenn gruppen nicht leer)
- n_groups: int  — Anzahl Gruppen

Wichtige Regeln für den generierten Code:
1. Füge KEINE Importe hinzu und definiere KEINE Funktionen — nur direkte Statements
2. Verwende ausschließlich model.add(...) für Constraints; model.minimize ist nicht erlaubt
3. Greife auf employees[ei] und shifts[si] per Index zu; nutze .get() mit Fallback bei dict-Feldern
4. Mitarbeiter anhand des Namens finden: Teilstring-Vergleich in Kleinbuchstaben (z.B. "franka" in emp.get("name", "").lower()), da Vor- und Nachnamen variieren
5. Fange potenzielle KeyErrors ab, wenn du auf Schicht-IDs oder Tage zugreifst (mit shift_idx.get(), day_idx.get())
6. Halte den Code so knapp wie möglich — maximal 20 Zeilen
7. Kommentiere den Code kurz auf Deutsch

Wenn die Regel KEINE planbare Dienstplan-Beschränkung ist (z.B. eine organisatorische Notiz, Pausenregelung, Zuständigkeit ohne Planungsbezug oder etwas, das das System bereits über Standardfelder abdeckt wie Wochenstunden oder feste freie Tage), antworte EXAKT mit dem Wort SKIP.

Antworte NUR mit dem Python-Code (oder SKIP), ohne Markdown-Fencing, ohne Erklärungen.`

export async function generateConstraintCode(name: string, description: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY nicht konfiguriert')
  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    system: CONSTRAINT_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Regel: ${name}\nBeschreibung: ${description}\n\nGeneriere den CP-SAT Python-Code für diese Planungsregel (oder SKIP).`,
    }],
  })

  const code = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  if (!code || code === 'SKIP' || code.startsWith('SKIP')) return null
  return code
}

// §74: batch — turn the onboarding "individuelle Regeln" into pending
// CustomConstraints (admin reviews & activates on /admin/model).
// Dedup by description so regeneration never duplicates.
export async function generateConstraintsFromRules(
  locationId: string,
  customerId: string,
  rules: string[],
): Promise<{ created: number; skipped: number; failed: number }> {
  const result = { created: 0, skipped: 0, failed: 0 }
  if (!rules || rules.length === 0) return result

  const existing = await prisma.customConstraint.findMany({
    where: { locationId },
    select: { description: true },
  })
  const known = new Set(existing.map(c => c.description.trim().toLowerCase()))

  for (const rule of rules) {
    const desc = rule.trim()
    if (!desc || known.has(desc.toLowerCase())) continue
    try {
      const code = await generateConstraintCode(desc.slice(0, 80), desc)
      if (!code) {
        result.skipped++
        continue
      }
      await prisma.customConstraint.create({
        data: {
          locationId,
          customerId,
          name: desc.length > 60 ? `${desc.slice(0, 57)}…` : desc,
          description: desc,
          code,
          status: 'pending',
        },
      })
      known.add(desc.toLowerCase())
      result.created++
    } catch (err) {
      console.error('[custom-constraint-generator] rule failed:', desc, err)
      result.failed++
    }
  }
  return result
}
