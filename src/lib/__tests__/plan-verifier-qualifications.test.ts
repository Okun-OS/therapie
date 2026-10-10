/**
 * Qualification enforcement tests — Spec point 30, 47 (Scenario 7)
 *
 * These tests verify that the verifier correctly catches when an employee
 * without the required qualifications is assigned to a shift that demands them.
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

function makeSchicht(
  id: string,
  von: string,
  bis: string,
  requiredQuals: string[] = [],
): SchichtDefinition {
  return { id, name: id, typ: 'frueh', von, bis, uebernacht: false, minBesetzungGesamt: 1, aufgaben: [], erforderlicheQualifikationen: requiredQuals }
}

function makeEmp(id: string, qualifications: string[] = [], overrides: Partial<PlanungsMitarbeiter> = {}): PlanungsMitarbeiter {
  return {
    id, name: id,
    einheiten: [],
    verfuegbareSchichtTypen: ['frueh'],
    wochenstundenSoll: 40,
    arbeitstageProWoche: 5,
    qualifikationen: qualifications,
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
): PlanningRuleModel {
  return {
    sessionId: 'test',
    locationId: 'loc1',
    customerId: 'cust1',
    zeitraum: { von: arbeitstage[0] ?? '2024-01-08', bis: arbeitstage.at(-1) ?? '2024-01-08', arbeitstage },
    einheiten: [],
    schichten,
    harteRegeln: BASE_REGELN,
    weicheRegeln: [],
    fairness: { wochenendArbeit: false, nachtdienstFair: false, schichttypFairness: false, belastungsgleichverteilung: false },
    mitarbeiter,
  }
}

function makePlan(eintraege: PlanEintrag[]): GenerierterPlan {
  return {
    eintraege,
    decisions: [],
    metadaten: { erstelltAm: '2024-01-08T00:00:00Z', solver: 'cp-sat', regelmodellVersion: '1.0' },
  }
}

describe('Qualification enforcement (Spec §30, Scenario 7)', () => {
  it('raises kritisch violation when employee is assigned to shift requiring qualification they lack', () => {
    const schicht = makeSchicht('frueh', '06:00', '14:00', ['Team Lead'])
    const emp = makeEmp('emp1', [])  // no qualifications
    const model = makeModel([emp], [schicht], ['2024-01-08'])
    const plan = makePlan([makeEintrag('emp1', '2024-01-08', 'frueh')])
    const result = verifyPlan(plan, model)
    const v = result.verletzungen.find(v => v.regelId === 'hr-qualifikation')
    expect(v).toBeDefined()
    expect(v!.schwere).toBe('kritisch')
    expect(v!.beschreibung).toContain('Team Lead')
    expect(result.freigabeEmpfehlung).toBe('ueberarbeiten')
  })

  it('does not raise violation when employee has all required qualifications', () => {
    const schicht = makeSchicht('frueh', '06:00', '14:00', ['Team Lead', 'First Aid'])
    const emp = makeEmp('emp1', ['Team Lead', 'First Aid', 'Service'])
    const model = makeModel([emp], [schicht], ['2024-01-08'])
    const plan = makePlan([makeEintrag('emp1', '2024-01-08', 'frueh')])
    const result = verifyPlan(plan, model)
    expect(result.verletzungen.find(v => v.regelId === 'hr-qualifikation')).toBeUndefined()
  })

  it('does not raise violation when shift has no required qualifications', () => {
    const schicht = makeSchicht('frueh', '06:00', '14:00', [])
    const emp = makeEmp('emp1', [])
    const model = makeModel([emp], [schicht], ['2024-01-08'])
    const plan = makePlan([makeEintrag('emp1', '2024-01-08', 'frueh')])
    const result = verifyPlan(plan, model)
    expect(result.verletzungen.find(v => v.regelId === 'hr-qualifikation')).toBeUndefined()
  })

  it('raises one violation per missing qualification per assignment', () => {
    const schicht = makeSchicht('frueh', '06:00', '14:00', ['Team Lead', 'First Aid'])
    const emp = makeEmp('emp1', ['Service'])  // has Service but not the two required
    const model = makeModel([emp], [schicht], ['2024-01-08'])
    const plan = makePlan([makeEintrag('emp1', '2024-01-08', 'frueh')])
    const result = verifyPlan(plan, model)
    const qViolations = result.verletzungen.filter(v => v.regelId === 'hr-qualifikation')
    // One violation per assignment (not per missing qualification), but description lists all missing
    expect(qViolations).toHaveLength(1)
    expect(qViolations[0].beschreibung).toContain('Team Lead')
    expect(qViolations[0].beschreibung).toContain('First Aid')
  })

  it('detects violation only for unqualified employee when two employees assigned to same shift', () => {
    const schicht = makeSchicht('frueh', '06:00', '14:00', ['Team Lead'])
    const qualified   = makeEmp('emp1', ['Team Lead'])
    const unqualified = makeEmp('emp2', [])
    const model = makeModel([qualified, unqualified], [schicht], ['2024-01-08'])
    const plan = makePlan([
      makeEintrag('emp1', '2024-01-08', 'frueh'),
      makeEintrag('emp2', '2024-01-08', 'frueh'),
    ])
    const result = verifyPlan(plan, model)
    const qViolations = result.verletzungen.filter(v => v.regelId === 'hr-qualifikation')
    expect(qViolations).toHaveLength(1)
    expect(qViolations[0].betrifft).toContain('emp2')
    expect(qViolations[0].betrifft).not.toContain('emp1')
  })
})
