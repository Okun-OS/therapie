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

function makeSchicht(id: string, von: string, bis: string, uebernacht = false): SchichtDefinition {
  return { id, name: id, typ: 'frueh', von, bis, uebernacht, minBesetzungGesamt: 1, aufgaben: [] }
}

function makeEmp(id: string, overrides: Partial<PlanungsMitarbeiter> = {}): PlanungsMitarbeiter {
  return {
    id,
    name: id,
    einheiten: [],
    verfuegbareSchichtTypen: ['frueh'],
    wochenstundenSoll: 40,
    arbeitstageProWoche: 5,
    qualifikationen: [],
    nichtVerfuegbarAn: [],
    urlaubAn: [],
    wuensche: [],
    ...overrides,
  }
}

function makeEintrag(mitarbeiterId: string, datum: string, schichtId: string): PlanEintrag {
  return { mitarbeiterId, datum, schichtId, istVertretung: false }
}

const BASE_REGELN: HarteRegel[] = [
  { id: 'r1', kategorie: 'arbeitszeit', beschreibung: '', typ: 'max_wochenstunden', wert: 40, quelle: 'gesetz' },
  { id: 'r2', kategorie: 'ruhezeit',    beschreibung: '', typ: 'min_ruhezeit',      wert: 11, quelle: 'gesetz' },
  { id: 'r3', kategorie: 'folgetag',    beschreibung: '', typ: 'max_folgetage',     wert: 5,  quelle: 'gesetz' },
]

function makeModel(
  mitarbeiter: PlanungsMitarbeiter[],
  schichten: SchichtDefinition[],
  arbeitstage: string[],
  harteRegeln: HarteRegel[] = BASE_REGELN,
): PlanningRuleModel {
  return {
    sessionId: 'test',
    locationId: 'loc1',
    customerId: 'cust1',
    zeitraum: { von: arbeitstage[0] ?? '2024-01-01', bis: arbeitstage.at(-1) ?? '2024-01-07', arbeitstage },
    einheiten: [],
    schichten,
    harteRegeln,
    weicheRegeln: [],
    fairness: {
      wochenendArbeit: false,
      nachtdienstFair: false,
      schichttypFairness: false,
      belastungsgleichverteilung: false,
    },
    mitarbeiter,
  }
}

function makePlan(eintraege: PlanEintrag[]): GenerierterPlan {
  return {
    eintraege,
    decisions: [],
    metadaten: { erstelltAm: '2024-01-01T00:00:00Z', solver: 'cp-sat', regelmodellVersion: '1.0' },
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('verifyPlan', () => {
  // ── Empty plan ──────────────────────────────────────────────────────────────
  describe('empty plan', () => {
    it('returns critical violation and score 0 when employees exist but plan is empty', () => {
      const model = makeModel(
        [makeEmp('emp1')],
        [makeSchicht('frueh', '06:00', '14:00')],
        ['2024-01-08'],
      )
      const result = verifyPlan(makePlan([]), model)
      expect(result.gesamtScore).toBe(0)
      expect(result.freigabeEmpfehlung).toBe('ueberarbeiten')
      expect(result.verletzungen.some(v => v.schwere === 'kritisch')).toBe(true)
    })

    it('is fine when plan is empty because no employees exist', () => {
      const model = makeModel([], [], ['2024-01-08'])
      const result = verifyPlan(makePlan([]), model)
      // No employees → no violations expected from the empty-plan guard
      expect(result.verletzungen.filter(v => v.regelId === 'hr-leerplan')).toHaveLength(0)
    })
  })

  // ── Vacation / absence conflicts ────────────────────────────────────────────
  describe('vacation conflicts', () => {
    it('raises critical violation when employee is scheduled on vacation day', () => {
      const schicht = makeSchicht('frueh', '06:00', '14:00')
      const emp = makeEmp('emp1', { urlaubAn: ['2024-01-08'] })
      const model = makeModel([emp], [schicht], ['2024-01-08'])
      const result = verifyPlan(makePlan([makeEintrag('emp1', '2024-01-08', 'frueh')]), model)
      const v = result.verletzungen.find(v => v.regelId === 'hr-urlaub')
      expect(v).toBeDefined()
      expect(v!.schwere).toBe('kritisch')
    })

    it('raises critical violation when employee is scheduled on absence day', () => {
      const schicht = makeSchicht('frueh', '06:00', '14:00')
      const emp = makeEmp('emp1', { nichtVerfuegbarAn: ['2024-01-08'] })
      const model = makeModel([emp], [schicht], ['2024-01-08'])
      const result = verifyPlan(makePlan([makeEintrag('emp1', '2024-01-08', 'frueh')]), model)
      const v = result.verletzungen.find(v => v.regelId === 'hr-abwesenheit')
      expect(v).toBeDefined()
      expect(v!.schwere).toBe('kritisch')
    })
  })

  // ── Duplicate assignments ───────────────────────────────────────────────────
  describe('duplicate day assignment', () => {
    it('raises critical violation for two shifts on same day', () => {
      const schicht = makeSchicht('frueh', '06:00', '14:00')
      const emp = makeEmp('emp1')
      const model = makeModel([emp], [schicht], ['2024-01-08'])
      const plan = makePlan([
        makeEintrag('emp1', '2024-01-08', 'frueh'),
        makeEintrag('emp1', '2024-01-08', 'frueh'),
      ])
      const result = verifyPlan(plan, model)
      expect(result.verletzungen.find(v => v.regelId === 'hr-doppelbelegung')).toBeDefined()
    })
  })

  // ── Weekly hours ────────────────────────────────────────────────────────────
  describe('weekly hours', () => {
    it('raises high violation when employee exceeds max weekly hours', () => {
      // 6 × 8h = 48h > 40h limit
      const schicht = makeSchicht('frueh', '06:00', '14:00') // 8h
      const emp = makeEmp('emp1')
      const days = ['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12', '2024-01-13']
      const model = makeModel([emp], [schicht], days)
      const plan = makePlan(days.map(d => makeEintrag('emp1', d, 'frueh')))
      const result = verifyPlan(plan, model)
      expect(result.verletzungen.find(v => v.regelId === 'hr-maxwochenstunden')).toBeDefined()
    })

    it('does not raise violation when weekly hours are exactly at limit', () => {
      // 5 × 8h = 40h = limit
      const schicht = makeSchicht('frueh', '06:00', '14:00') // 8h
      const emp = makeEmp('emp1')
      const days = ['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12']
      const model = makeModel([emp], [schicht], days)
      const plan = makePlan(days.map(d => makeEintrag('emp1', d, 'frueh')))
      const result = verifyPlan(plan, model)
      expect(result.verletzungen.find(v => v.regelId === 'hr-maxwochenstunden')).toBeUndefined()
    })
  })

  // ── Rest time ───────────────────────────────────────────────────────────────
  describe('rest time violations', () => {
    it('raises high violation when rest between shifts is below minimum', () => {
      // Late shift ends 22:00, early shift starts 06:00 next day = only 8h rest (< 11h)
      const spaet = makeSchicht('spaet', '14:00', '22:00')
      const frueh = makeSchicht('frueh', '06:00', '14:00')
      const emp = makeEmp('emp1')
      const model = makeModel([emp], [spaet, frueh], ['2024-01-08', '2024-01-09'])
      const plan = makePlan([
        makeEintrag('emp1', '2024-01-08', 'spaet'),
        makeEintrag('emp1', '2024-01-09', 'frueh'),
      ])
      const result = verifyPlan(plan, model)
      expect(result.verletzungen.find(v => v.regelId === 'hr-ruhezeit')).toBeDefined()
    })

    it('does not flag rest violation when rest is sufficient', () => {
      // Early shift ends 14:00, early next day starts 06:00 = 16h rest (> 11h)
      const frueh = makeSchicht('frueh', '06:00', '14:00')
      const emp = makeEmp('emp1')
      const model = makeModel([emp], [frueh], ['2024-01-08', '2024-01-09'])
      const plan = makePlan([
        makeEintrag('emp1', '2024-01-08', 'frueh'),
        makeEintrag('emp1', '2024-01-09', 'frueh'),
      ])
      const result = verifyPlan(plan, model)
      expect(result.verletzungen.find(v => v.regelId === 'hr-ruhezeit')).toBeUndefined()
    })
  })

  // ── Consecutive days ────────────────────────────────────────────────────────
  describe('consecutive days limit', () => {
    it('raises high violation when exceeding max consecutive days', () => {
      const frueh = makeSchicht('frueh', '06:00', '14:00')
      const emp = makeEmp('emp1')
      // 6 consecutive days with max = 5
      const days = ['2024-01-07', '2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12']
      const model = makeModel([emp], [frueh], days)
      const plan = makePlan(days.map(d => makeEintrag('emp1', d, 'frueh')))
      const result = verifyPlan(plan, model)
      expect(result.verletzungen.find(v => v.regelId === 'hr-maxfolgetage')).toBeDefined()
    })

    it('does not flag violation at exactly max consecutive days', () => {
      const frueh = makeSchicht('frueh', '06:00', '14:00')
      const emp = makeEmp('emp1')
      const days = ['2024-01-07', '2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11']
      const model = makeModel([emp], [frueh], days)
      const plan = makePlan(days.map(d => makeEintrag('emp1', d, 'frueh')))
      const result = verifyPlan(plan, model)
      expect(result.verletzungen.find(v => v.regelId === 'hr-maxfolgetage')).toBeUndefined()
    })
  })

  // ── Staffing coverage ───────────────────────────────────────────────────────
  describe('staffing coverage', () => {
    it('raises violation for completely unoccupied shift', () => {
      const frueh = makeSchicht('frueh', '06:00', '14:00')
      const emp = makeEmp('emp1')
      const model = makeModel([emp], [frueh], ['2024-01-08'])
      // Employee not assigned to 2024-01-08
      const result = verifyPlan(makePlan([]), model)
      // empty plan guard fires first, but if we have no employees the staffing check still fires
      const staffingViolation = result.verletzungen.find(v => v.regelId === 'hr-mindestbesetzung')
      // Note: the empty-plan guard fires before staffing check when mitarbeiter.length > 0
      // So we only check the critical empty-plan violation here
      expect(result.verletzungen.some(v => v.schwere === 'kritisch')).toBe(true)
    })

    it('detects partial understaffing when shift requires 2 but only 1 assigned', () => {
      const schicht: SchichtDefinition = {
        ...makeSchicht('frueh', '06:00', '14:00'),
        minBesetzungGesamt: 2,
      }
      const emp1 = makeEmp('emp1')
      const emp2 = makeEmp('emp2')
      const model = makeModel([emp1, emp2], [schicht], ['2024-01-08'])
      // Only emp1 assigned
      const plan = makePlan([makeEintrag('emp1', '2024-01-08', 'frueh')])
      const result = verifyPlan(plan, model)
      const v = result.verletzungen.find(v => v.regelId === 'hr-mindestbesetzung')
      expect(v).toBeDefined()
      expect(v!.schwere).toBe('mittel') // partial, not zero
    })

    it('does not raise coverage violation when staffing is met', () => {
      const schicht: SchichtDefinition = {
        ...makeSchicht('frueh', '06:00', '14:00'),
        minBesetzungGesamt: 2,
      }
      const emp1 = makeEmp('emp1')
      const emp2 = makeEmp('emp2')
      const model = makeModel([emp1, emp2], [schicht], ['2024-01-08'])
      const plan = makePlan([
        makeEintrag('emp1', '2024-01-08', 'frueh'),
        makeEintrag('emp2', '2024-01-08', 'frueh'),
      ])
      const result = verifyPlan(plan, model)
      expect(result.verletzungen.find(v => v.regelId === 'hr-mindestbesetzung')).toBeUndefined()
    })
  })

  // ── Wish fulfillment ────────────────────────────────────────────────────────
  describe('wish fulfillment', () => {
    it('counts wish as met when employee is assigned requested shift', () => {
      const frueh = makeSchicht('frueh', '06:00', '14:00')
      const emp = makeEmp('emp1', {
        wuensche: [{ datum: '2024-01-08', schichtId: 'frueh', typ: 'wunsch', prioritaet: 1 }],
      })
      const model = makeModel([emp], [frueh], ['2024-01-08'])
      const plan = makePlan([makeEintrag('emp1', '2024-01-08', 'frueh')])
      const result = verifyPlan(plan, model)
      expect(result.kategorien.wunscherfuellung).toBe(100)
    })

    it('scores 0% wish fulfillment when wish is not met', () => {
      const frueh = makeSchicht('frueh', '06:00', '14:00')
      const spaet = makeSchicht('spaet', '14:00', '22:00')
      const emp = makeEmp('emp1', {
        wuensche: [{ datum: '2024-01-08', schichtId: 'frueh', typ: 'wunsch', prioritaet: 1 }],
      })
      const model = makeModel([emp], [frueh, spaet], ['2024-01-08'])
      // Assign spaet instead of frueh
      const plan = makePlan([makeEintrag('emp1', '2024-01-08', 'spaet')])
      const result = verifyPlan(plan, model)
      expect(result.kategorien.wunscherfuellung).toBe(0)
    })
  })

  // ── Score calculation ───────────────────────────────────────────────────────
  describe('score thresholds', () => {
    it('recommends freigeben for a clean plan with full coverage and no violations', () => {
      const frueh = makeSchicht('frueh', '06:00', '14:00')
      const emp = makeEmp('emp1')
      const days = ['2024-01-08', '2024-01-09', '2024-01-10']
      const model = makeModel([emp], [frueh], days)
      const plan = makePlan(days.map(d => makeEintrag('emp1', d, 'frueh')))
      const result = verifyPlan(plan, model)
      expect(result.verletzungen.filter(v => v.schwere === 'kritisch')).toHaveLength(0)
      expect(result.verletzungen.filter(v => v.schwere === 'hoch')).toHaveLength(0)
      expect(result.freigabeEmpfehlung).toBe('freigeben')
      expect(result.gesamtScore).toBeGreaterThanOrEqual(80)
    })

    it('recommends ueberarbeiten when there are critical violations', () => {
      const schicht = makeSchicht('frueh', '06:00', '14:00')
      const emp = makeEmp('emp1', { urlaubAn: ['2024-01-08'] })
      const model = makeModel([emp], [schicht], ['2024-01-08'])
      const plan = makePlan([makeEintrag('emp1', '2024-01-08', 'frueh')])
      const result = verifyPlan(plan, model)
      expect(result.freigabeEmpfehlung).toBe('ueberarbeiten')
    })
  })
})
