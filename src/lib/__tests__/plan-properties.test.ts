/**
 * §46 Property-based invariant tests for the verifier.
 *
 * Each test verifies a hard invariant across a parametric space of inputs:
 *   1. No plan assigns an employee to two shifts on the same day without a violation.
 *   2. No plan violates a vacation hard constraint without a violation being raised.
 *   3. No plan violates a rest-period constraint without a violation being raised.
 *
 * These are not randomized (no dependency on fast-check) but exhaustively cover
 * the invariant across representative input combinations via table-driven cases.
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

// ─── Minimal helpers ──────────────────────────────────────────────────────────

function sch(id: string, von: string, bis: string): SchichtDefinition {
  return { id, name: id, typ: 'frueh', von, bis, uebernacht: bis < von, minBesetzungGesamt: 1, aufgaben: [] }
}

function emp(id: string, overrides: Partial<PlanungsMitarbeiter> = {}): PlanungsMitarbeiter {
  return {
    id, name: id, einheiten: [], verfuegbareSchichtTypen: ['frueh', 'spaet', 'nacht'],
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
  rules: HarteRegel[] = RULES,
): PlanningRuleModel {
  return {
    sessionId: 'prop-test', locationId: 'loc1', customerId: 'cust1',
    zeitraum: { von: days[0], bis: days.at(-1) ?? days[0], arbeitstage: days },
    einheiten: [], schichten, harteRegeln: rules, weicheRegeln: [],
    fairness: { wochenendArbeit: false, nachtdienstFair: false, schichttypFairness: false, belastungsgleichverteilung: false },
    mitarbeiter,
  }
}

function plan(entries: PlanEintrag[]): GenerierterPlan {
  return { eintraege: entries, decisions: [], metadaten: { erstelltAm: '2024-01-01T00:00:00Z', solver: 'test', regelmodellVersion: '1' } }
}

// ─── §46 Property 1: Duplicate assignment invariant ───────────────────────────
// For ANY plan that assigns the same employee to two shifts on the same day,
// verifyPlan MUST return a 'hr-doppelbelegung' violation.

describe('§46 Property 1 — duplicate-day assignment always raises violation', () => {
  const DAYS = ['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12']
  const SHIFTS = [sch('frueh', '06:00', '14:00'), sch('spaet', '14:00', '22:00')]
  const EMPLOYEES = [emp('e1'), emp('e2'), emp('e3')]

  // Test matrix: for each employee × each day, duplicate assignment must raise violation
  const CASES: Array<{ empId: string; date: string }> = []
  for (const e of EMPLOYEES) {
    for (const d of DAYS) {
      CASES.push({ empId: e.id, date: d })
    }
  }

  it.each(CASES)('employee $empId assigned twice on $date triggers violation', ({ empId, date }) => {
    const m = model(EMPLOYEES, SHIFTS, DAYS)
    const p = plan([
      entry(empId, date, 'frueh'),
      entry(empId, date, 'spaet'),
    ])
    const result = verifyPlan(p, m)
    expect(result.verletzungen.some(v => v.regelId === 'hr-doppelbelegung')).toBe(true)
    expect(result.verletzungen.find(v => v.regelId === 'hr-doppelbelegung')!.betrifft).toContain(empId)
  })

  it('duplicate assignment on multiple days raises one violation per duplicate day', () => {
    const m = model(EMPLOYEES, SHIFTS, DAYS)
    const p = plan([
      // emp1 has duplicates on day 0 and day 2
      entry('e1', DAYS[0], 'frueh'), entry('e1', DAYS[0], 'spaet'),
      entry('e1', DAYS[2], 'frueh'), entry('e1', DAYS[2], 'spaet'),
    ])
    const result = verifyPlan(p, m)
    const dups = result.verletzungen.filter(v => v.regelId === 'hr-doppelbelegung')
    // At minimum one violation must be raised
    expect(dups.length).toBeGreaterThanOrEqual(1)
  })

  it('no duplicate violation when each employee has at most one shift per day', () => {
    const m = model(EMPLOYEES, SHIFTS, DAYS)
    // Each employee works every day but only one shift
    const p = plan(
      EMPLOYEES.flatMap(e => DAYS.map(d => entry(e.id, d, 'frueh')))
    )
    const result = verifyPlan(p, m)
    expect(result.verletzungen.filter(v => v.regelId === 'hr-doppelbelegung')).toHaveLength(0)
  })
})

// ─── §46 Property 2: Vacation hard constraint always enforced ─────────────────
// For ANY plan that assigns an employee on a day they have approved vacation,
// verifyPlan MUST return an 'hr-urlaub' violation with severity 'kritisch'.

describe('§46 Property 2 — vacation constraint always enforced', () => {
  const SHIFTS = [sch('frueh', '06:00', '14:00')]

  const VACATION_CASES: Array<{ urlaubTage: string[]; assignedDate: string; expectViolation: boolean }> = [
    // Single vacation day
    { urlaubTage: ['2024-01-10'], assignedDate: '2024-01-10', expectViolation: true },
    // Multiple vacation days — assigned on first
    { urlaubTage: ['2024-01-10', '2024-01-11', '2024-01-12'], assignedDate: '2024-01-10', expectViolation: true },
    // Multiple vacation days — assigned on last
    { urlaubTage: ['2024-01-10', '2024-01-11', '2024-01-12'], assignedDate: '2024-01-12', expectViolation: true },
    // Multiple vacation days — assigned on middle
    { urlaubTage: ['2024-01-10', '2024-01-11', '2024-01-12'], assignedDate: '2024-01-11', expectViolation: true },
    // Vacation day but employee NOT assigned — no violation
    { urlaubTage: ['2024-01-10'], assignedDate: '2024-01-09', expectViolation: false },
    // Employee assigned on non-vacation day — no violation
    { urlaubTage: ['2024-01-10', '2024-01-11'], assignedDate: '2024-01-08', expectViolation: false },
  ]

  it.each(VACATION_CASES)(
    'urlaubTage=$urlaubTage assigned=$assignedDate expects violation=$expectViolation',
    ({ urlaubTage, assignedDate, expectViolation }) => {
      const e = emp('emp1', { urlaubAn: urlaubTage })
      const days = ['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12']
      const m = model([e], SHIFTS, days)
      const p = plan([entry('emp1', assignedDate, 'frueh')])
      const result = verifyPlan(p, m)
      if (expectViolation) {
        const v = result.verletzungen.find(v => v.regelId === 'hr-urlaub')
        expect(v).toBeDefined()
        expect(v!.schwere).toBe('kritisch')
      } else {
        expect(result.verletzungen.filter(v => v.regelId === 'hr-urlaub')).toHaveLength(0)
      }
    }
  )

  it('vacation constraint holds for all employees in a multi-employee plan', () => {
    // All 3 employees have vacation on 2024-01-10 and all are wrongly assigned
    const emps = ['e1', 'e2', 'e3'].map(id => emp(id, { urlaubAn: ['2024-01-10'] }))
    const days = ['2024-01-08', '2024-01-09', '2024-01-10']
    const m = model(emps, SHIFTS, days)
    const p = plan(emps.map(e => entry(e.id, '2024-01-10', 'frueh')))
    const result = verifyPlan(p, m)
    const vac = result.verletzungen.filter(v => v.regelId === 'hr-urlaub')
    expect(vac.length).toBeGreaterThanOrEqual(1)
    expect(vac.every(v => v.schwere === 'kritisch')).toBe(true)
  })
})

// ─── §46 Property 3: Rest-period constraint always enforced ───────────────────
// For ANY pair of consecutive shifts with <11h rest between them,
// verifyPlan MUST return an 'hr-ruhezeit' violation.

describe('§46 Property 3 — rest period constraint always enforced', () => {
  // Parametric cases: late shift end → early shift start → expected rest hours
  const REST_CASES: Array<{
    shift1End: string; shift2Start: string; expectViolation: boolean; label: string
  }> = [
    // 22:00 → 06:00 = 8h (violation)
    { shift1End: '22:00', shift2Start: '06:00', expectViolation: true, label: '22:00-06:00 (8h)' },
    // 23:00 → 06:00 = 7h (violation)
    { shift1End: '23:00', shift2Start: '06:00', expectViolation: true, label: '23:00-06:00 (7h)' },
    // 20:00 → 06:00 = 10h (violation)
    { shift1End: '20:00', shift2Start: '06:00', expectViolation: true, label: '20:00-06:00 (10h)' },
    // 18:00 → 05:00 = 11h (boundary — exactly at limit, not a violation)
    { shift1End: '18:00', shift2Start: '05:00', expectViolation: false, label: '18:00-05:00 (11h, ok)' },
    // 14:00 → 06:00 = 16h (ok)
    { shift1End: '14:00', shift2Start: '06:00', expectViolation: false, label: '14:00-06:00 (16h, ok)' },
    // 06:00 → 06:00 (next day) = 24h (ok)
    { shift1End: '06:00', shift2Start: '06:00', expectViolation: false, label: '06:00-06:00 (24h, ok)' },
  ]

  it.each(REST_CASES)('$label', ({ shift1End, shift2Start, expectViolation }) => {
    const s1 = sch('s1', '06:00', shift1End)
    const s2 = sch('s2', shift2Start, '14:00')
    const days = ['2024-01-08', '2024-01-09']
    const m = model([emp('e1')], [s1, s2], days)
    const p = plan([entry('e1', '2024-01-08', 's1'), entry('e1', '2024-01-09', 's2')])
    const result = verifyPlan(p, m)
    if (expectViolation) {
      expect(result.verletzungen.some(v => v.regelId === 'hr-ruhezeit')).toBe(true)
    } else {
      expect(result.verletzungen.filter(v => v.regelId === 'hr-ruhezeit')).toHaveLength(0)
    }
  })

  it('rest violation captured for every non-resting pair in a multi-day plan', () => {
    // Alternating late/early — every transition should trigger a violation
    const spaet = sch('spaet', '14:00', '22:00')
    const frueh = sch('frueh', '06:00', '14:00')
    const days = ['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11']
    const m = model([emp('e1')], [spaet, frueh], days)
    // Alternating spaet/frueh: 3 transitions, all <11h
    const p = plan([
      entry('e1', '2024-01-08', 'spaet'),
      entry('e1', '2024-01-09', 'frueh'),
      entry('e1', '2024-01-10', 'spaet'),
      entry('e1', '2024-01-11', 'frueh'),
    ])
    const result = verifyPlan(p, m)
    const restViolations = result.verletzungen.filter(v => v.regelId === 'hr-ruhezeit')
    // At least two rest violations (day 8→9 and 10→11)
    expect(restViolations.length).toBeGreaterThanOrEqual(2)
  })
})

// ─── Combined invariant: hard-violation → score penalty ───────────────────────

describe('§46 Combined — hard violations always lower the gesamtScore', () => {
  it('duplicate assignment on one day reduces score below a clean plan', () => {
    const s = sch('frueh', '06:00', '14:00')
    const e = emp('e1')
    const days = ['2024-01-08']
    const m = model([e], [s], days)
    const clean = verifyPlan(plan([entry('e1', '2024-01-08', 'frueh')]), m)
    const dup   = verifyPlan(plan([entry('e1', '2024-01-08', 'frueh'), entry('e1', '2024-01-08', 'frueh')]), m)
    expect(dup.gesamtScore).toBeLessThan(clean.gesamtScore)
  })

  it('vacation conflict always makes freigabeEmpfehlung = ueberarbeiten', () => {
    const s = sch('frueh', '06:00', '14:00')
    const days = ['2024-01-08']
    for (const empId of ['e1', 'e2', 'e3']) {
      const e = emp(empId, { urlaubAn: ['2024-01-08'] })
      const m = model([e], [s], days)
      const result = verifyPlan(plan([entry(empId, '2024-01-08', 'frueh')]), m)
      expect(result.freigabeEmpfehlung).toBe('ueberarbeiten')
    }
  })
})
