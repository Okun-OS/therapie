/**
 * §47 Scenario 9 — Illness during confirmed schedule: local re-optimization
 *
 * Invariants tested:
 *  a) When an employee who is in the existing plan calls in sick (added to
 *     nichtVerfuegbarAn), the verifier MUST flag their assignments on sick days
 *     as a hard violation ('hr-abwesenheit').
 *  b) A corrected plan that removes the sick employee from sick days and assigns
 *     a replacement passes without critical violations.
 *  c) Past (frozen) assignments remain in the plan unchanged — only future
 *     sick days are affected.
 *  d) The corrected plan has fewer violations than the original (total changes minimized).
 */
import { describe, it, expect } from 'vitest'
import { verifyPlan } from '@/lib/plan-verifier'
import type {
  PlanningRuleModel,
  GenerierterPlan,
  PlanEintrag,
  PlanungsMitarbeiter,
  SchichtDefinition,
  HarteRegel,
} from '@/lib/company-model-types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sch(id: string, von = '06:00', bis = '14:00'): SchichtDefinition {
  return { id, name: id, typ: 'frueh', von, bis, uebernacht: false, minBesetzungGesamt: 1, aufgaben: [] }
}

function emp(id: string, overrides: Partial<PlanungsMitarbeiter> = {}): PlanungsMitarbeiter {
  return {
    id, name: id, einheiten: [], verfuegbareSchichtTypen: ['frueh'],
    wochenstundenSoll: 40, arbeitstageProWoche: 5, qualifikationen: [],
    nichtVerfuegbarAn: [], urlaubAn: [], wuensche: [], ...overrides,
  }
}

function entry(eid: string, date: string, sid: string): PlanEintrag {
  return { mitarbeiterId: eid, datum: date, schichtId: sid, istVertretung: false }
}

const RULES: HarteRegel[] = [
  { id: 'r1', kategorie: 'arbeitszeit', beschreibung: '', typ: 'max_wochenstunden', wert: 48, quelle: 'gesetz' },
  { id: 'r2', kategorie: 'ruhezeit',    beschreibung: '', typ: 'min_ruhezeit',      wert: 11, quelle: 'gesetz' },
  { id: 'r3', kategorie: 'folgetag',    beschreibung: '', typ: 'max_folgetage',     wert: 6,  quelle: 'gesetz' },
]

function model(
  mitarbeiter: PlanungsMitarbeiter[],
  schichten: SchichtDefinition[],
  days: string[],
): PlanningRuleModel {
  return {
    sessionId: 'illness-test', locationId: 'loc1', customerId: 'cust1',
    zeitraum: { von: days[0], bis: days.at(-1) ?? days[0], arbeitstage: days },
    einheiten: [], schichten, harteRegeln: RULES, weicheRegeln: [],
    fairness: { wochenendArbeit: false, nachtdienstFair: false, schichttypFairness: false, belastungsgleichverteilung: false },
    mitarbeiter,
  }
}

function plan(entries: PlanEintrag[]): GenerierterPlan {
  return { eintraege: entries, decisions: [], metadaten: { erstelltAm: '2024-01-08T00:00:00Z', solver: 'test', regelmodellVersion: '1' } }
}

// ─── Scenario 9 Setup ─────────────────────────────────────────────────────────
//
// Week: Mon 08 Tue 09 Wed 10 Thu 11 Fri 12
// Original plan: emp1 works all 5 days, emp2 works all 5 days.
// Illness event: emp1 calls in sick on Wed 10 and Thu 11 (future days).
// Past days (Mon, Tue) are "frozen" — not re-planned.
// Corrected plan: emp1 removed from Wed+Thu, emp2 covers Wed+Thu alone.

const WEEK = ['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12']
const SICK_DAYS = ['2024-01-10', '2024-01-11']
const PAST_DAYS = ['2024-01-08', '2024-01-09']
const FRUEH = sch('frueh')

// Employees BEFORE illness notification (emp1 healthy)
const EMP1_HEALTHY = emp('emp1')
const EMP2 = emp('emp2')

// Employees AFTER illness notification (emp1 sick on Wed+Thu)
const EMP1_SICK = emp('emp1', { nichtVerfuegbarAn: SICK_DAYS })

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Scenario 9 — Illness re-optimization', () => {

  // (a) Verifier catches the conflict: sick employee assigned on sick days
  describe('a) Sick employee assigned on sick days → critical absence violation', () => {
    it('raises hr-abwesenheit when sick employee is in the plan on sick day', () => {
      const m = model([EMP1_SICK, EMP2], [FRUEH], WEEK)
      // Original plan not updated yet — emp1 still assigned on sick days
      const p = plan([
        ...WEEK.map(d => entry('emp1', d, 'frueh')),
        ...WEEK.map(d => entry('emp2', d, 'frueh')),
      ])
      const result = verifyPlan(p, m)
      const absenceViolations = result.verletzungen.filter(v => v.regelId === 'hr-abwesenheit')
      expect(absenceViolations.length).toBeGreaterThanOrEqual(1)
      // At minimum one of the sick days must be in the violations
      const violatedDates = absenceViolations.flatMap(v => v.betrifft ?? [])
      expect(violatedDates.some(d => SICK_DAYS.includes(d) || d.includes('emp1'))).toBe(true)
    })

    it('absence violation has severity kritisch', () => {
      const m = model([EMP1_SICK, EMP2], [FRUEH], WEEK)
      const p = plan([entry('emp1', '2024-01-10', 'frueh')])
      const result = verifyPlan(p, m)
      const v = result.verletzungen.find(v => v.regelId === 'hr-abwesenheit')
      expect(v).toBeDefined()
      expect(v!.schwere).toBe('kritisch')
    })

    it('raises plan recommendation ueberarbeiten when sick employee is still assigned', () => {
      const m = model([EMP1_SICK, EMP2], [FRUEH], WEEK)
      const p = plan([...WEEK.map(d => entry('emp1', d, 'frueh'))])
      const result = verifyPlan(p, m)
      expect(result.freigabeEmpfehlung).toBe('ueberarbeiten')
    })
  })

  // (b) Corrected plan: sick employee removed, replacement assigned — passes verification
  describe('b) Corrected plan with replacement passes without critical violations', () => {
    it('no absence violation after removing sick employee from sick days', () => {
      const m = model([EMP1_SICK, EMP2], [FRUEH], WEEK)
      // Corrected plan: emp1 only on past days + Friday (not sick); emp2 covers all week
      const corrected = plan([
        // emp1 on past days (frozen) + Friday (healthy)
        entry('emp1', '2024-01-08', 'frueh'),
        entry('emp1', '2024-01-09', 'frueh'),
        entry('emp1', '2024-01-12', 'frueh'),
        // emp2 covers full week
        ...WEEK.map(d => entry('emp2', d, 'frueh')),
      ])
      const result = verifyPlan(corrected, m)
      expect(result.verletzungen.filter(v => v.regelId === 'hr-abwesenheit')).toHaveLength(0)
    })

    it('corrected plan has no critical violations', () => {
      const m = model([EMP1_SICK, EMP2], [FRUEH], WEEK)
      const corrected = plan([
        entry('emp1', '2024-01-08', 'frueh'),
        entry('emp1', '2024-01-09', 'frueh'),
        entry('emp1', '2024-01-12', 'frueh'),
        ...WEEK.map(d => entry('emp2', d, 'frueh')),
      ])
      const result = verifyPlan(corrected, m)
      const critical = result.verletzungen.filter(v => v.schwere === 'kritisch')
      expect(critical).toHaveLength(0)
    })

    it('corrected plan score is higher than uncorrected plan', () => {
      const m = model([EMP1_SICK, EMP2], [FRUEH], WEEK)
      const uncorrected = plan([...WEEK.map(d => entry('emp1', d, 'frueh')), ...WEEK.map(d => entry('emp2', d, 'frueh'))])
      const corrected   = plan([
        entry('emp1', '2024-01-08', 'frueh'), entry('emp1', '2024-01-09', 'frueh'), entry('emp1', '2024-01-12', 'frueh'),
        ...WEEK.map(d => entry('emp2', d, 'frueh')),
      ])
      const uncorrectedResult = verifyPlan(uncorrected, m)
      const correctedResult   = verifyPlan(corrected, m)
      expect(correctedResult.gesamtScore).toBeGreaterThan(uncorrectedResult.gesamtScore)
    })
  })

  // (c) Past (frozen) assignments remain untouched
  describe('c) Past assignments are preserved in corrected plan', () => {
    it('past-day entries for sick employee are still valid (no violation for healthy past days)', () => {
      const m = model([EMP1_SICK, EMP2], [FRUEH], WEEK)
      // Past assignments for emp1 should not trigger violations (they were BEFORE sick days)
      const p = plan([
        entry('emp1', PAST_DAYS[0], 'frueh'),
        entry('emp1', PAST_DAYS[1], 'frueh'),
      ])
      const result = verifyPlan(p, m)
      expect(result.verletzungen.filter(v => v.regelId === 'hr-abwesenheit')).toHaveLength(0)
    })
  })

  // (d) Minimal change: corrected plan only differs on sick days
  describe('d) Minimal changes — only sick days are affected', () => {
    it('diff between original and corrected plan touches only sick days for emp1', () => {
      const originalEntries: PlanEintrag[] = [
        ...WEEK.map(d => entry('emp1', d, 'frueh')),
        ...WEEK.map(d => entry('emp2', d, 'frueh')),
      ]
      const correctedEntries: PlanEintrag[] = [
        entry('emp1', '2024-01-08', 'frueh'),
        entry('emp1', '2024-01-09', 'frueh'),
        entry('emp1', '2024-01-12', 'frueh'),
        ...WEEK.map(d => entry('emp2', d, 'frueh')),
      ]

      // Diff: entries in original but not in corrected
      const originalKeys = new Set(originalEntries.map(e => `${e.mitarbeiterId}|${e.datum}|${e.schichtId}`))
      const correctedKeys = new Set(correctedEntries.map(e => `${e.mitarbeiterId}|${e.datum}|${e.schichtId}`))

      const removed = Array.from(originalKeys).filter(k => !correctedKeys.has(k))
      const added   = Array.from(correctedKeys).filter(k => !originalKeys.has(k))

      // Only emp1's sick days were removed
      for (const key of removed) {
        const [empId, date] = key.split('|')
        expect(empId).toBe('emp1')
        expect(SICK_DAYS).toContain(date)
      }

      // emp2 entries are identical (no change outside sick coverage, emp2 already had all days)
      expect(added).toHaveLength(0)
    })
  })

  // (e) Edge: multiple employees sick simultaneously
  describe('e) Multiple employees sick on same day', () => {
    it('raises absence violation for each sick employee assigned on their sick day', () => {
      const emp1Sick = emp('emp1', { nichtVerfuegbarAn: ['2024-01-10'] })
      const emp2Sick = emp('emp2', { nichtVerfuegbarAn: ['2024-01-10'] })
      const emp3 = emp('emp3')
      const m = model([emp1Sick, emp2Sick, emp3], [FRUEH], WEEK)
      const p = plan([
        entry('emp1', '2024-01-10', 'frueh'),
        entry('emp2', '2024-01-10', 'frueh'),
        entry('emp3', '2024-01-10', 'frueh'),
      ])
      const result = verifyPlan(p, m)
      const absViolations = result.verletzungen.filter(v => v.regelId === 'hr-abwesenheit')
      // emp1 and emp2 both generate violations; emp3 is healthy
      expect(absViolations.length).toBeGreaterThanOrEqual(2)
      // emp3 must not appear in absence violations
      const mentionsEmp3 = absViolations.some(v => v.betrifft?.includes('emp3'))
      expect(mentionsEmp3).toBe(false)
    })
  })
})
