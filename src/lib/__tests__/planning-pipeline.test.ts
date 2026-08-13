/**
 * Integration tests for the planning pipeline verifier layer.
 * These test buildRuleModel → verifyPlan scenarios using the deterministic
 * verifier directly (no CP-SAT solver call needed).
 *
 * Covers Spec §47 scenarios 2, 3, 5, 7, 8 (solver-independent).
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

// ─── Shared helpers ───────────────────────────────────────────────────────────

function mkSchicht(
  id: string,
  von = '06:00',
  bis = '14:00',
  opts: { minBesetzung?: number; requiredQuals?: string[]; typ?: SchichtDefinition['typ'] } = {},
): SchichtDefinition {
  return {
    id, name: id,
    typ: opts.typ ?? 'frueh',
    von, bis, uebernacht: bis < von,
    minBesetzungGesamt: opts.minBesetzung ?? 1,
    aufgaben: [],
    erforderlicheQualifikationen: opts.requiredQuals ?? [],
  }
}

function mkEmp(id: string, overrides: Partial<PlanungsMitarbeiter> = {}): PlanungsMitarbeiter {
  return {
    id, name: id,
    einheiten: [],
    verfuegbareSchichtTypen: ['frueh', 'spaet', 'nacht', 'mittel'],
    wochenstundenSoll: 40,
    arbeitstageProWoche: 5,
    qualifikationen: [],
    nichtVerfuegbarAn: [],
    urlaubAn: [],
    wuensche: [],
    ...overrides,
  }
}

function mkEntry(mitarbeiterId: string, datum: string, schichtId: string): PlanEintrag {
  return { mitarbeiterId, datum, schichtId, istVertretung: false }
}

const LEGAL_RULES: HarteRegel[] = [
  { id: 'r1', kategorie: 'arbeitszeit', beschreibung: '', typ: 'max_wochenstunden', wert: 40, quelle: 'gesetz' },
  { id: 'r2', kategorie: 'ruhezeit',    beschreibung: '', typ: 'min_ruhezeit',      wert: 11, quelle: 'gesetz' },
  { id: 'r3', kategorie: 'folgetag',    beschreibung: '', typ: 'max_folgetage',     wert: 5,  quelle: 'gesetz' },
]

function mkModel(
  mitarbeiter: PlanungsMitarbeiter[],
  schichten: SchichtDefinition[],
  arbeitstage: string[],
  overrideRules?: HarteRegel[],
): PlanningRuleModel {
  return {
    sessionId: 'test',
    locationId: 'loc1',
    customerId: 'cust1',
    zeitraum: { von: arbeitstage[0] ?? '2024-01-08', bis: arbeitstage.at(-1) ?? '2024-01-14', arbeitstage },
    einheiten: [],
    schichten,
    harteRegeln: overrideRules ?? LEGAL_RULES,
    weicheRegeln: [],
    fairness: { wochenendArbeit: false, nachtdienstFair: false, schichttypFairness: false, belastungsgleichverteilung: false },
    mitarbeiter,
  }
}

function mkPlan(eintraege: PlanEintrag[]): GenerierterPlan {
  return { eintraege, decisions: [], metadaten: { erstelltAm: '2024-01-08T00:00:00Z', solver: 'cp-sat', regelmodellVersion: '1.0' } }
}

const WEEK = ['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12', '2024-01-13', '2024-01-14']

// ─── Scenario 2: Employee on vacation must never be planned ───────────────────

describe('Scenario 2 — Employee on vacation never planned', () => {
  it('detects critical violation when vacationing employee is assigned', () => {
    const schicht = mkSchicht('frueh')
    const emp = mkEmp('emp1', { urlaubAn: ['2024-01-10', '2024-01-11', '2024-01-12'] })
    const model = mkModel([emp], [schicht], WEEK)
    // Plan includes vacation day
    const plan = mkPlan([mkEntry('emp1', '2024-01-10', 'frueh')])
    const result = verifyPlan(plan, model)
    expect(result.verletzungen.some(v => v.regelId === 'hr-urlaub')).toBe(true)
    expect(result.verletzungen.find(v => v.regelId === 'hr-urlaub')!.schwere).toBe('kritisch')
  })

  it('is valid when vacationing employee is not assigned on vacation days', () => {
    const schicht = mkSchicht('frueh')
    const emp = mkEmp('emp2', { urlaubAn: ['2024-01-10', '2024-01-11'] })
    const model = mkModel([emp], [schicht], WEEK)
    // Plan only includes non-vacation days
    const plan = mkPlan([
      mkEntry('emp2', '2024-01-08', 'frueh'),
      mkEntry('emp2', '2024-01-09', 'frueh'),
    ])
    const result = verifyPlan(plan, model)
    expect(result.verletzungen.some(v => v.regelId === 'hr-urlaub')).toBe(false)
  })
})

// ─── Scenario 3: Employee wishes Friday off → wish tracked ────────────────────

describe('Scenario 3 — Employee wishes Friday off', () => {
  it('counts fulfilled when employee not assigned on wished-free day', () => {
    const schicht = mkSchicht('frueh')
    const friday = '2024-01-12'
    const emp = mkEmp('emp1', {
      wuensche: [{ datum: friday, schichtId: '', typ: 'wunschfrei', prioritaet: 2 }],
    })
    const model = mkModel([emp], [schicht], WEEK)
    // Assign only Mon-Thu (not Fri)
    const plan = mkPlan(
      ['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11'].map(d => mkEntry('emp1', d, 'frueh'))
    )
    const result = verifyPlan(plan, model)
    expect(result.kategorien.wunscherfuellung).toBe(100)
    expect(result.verletzungen.find(v => v.regelId === 'wr-wunschfrei')).toBeUndefined()
  })

  it('tracks unfulfilled wish when employee must work Friday', () => {
    const schicht = mkSchicht('frueh')
    const friday = '2024-01-12'
    const emp = mkEmp('emp1', {
      wuensche: [{ datum: friday, schichtId: '', typ: 'wunschfrei', prioritaet: 2 }],
    })
    const model = mkModel([emp], [schicht], WEEK)
    // Employee assigned on Friday anyway
    const plan = mkPlan([mkEntry('emp1', friday, 'frueh')])
    const result = verifyPlan(plan, model)
    expect(result.kategorien.wunscherfuellung).toBe(0)
    expect(result.verletzungen.find(v => v.regelId === 'wr-wunschfrei')).toBeDefined()
    // Plan is still usable — not kritisch
    expect(result.verletzungen.find(v => v.regelId === 'wr-wunschfrei')!.schwere).toBe('niedrig')
  })
})

// ─── Scenario 5: Unfulfilled wish → plan valid, wish documented ───────────────

describe('Scenario 5 — Unfulfilled shift wish: plan stays valid', () => {
  it('plan is still freigeben-eligible even when a shift wish goes unmet', () => {
    const frueh = mkSchicht('frueh')
    const spaet = mkSchicht('spaet', '14:00', '22:00', { typ: 'spaet' })
    const emp = mkEmp('emp1', {
      wuensche: [{ datum: '2024-01-08', schichtId: 'frueh', typ: 'wunsch', prioritaet: 3 }],
    })
    const model = mkModel([emp], [frueh, spaet], ['2024-01-08'])
    // Employee assigned spaet instead of frueh
    const plan = mkPlan([mkEntry('emp1', '2024-01-08', 'spaet')])
    const result = verifyPlan(plan, model)
    // wunscherfuellung is 0 but no kritisch violation
    expect(result.verletzungen.filter(v => v.schwere === 'kritisch')).toHaveLength(0)
    expect(result.kategorien.wunscherfuellung).toBe(0)
  })
})

// ─── Scenario 7: Qualification missing → violation detected ──────────────────

describe('Scenario 7 — Qualification requirement', () => {
  it('raises kritisch violation when employee missing required qualification is assigned', () => {
    const schicht = mkSchicht('sonderaufgabe', '06:00', '14:00', { requiredQuals: ['Ersthelfer'] })
    const emp = mkEmp('emp1')  // no qualifications
    const model = mkModel([emp], [schicht], ['2024-01-08'])
    const plan = mkPlan([mkEntry('emp1', '2024-01-08', 'sonderaufgabe')])
    const result = verifyPlan(plan, model)
    expect(result.verletzungen.some(v => v.regelId === 'hr-qualifikation')).toBe(true)
    expect(result.freigabeEmpfehlung).toBe('ueberarbeiten')
  })

  it('no violation when qualified employee is assigned', () => {
    const schicht = mkSchicht('sonderaufgabe', '06:00', '14:00', { requiredQuals: ['Ersthelfer'] })
    const emp = mkEmp('emp1', { qualifikationen: ['Ersthelfer', 'Schichtleitung'] })
    const model = mkModel([emp], [schicht], ['2024-01-08'])
    const plan = mkPlan([mkEntry('emp1', '2024-01-08', 'sonderaufgabe')])
    const result = verifyPlan(plan, model)
    expect(result.verletzungen.some(v => v.regelId === 'hr-qualifikation')).toBe(false)
  })
})

// ─── Scenario 8: Spät → Früh forbidden ───────────────────────────────────────

describe('Scenario 8 — Late-to-early rest violation never occurs', () => {
  it('detects rest violation when late shift followed by early shift next day', () => {
    const spaet = mkSchicht('spaet', '14:00', '22:00', { typ: 'spaet' })
    const frueh = mkSchicht('frueh', '06:00', '14:00')
    // 22:00 → 06:00 = 8h rest < 11h minimum
    const emp = mkEmp('emp1')
    const model = mkModel([emp], [spaet, frueh], ['2024-01-08', '2024-01-09'])
    const plan = mkPlan([
      mkEntry('emp1', '2024-01-08', 'spaet'),
      mkEntry('emp1', '2024-01-09', 'frueh'),
    ])
    const result = verifyPlan(plan, model)
    expect(result.verletzungen.some(v => v.regelId === 'hr-ruhezeit')).toBe(true)
  })

  it('no rest violation when late shift is NOT followed by early shift next day', () => {
    const spaet = mkSchicht('spaet', '14:00', '22:00', { typ: 'spaet' })
    const frueh = mkSchicht('frueh', '06:00', '14:00')
    const emp = mkEmp('emp1')
    const model = mkModel([emp], [spaet, frueh], ['2024-01-08', '2024-01-09'])
    // Same-type shift both days — no rest issue
    const plan = mkPlan([
      mkEntry('emp1', '2024-01-08', 'spaet'),
      mkEntry('emp1', '2024-01-09', 'spaet'),
    ])
    const result = verifyPlan(plan, model)
    expect(result.verletzungen.some(v => v.regelId === 'hr-ruhezeit')).toBe(false)
  })
})

// ─── Deterministic fairness score sanity checks ───────────────────────────────

describe('Dynamic fairness score', () => {
  it('returns 100 fairness for single employee (no imbalance possible)', () => {
    const frueh = mkSchicht('frueh')
    const emp = mkEmp('emp1')
    const model = mkModel([emp], [frueh], ['2024-01-08', '2024-01-09', '2024-01-10'])
    const plan = mkPlan(['2024-01-08', '2024-01-09', '2024-01-10'].map(d => mkEntry('emp1', d, 'frueh')))
    const result = verifyPlan(plan, model)
    expect(result.kategorien.fairness).toBe(100)
  })

  it('returns lower fairness score when weekend distribution is unbalanced', () => {
    const frueh = mkSchicht('frueh')
    const emp1 = mkEmp('emp1')
    const emp2 = mkEmp('emp2')
    // Weekend days: Sat 2024-01-13, Sun 2024-01-14
    const allDays = WEEK
    const model = mkModel([emp1, emp2], [frueh], allDays, [
      ...LEGAL_RULES,
    ])
    // emp1 gets all weekend shifts, emp2 gets none
    const plan = mkPlan([
      ...allDays.slice(0, 5).map(d => mkEntry('emp1', d, 'frueh')),
      mkEntry('emp1', '2024-01-13', 'frueh'),
      mkEntry('emp1', '2024-01-14', 'frueh'),
      ...allDays.slice(0, 5).map(d => mkEntry('emp2', d, 'frueh')),
    ])
    const balanced = verifyPlan(mkPlan([
      ...allDays.map(d => mkEntry('emp1', d, 'frueh')),
    ]), mkModel([emp1], [frueh], allDays))
    const unbalanced = verifyPlan(plan, model)
    expect(unbalanced.kategorien.fairness).toBeLessThan(100)
  })
})

// ─── Scenario 1: 3+ employees, 7 days, valid plan — no critical violations ─────

describe('Scenario 1 — Valid plan with multiple employees', () => {
  it('produces no critical violations for a straightforward 3-employee 7-day plan', () => {
    const frueh = mkSchicht('frueh')
    const emp1 = mkEmp('emp1')
    const emp2 = mkEmp('emp2')
    const emp3 = mkEmp('emp3')
    const model = mkModel([emp1, emp2, emp3], [frueh], WEEK)
    // Each employee works 5 days out of 7 — no rest violations, no overtime
    const plan = mkPlan([
      ...['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12'].map(d => mkEntry('emp1', d, 'frueh')),
      ...['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12'].map(d => mkEntry('emp2', d, 'frueh')),
      ...['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12'].map(d => mkEntry('emp3', d, 'frueh')),
    ])
    const result = verifyPlan(plan, model)
    const critical = result.verletzungen.filter(v => v.schwere === 'kritisch')
    expect(critical).toHaveLength(0)
    expect(['freigeben', 'optimieren']).toContain(result.freigabeEmpfehlung)
  })

  it('plan is staffed — coverage score is 100 when every day has assigned employees', () => {
    const frueh = mkSchicht('frueh', '06:00', '14:00', { minBesetzung: 1 })
    const emp1 = mkEmp('emp1')
    const model = mkModel([emp1], [frueh], WEEK.slice(0, 5))
    const plan = mkPlan(WEEK.slice(0, 5).map(d => mkEntry('emp1', d, 'frueh')))
    const result = verifyPlan(plan, model)
    expect(result.kategorien.abdeckung).toBe(100)
  })
})

// ─── Scenario 4: Two employees want same weekend off — fairness considered ─────

describe('Scenario 4 — Conflicting weekend-off wishes', () => {
  it('when both want the same weekend off, one unfulfilled wish is recorded but no critical violation', () => {
    const frueh = mkSchicht('frueh')
    const saturday = '2024-01-13'
    const emp1 = mkEmp('emp1', {
      wuensche: [{ datum: saturday, schichtId: '', typ: 'wunschfrei', prioritaet: 2 }],
    })
    const emp2 = mkEmp('emp2', {
      wuensche: [{ datum: saturday, schichtId: '', typ: 'wunschfrei', prioritaet: 2 }],
    })
    const model = mkModel([emp1, emp2], [frueh], WEEK)
    // One employee must cover Saturday — emp2 is assigned
    const plan = mkPlan([
      ...['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12'].map(d => mkEntry('emp1', d, 'frueh')),
      ...['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12', saturday].map(d => mkEntry('emp2', d, 'frueh')),
    ])
    const result = verifyPlan(plan, model)
    const critViolations = result.verletzungen.filter(v => v.schwere === 'kritisch')
    expect(critViolations).toHaveLength(0)
    // At least one wunschfrei violation for the employee who had to work Saturday
    expect(result.verletzungen.some(v => v.regelId === 'wr-wunschfrei')).toBe(true)
    const wunschViol = result.verletzungen.filter(v => v.regelId === 'wr-wunschfrei')
    // Only one employee's wish was violated (emp2 was assigned, emp1 got the day off)
    expect(wunschViol).toHaveLength(1)
  })
})

// ─── Scenario 6: Streak tracking via letzteSchichten ─────────────────────────

describe('Scenario 6 — Consecutive-day streak from letzteSchichten', () => {
  it('detects max-consecutive-days violation when letzteSchichten seeds a streak that extends into the plan', () => {
    const frueh = mkSchicht('frueh')
    // Employee worked 4 days right before the planning period (2024-01-04 to 2024-01-07)
    const emp = mkEmp('emp1', {
      letzteSchichten: [
        { datum: '2024-01-04', schichtId: 'frueh' },
        { datum: '2024-01-05', schichtId: 'frueh' },
        { datum: '2024-01-06', schichtId: 'frueh' },
        { datum: '2024-01-07', schichtId: 'frueh' },
      ],
    })
    const model = mkModel([emp], [frueh], WEEK, [
      ...LEGAL_RULES.map(r => r.typ === 'max_folgetage' ? { ...r, wert: 5 } : r),
    ])
    // Assign emp the first 2 days of the period → total streak = 4 + 2 = 6 > 5
    const plan = mkPlan([
      mkEntry('emp1', '2024-01-08', 'frueh'),
      mkEntry('emp1', '2024-01-09', 'frueh'),
    ])
    const result = verifyPlan(plan, model)
    expect(result.verletzungen.some(v => v.regelId === 'hr-maxfolgetage')).toBe(true)
  })

  it('no streak violation when letzteSchichten is short enough', () => {
    const frueh = mkSchicht('frueh')
    // Only 2 prior consecutive days
    const emp = mkEmp('emp1', {
      letzteSchichten: [
        { datum: '2024-01-06', schichtId: 'frueh' },
        { datum: '2024-01-07', schichtId: 'frueh' },
      ],
    })
    const model = mkModel([emp], [frueh], WEEK, [
      ...LEGAL_RULES.map(r => r.typ === 'max_folgetage' ? { ...r, wert: 5 } : r),
    ])
    // 2 prior + 3 in period = 5 total — exactly at the limit
    const plan = mkPlan([
      mkEntry('emp1', '2024-01-08', 'frueh'),
      mkEntry('emp1', '2024-01-09', 'frueh'),
      mkEntry('emp1', '2024-01-10', 'frueh'),
    ])
    const result = verifyPlan(plan, model)
    expect(result.verletzungen.some(v => v.regelId === 'hr-maxfolgetage')).toBe(false)
  })
})
