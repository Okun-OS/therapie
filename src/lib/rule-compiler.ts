// Rule Compiler
//
// Translates a CanonicalRuleSet into HarteRegel[] / WeicheRegel[] arrays that
// PlanningRuleModel (and therefore the CP-SAT solver) understands.
//
// The mapping is intentionally explicit: each CanonicalRule type maps to a
// specific HarteRegel.typ or WeicheRegel.kategorie value.

import type { HarteRegel, WeicheRegel } from '@/lib/company-model-types'
import type { CanonicalRule, CanonicalRuleSet } from '@/lib/rule-dsl'

export interface CompiledRules {
  hart: HarteRegel[]
  weich: WeicheRegel[]
}

// Maps a HARD canonical rule to a HarteRegel understood by the solver.
function compileHardRule(rule: CanonicalRule): HarteRegel | null {
  const base = {
    id: rule.id,
    beschreibung: rule.description,
    quelle: sourceMap[rule.source ?? 'company'],
  } as const

  const p = (rule.params ?? {}) as Record<string, unknown>

  switch (rule.type) {
    case 'MAX_WEEKLY_HOURS':
      return { ...base, kategorie: 'arbeitszeit', typ: 'max_wochenstunden', wert: Number(p.hours ?? 48), einheit: 'h' }
    case 'MIN_REST_PERIOD':
      return { ...base, kategorie: 'ruhezeit', typ: 'min_ruhezeit', wert: Number(p.hours ?? 11), einheit: 'h' }
    case 'MAX_CONSECUTIVE_DAYS':
      return { ...base, kategorie: 'folgetag', typ: 'max_folgetage', wert: Number(p.hours ?? 6) }
    case 'MAX_WEEKLY_WORKING_DAYS':
      return { ...base, kategorie: 'arbeitszeit', typ: 'max_arbeitstage_woche', wert: Number(p.days ?? 6) }
    case 'MIN_STAFFING':
      return { ...base, kategorie: 'besetzung', typ: 'min_besetzung', wert: Number(p.minCount ?? 1) }
    case 'REQUIRED_SKILL':
      return { ...base, kategorie: 'qualifikation', typ: 'qualifikation_pflicht' }
    case 'SHIFT_TYPE_ELIGIBLE':
      return { ...base, kategorie: 'qualifikation', typ: 'schichttyp_berechtigung' }
    case 'NO_WORK_ON_VACATION':
      return { ...base, kategorie: 'arbeitszeit', typ: 'kein_dienst_urlaub' }
    case 'NO_WORK_ON_ABSENCE':
      return { ...base, kategorie: 'arbeitszeit', typ: 'kein_dienst_abwesenheit' }
    default:
      return null
  }
}

// Maps a STRONG / PREFERENCE canonical rule to a WeicheRegel.
function compileSoftRule(rule: CanonicalRule): WeicheRegel | null {
  const weight = rule.weight ?? (rule.severity === 'STRONG' ? 8 : 4)

  switch (rule.type) {
    case 'WISH_FULFILLMENT':
      return { id: rule.id, kategorie: 'wunsch', beschreibung: rule.description, gewicht: weight }
    case 'WISH_FREE_DAY':
      return { id: rule.id, kategorie: 'wunsch', beschreibung: rule.description, gewicht: weight }
    case 'WEEKEND_CAP':
      return { id: rule.id, kategorie: 'fairness', beschreibung: rule.description, gewicht: weight }
    case 'FAIR_NIGHT_SHIFTS':
      return { id: rule.id, kategorie: 'fairness', beschreibung: rule.description, gewicht: weight }
    case 'FAIR_LATE_SHIFTS':
      return { id: rule.id, kategorie: 'fairness', beschreibung: rule.description, gewicht: weight }
    case 'FAIR_WEEKEND_SHIFTS':
      return { id: rule.id, kategorie: 'fairness', beschreibung: rule.description, gewicht: weight }
    case 'BALANCE_WORKLOAD':
      return { id: rule.id, kategorie: 'belastung', beschreibung: rule.description, gewicht: weight }
    case 'OVERTIME_REDUCE':
      return { id: rule.id, kategorie: 'praeferenz', beschreibung: rule.description, gewicht: weight }
    case 'OVERTIME_COMPENSATE':
      return { id: rule.id, kategorie: 'praeferenz', beschreibung: rule.description, gewicht: weight }
    case 'MINIMIZE_UNDERSTAFFING':
    case 'MAXIMIZE_COVERAGE':
    case 'MINIMIZE_SPLIT_DAYS':
      // Optimization objectives use the same WeicheRegel structure with low weight
      return { id: rule.id, kategorie: 'kontinuitaet', beschreibung: rule.description, gewicht: weight }
    default:
      return null
  }
}

const sourceMap: Record<string, HarteRegel['quelle']> = {
  law:       'gesetz',
  tariff:    'tarifvertrag',
  agreement: 'betriebsvereinbarung',
  company:   'unternehmen',
}

export function compileRuleSet(ruleSet: CanonicalRuleSet): CompiledRules {
  const hart: HarteRegel[] = []
  const weich: WeicheRegel[] = []

  for (const rule of ruleSet.rules) {
    if (rule.severity === 'HARD') {
      const compiled = compileHardRule(rule)
      if (compiled) hart.push(compiled)
    } else {
      const compiled = compileSoftRule(rule)
      if (compiled) weich.push(compiled)
    }
  }

  return { hart, weich }
}
