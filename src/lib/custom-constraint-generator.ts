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
- weeks: list[list[int]]  — Tages-Indizes nach Kalenderwoche gruppiert, z.B. [[0,1,2,3,4],[5,6,...]]. Für alle Regeln der Form "pro Woche höchstens X" IMMER über weeks iterieren (Datumsrechnung ist in der Sandbox nicht möglich).
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
8. Muster für "pro Woche höchstens N Dienste vom Typ X":
   typ_sis = [si for si, s in enumerate(shifts) if s.get("typ") == "frueh"]
   for ei in range(n_emp):
       for week_days in weeks:
           model.add(sum(X[ei, di, si] for di in week_days for si in typ_sis) <= 1)
9. Muster für "Person X wird keiner Gruppe zugeteilt" (z.B. Leitung, Verwaltung,
   Hauswirtschaft — sie zählen nicht zur Gruppenbesetzung):
   for ei, emp in enumerate(employees):
       if "franka" in emp.get("name", "").lower():
           for di in range(n_days):
               for gi in range(n_groups):
                   model.add(G[ei, di, gi] == 0)
10. Muster für "Person X arbeitet ausschließlich Dienst Y" (alle anderen Dienste
   werden ausgeschlossen; der eigene Dienst wird dadurch NICHT erzwungen):
   ziel_sis = [si for si, s in enumerate(shifts) if "leitung" in s.get("name", "").lower()]
   for ei, emp in enumerate(employees):
       if "franka" in emp.get("name", "").lower():
           for di in range(n_days):
               for si in range(n_shifts):
                   if si not in ziel_sis:
                       model.add(X[ei, di, si] == 0)

Wenn die Regel KEINE planbare Dienstplan-Beschränkung ist (z.B. eine organisatorische Notiz, Pausenregelung, Zuständigkeit ohne Planungsbezug oder etwas, das das System bereits über Standardfelder abdeckt wie Wochenstunden oder feste freie Tage), antworte EXAKT mit dem Wort SKIP.

Antworte NUR mit dem Python-Code (oder SKIP), ohne Markdown-Fencing, ohne Erklärungen.`

export async function generateConstraintCode(
  name: string,
  description: string,
  /** §98: Rückmeldung aus einem gescheiterten Prüflauf — der zweite Versuch kennt den Fehler. */
  korrekturHinweis?: string,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY nicht konfiguriert')
  const client = new Anthropic({ apiKey })

  const auftrag = korrekturHinweis
    ? `Regel: ${name}\nBeschreibung: ${description}\n\n` +
      `Dein vorheriger Code wurde ausgeführt und ist FEHLGESCHLAGEN:\n${korrekturHinweis}\n\n` +
      'Schreibe den Code neu, sodass dieser Fehler nicht mehr auftritt. Nur der Code, kein SKIP.'
    : `Regel: ${name}\nBeschreibung: ${description}\n\nGeneriere den CP-SAT Python-Code für diese Planungsregel (oder SKIP).`

  // §98: max_tokens war 1024 — zusammen mit dem adaptiven Denken reichte das
  // nicht, der Code brach mitten in der Klammer ab ("'(' was never closed").
  // Der Prüflauf fängt das jetzt zwar ab, aber es darf gar nicht erst passieren.
  const request = (model: string) => client.messages.create({
    model,
    max_tokens: 8192,
    thinking: { type: 'adaptive' },
    system: CONSTRAINT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: auftrag }],
  })

  // Fallback: not every API key has access to the newest model tier
  let message
  try {
    message = await request('claude-opus-5')
  } catch (err) {
    console.warn('[custom-constraint-generator] claude-opus-5 failed, falling back:', err instanceof Error ? err.message : err)
    message = await request('claude-opus-4-7')
  }

  const code = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  if (!code || code === 'SKIP' || code.startsWith('SKIP')) return null
  return code
}

// §98: Regel-Code vom Rechendienst probeweise ausführen lassen.
// Ohne diesen Schritt konnten Regeln gespeichert und aktiviert werden, die beim
// echten Plan mit SyntaxError oder NameError abbrachen — sie standen auf "aktiv"
// und bewirkten nichts.
export interface ValidationResult {
  ok: boolean
  art?: string
  fehler?: string
  hinweis?: string
  warnung?: string
}

export async function validateConstraintCode(code: string): Promise<ValidationResult> {
  const url = process.env.SOLVER_SERVICE_URL
  if (!url) {
    // Ohne Rechendienst kann nicht ausgeführt werden — wenigstens die Syntax
    // grob prüfen, statt blind zu speichern.
    const offen = (code.match(/\(/g) ?? []).length - (code.match(/\)/g) ?? []).length
    if (offen !== 0) {
      return { ok: false, art: 'syntax', fehler: 'Klammern unausgeglichen — der Code ist unvollständig.' }
    }
    return { ok: true, art: 'ungeprueft', warnung: 'Rechendienst nicht erreichbar — die Regel wurde nicht ausgeführt.' }
  }
  try {
    const r = await fetch(`${url}/validate-constraint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(20_000),
    })
    if (r.status === 404) {
      return { ok: true, art: 'ungeprueft', warnung: 'Der Rechendienst ist veraltet und kann Regeln nicht prüfen. Bitte den Service "solver" in Railway neu ausrollen.' }
    }
    if (!r.ok) return { ok: true, art: 'ungeprueft', warnung: `Prüflauf nicht möglich (HTTP ${r.status}).` }
    return await r.json() as ValidationResult
  } catch (err) {
    return { ok: true, art: 'ungeprueft', warnung: `Prüflauf nicht möglich (${err instanceof Error ? err.message : 'Fehler'}).` }
  }
}

/**
 * §98: Erzeugen UND prüfen. Scheitert der Prüflauf, bekommt das Modell die
 * echte Fehlermeldung zurück und versucht es genau einmal erneut. Erst danach
 * gilt eine Regel als fehlgeschlagen — dann aber mit klarem Grund.
 */
export async function generateVerifiedConstraintCode(
  name: string,
  description: string,
): Promise<{ code: string | null; validation: ValidationResult; versuche: number }> {
  let code = await generateConstraintCode(name, description)
  if (!code) return { code: null, validation: { ok: true, art: 'skip' }, versuche: 1 }

  let validation = await validateConstraintCode(code)
  if (validation.ok) return { code, validation, versuche: 1 }

  const hinweis = [validation.fehler, validation.hinweis].filter(Boolean).join('\n')
  const zweiter = await generateConstraintCode(name, description, hinweis)
  if (!zweiter) return { code, validation, versuche: 2 }

  const validation2 = await validateConstraintCode(zweiter)
  if (validation2.ok) return { code: zweiter, validation: validation2, versuche: 2 }
  return { code: zweiter, validation: validation2, versuche: 2 }
}

// §74: batch — turn onboarding rules into CustomConstraints. For visibility
// the rows are created IMMEDIATELY with status 'generating' (the admin sees
// them appear in the UI right away), then each row is updated to 'pending'
// (with code), deleted (SKIP: not a planning constraint) or 'error' (with
// the message). Dedup by description so regeneration never duplicates.
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

  // Phase 1: create visible placeholders for all new rules
  const placeholders: { id: string; desc: string }[] = []
  for (const rule of rules) {
    const desc = rule.trim()
    if (!desc || known.has(desc.toLowerCase())) continue
    known.add(desc.toLowerCase())
    const row = await prisma.customConstraint.create({
      data: {
        locationId,
        customerId,
        name: desc.length > 60 ? `${desc.slice(0, 57)}…` : desc,
        description: desc,
        code: '',
        status: 'generating',
      },
    }).catch(() => null)
    if (row) placeholders.push({ id: row.id, desc })
  }

  // Phase 2: generate code per rule and resolve each placeholder
  for (const { id, desc } of placeholders) {
    try {
      const code = await generateConstraintCode(desc.slice(0, 80), desc)
      if (!code) {
        // Not a planning constraint — remove the placeholder again
        await prisma.customConstraint.delete({ where: { id } }).catch(() => {})
        result.skipped++
        continue
      }
      await prisma.customConstraint.update({
        where: { id },
        data: { code, status: 'pending' },
      })
      result.created++
    } catch (err) {
      console.error('[custom-constraint-generator] rule failed:', desc, err)
      await prisma.customConstraint.update({
        where: { id },
        data: { status: 'error', errorLog: (err instanceof Error ? err.message : String(err)).slice(0, 500) },
      }).catch(() => {})
      result.failed++
    }
  }
  return result
}
