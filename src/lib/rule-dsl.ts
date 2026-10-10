// Canonical Rule DSL
//
// Rules are declared with a severity that determines how the solver treats them:
//   HARD        — hard constraint; a plan that violates it is invalid
//   STRONG      — strong soft constraint; incurs a heavy penalty when violated
//   PREFERENCE  — soft constraint; incurs a moderate penalty when violated
//   OPTIMIZATION — pure optimization objective; no violation semantics

export type RuleSeverity = 'HARD' | 'STRONG' | 'PREFERENCE' | 'OPTIMIZATION'

// ─── Rule Types ───────────────────────────────────────────────────────────────

export type RuleType =
  // Hard constraints (arbeitsrechtlich / tariflich)
  | 'MIN_STAFFING'           // minimum employees per shift slot
  | 'MAX_WEEKLY_HOURS'       // maximum working hours per week per employee
  | 'MIN_REST_PERIOD'        // minimum rest hours between consecutive shifts
  | 'MAX_CONSECUTIVE_DAYS'   // maximum consecutive working days
  | 'REQUIRED_SKILL'         // shift requires specific qualification
  | 'NO_WORK_ON_VACATION'    // no assignment when employee has approved vacation
  | 'NO_WORK_ON_ABSENCE'     // no assignment when employee is absent
  | 'SHIFT_TYPE_ELIGIBLE'    // employee must be eligible for shift type
  | 'MAX_WEEKLY_WORKING_DAYS' // max number of working days per calendar week
  // Soft constraints
  | 'WISH_FULFILLMENT'       // try to honour employee shift wishes
  | 'WISH_FREE_DAY'          // try to honour day-off wishes
  | 'WEEKEND_CAP'            // limit weekend shifts per month
  | 'FAIR_NIGHT_SHIFTS'      // distribute night shifts evenly
  | 'FAIR_LATE_SHIFTS'       // distribute late shifts evenly
  | 'FAIR_WEEKEND_SHIFTS'    // distribute weekend shifts evenly
  | 'BALANCE_WORKLOAD'       // balance total hours across employees
  | 'OVERTIME_REDUCE'        // reduce hours for employee with excess hours
  | 'OVERTIME_COMPENSATE'    // increase hours for employee with deficit hours
  // Optimization objectives
  | 'MINIMIZE_UNDERSTAFFING' // minimize total understaffed shift-slots
  | 'MAXIMIZE_COVERAGE'      // maximize coverage above minimum staffing
  | 'MINIMIZE_SPLIT_DAYS'    // prefer contiguous work blocks

// ─── Rule Parameter Shapes ────────────────────────────────────────────────────

export interface RuleParamsMinStaffing {
  shiftId: string
  minCount: number
}

export interface RuleParamsHours {
  hours: number
}

export interface RuleParamsSkill {
  shiftId: string
  skill: string
}

export interface RuleParamsWeekendCap {
  maxPerMonth: number
}

export interface RuleParamsEmployeeTarget {
  employeeId: string
}

export type RuleParams =
  | RuleParamsMinStaffing
  | RuleParamsHours
  | RuleParamsSkill
  | RuleParamsWeekendCap
  | RuleParamsEmployeeTarget
  | Record<string, unknown>

// ─── Canonical Rule ───────────────────────────────────────────────────────────

export interface CanonicalRule {
  id: string
  type: RuleType
  severity: RuleSeverity
  // Human-readable description for audit logs and UI
  description: string
  // Optional structured parameters interpreted by the Rule Compiler
  params?: RuleParams
  // Legal / contractual source for documentation
  source?: 'law' | 'tariff' | 'agreement' | 'company'
  // Penalty weight used by STRONG / PREFERENCE rules in the solver objective
  weight?: number
}

// ─── Rule Set ─────────────────────────────────────────────────────────────────

export interface CanonicalRuleSet {
  locationId: string
  rules: CanonicalRule[]
}

// ─── Default German Labour Law Rules ─────────────────────────────────────────
// Based on Arbeitszeitgesetz (ArbZG).  Customers may override weights but
// should not relax HARD rules below the legal minimum.

export const DEFAULT_LABOUR_LAW_RULES: CanonicalRule[] = [
  {
    id: 'law-max-weekly-hours',
    type: 'MAX_WEEKLY_HOURS',
    severity: 'HARD',
    description: 'Maximal 48 Arbeitsstunden pro Woche (ArbZG § 3)',
    params: { hours: 48 },
    source: 'law',
  },
  {
    id: 'law-min-rest',
    type: 'MIN_REST_PERIOD',
    severity: 'HARD',
    description: 'Mindestens 11 Stunden Ruhezeit zwischen zwei Diensten (ArbZG § 5)',
    params: { hours: 11 },
    source: 'law',
  },
  {
    id: 'law-max-consec-days',
    type: 'MAX_CONSECUTIVE_DAYS',
    severity: 'HARD',
    description: 'Maximal 6 aufeinanderfolgende Arbeitstage (ArbZG § 9)',
    params: { hours: 6 },
    source: 'law',
  },
  {
    id: 'law-no-vacation-work',
    type: 'NO_WORK_ON_VACATION',
    severity: 'HARD',
    description: 'Kein Dienst an genehmigten Urlaubstagen',
    source: 'law',
  },
  {
    id: 'law-no-absence-work',
    type: 'NO_WORK_ON_ABSENCE',
    severity: 'HARD',
    description: 'Kein Dienst bei genehmigter Abwesenheit',
    source: 'law',
  },
]

export const DEFAULT_SOFT_RULES: CanonicalRule[] = [
  {
    id: 'soft-wish-fulfillment',
    type: 'WISH_FULFILLMENT',
    severity: 'PREFERENCE',
    description: 'Dienstwünsche der Mitarbeiter möglichst berücksichtigen',
    weight: 5,
  },
  {
    id: 'soft-wish-free-day',
    type: 'WISH_FREE_DAY',
    severity: 'PREFERENCE',
    description: 'Wunschfreie Tage möglichst berücksichtigen',
    weight: 5,
  },
  {
    id: 'soft-fair-night',
    type: 'FAIR_NIGHT_SHIFTS',
    severity: 'STRONG',
    description: 'Nachtdienste gleichmäßig auf alle geeigneten Mitarbeiter verteilen',
    weight: 8,
  },
  {
    id: 'soft-fair-weekend',
    type: 'FAIR_WEEKEND_SHIFTS',
    severity: 'STRONG',
    description: 'Wochenenddienste gleichmäßig verteilen',
    weight: 8,
  },
  {
    id: 'soft-balance-hours',
    type: 'BALANCE_WORKLOAD',
    severity: 'STRONG',
    description: 'Gesamtstunden möglichst gleichmäßig aufteilen (±10 %)',
    weight: 6,
  },
]

export const DEFAULT_OPTIMIZATION_RULES: CanonicalRule[] = [
  {
    id: 'opt-minimize-understaffing',
    type: 'MINIMIZE_UNDERSTAFFING',
    severity: 'OPTIMIZATION',
    description: 'Unterbesetzung minimieren',
    weight: 10,
  },
  {
    id: 'opt-maximize-coverage',
    type: 'MAXIMIZE_COVERAGE',
    severity: 'OPTIMIZATION',
    description: 'Schichtabdeckung maximieren',
    weight: 3,
  },
]

export const DEFAULT_RULE_SET: Omit<CanonicalRuleSet, 'locationId'> = {
  rules: [
    ...DEFAULT_LABOUR_LAW_RULES,
    ...DEFAULT_SOFT_RULES,
    ...DEFAULT_OPTIMIZATION_RULES,
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function hardRules(ruleSet: CanonicalRuleSet): CanonicalRule[] {
  return ruleSet.rules.filter(r => r.severity === 'HARD')
}

export function softRules(ruleSet: CanonicalRuleSet): CanonicalRule[] {
  return ruleSet.rules.filter(r => r.severity === 'STRONG' || r.severity === 'PREFERENCE')
}

export function optimizationRules(ruleSet: CanonicalRuleSet): CanonicalRule[] {
  return ruleSet.rules.filter(r => r.severity === 'OPTIMIZATION')
}

export function rulesByType(ruleSet: CanonicalRuleSet, type: RuleType): CanonicalRule[] {
  return ruleSet.rules.filter(r => r.type === type)
}

// ─── §29 Rule Explanation Generator ──────────────────────────────────────────
// Produces a human-readable plain-German explanation for any CanonicalRule,
// filling in parameter values where available.

const RULE_TYPE_TEMPLATES: Record<RuleType, (params?: RuleParams) => string> = {
  MIN_STAFFING: (p) => {
    const pp = p as RuleParamsMinStaffing | undefined
    return `Jede Schicht benötigt mindestens ${pp?.minCount ?? '?'} Mitarbeiter gleichzeitig.`
  },
  MAX_WEEKLY_HOURS: (p) => {
    const pp = p as RuleParamsHours | undefined
    return `Kein Mitarbeiter darf mehr als ${pp?.hours ?? 48} Stunden pro Woche arbeiten.`
  },
  MIN_REST_PERIOD: (p) => {
    const pp = p as RuleParamsHours | undefined
    return `Zwischen zwei Diensten muss eine Ruhezeit von mindestens ${pp?.hours ?? 11} Stunden liegen.`
  },
  MAX_CONSECUTIVE_DAYS: (p) => {
    const pp = p as RuleParamsHours | undefined
    return `Maximal ${pp?.hours ?? 6} Arbeitstage hintereinander ohne freien Tag.`
  },
  REQUIRED_SKILL: (p) => {
    const pp = p as RuleParamsSkill | undefined
    return `Die Schicht${pp?.shiftId ? ` „${pp.shiftId}"` : ''} erfordert die Qualifikation „${pp?.skill ?? '?'}".`
  },
  NO_WORK_ON_VACATION: () => 'Mitarbeiter dürfen an genehmigten Urlaubstagen nicht eingeplant werden.',
  NO_WORK_ON_ABSENCE: () => 'Mitarbeiter dürfen bei genehmigter Abwesenheit nicht eingeplant werden.',
  SHIFT_TYPE_ELIGIBLE: () => 'Mitarbeiter werden nur Schichttypen zugewiesen, für die sie freigegeben sind.',
  MAX_WEEKLY_WORKING_DAYS: (p) => {
    const pp = p as RuleParamsHours | undefined
    return `Pro Kalenderwoche darf ein Mitarbeiter höchstens ${pp?.hours ?? 5} Tage arbeiten.`
  },
  WISH_FULFILLMENT: () => 'Dienstwünsche der Mitarbeiter werden, soweit möglich, berücksichtigt.',
  WISH_FREE_DAY: () => 'Wunschfreie Tage werden, soweit möglich, eingehalten.',
  WEEKEND_CAP: (p) => {
    const pp = p as RuleParamsWeekendCap | undefined
    return `Pro Monat darf ein Mitarbeiter höchstens ${pp?.maxPerMonth ?? 2} Wochenenddienste übernehmen.`
  },
  FAIR_NIGHT_SHIFTS: () => 'Nachtdienste werden gleichmäßig unter allen geeigneten Mitarbeitern verteilt.',
  FAIR_LATE_SHIFTS: () => 'Spätdienste werden gleichmäßig unter allen geeigneten Mitarbeitern verteilt.',
  FAIR_WEEKEND_SHIFTS: () => 'Wochenenddienste werden fair auf alle Mitarbeiter aufgeteilt.',
  BALANCE_WORKLOAD: () => 'Die Gesamtarbeitszeit wird möglichst gleichmäßig auf alle Mitarbeiter verteilt.',
  OVERTIME_REDUCE: () => 'Mitarbeiter mit Überstunden erhalten in diesem Zeitraum weniger Dienste.',
  OVERTIME_COMPENSATE: () => 'Mitarbeiter mit Minusstunden erhalten in diesem Zeitraum mehr Dienste.',
  MINIMIZE_UNDERSTAFFING: () => 'Unterbesetzte Schichten werden so weit wie möglich vermieden.',
  MAXIMIZE_COVERAGE: () => 'Die Schichtabdeckung wird über das Mindestmaß hinaus maximiert.',
  MINIMIZE_SPLIT_DAYS: () => 'Arbeitstage werden möglichst als zusammenhängende Blöcke geplant.',
}

/**
 * Returns a plain-German one-sentence explanation for the given rule,
 * filling in parameter values where available.
 */
export function explainRule(rule: CanonicalRule): string {
  const template = RULE_TYPE_TEMPLATES[rule.type]
  if (!template) return rule.description
  const base = template(rule.params)
  const sourceLabel =
    rule.source === 'law' ? ' (Arbeitszeitgesetz)'
    : rule.source === 'tariff' ? ' (Tarifvertrag)'
    : rule.source === 'agreement' ? ' (Betriebsvereinbarung)'
    : ''
  return base + sourceLabel
}

/**
 * Generates explanations for all rules in a rule set.
 */
export function explainRuleSet(ruleSet: CanonicalRuleSet): Array<{ id: string; type: RuleType; severity: RuleSeverity; explanation: string }> {
  return ruleSet.rules.map(r => ({
    id: r.id,
    type: r.type,
    severity: r.severity,
    explanation: explainRule(r),
  }))
}
