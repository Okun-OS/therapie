import { describe, it, expect } from 'vitest'
import {
  DEFAULT_RULE_SET,
  hardRules,
  softRules,
  optimizationRules,
  rulesByType,
} from '@/lib/rule-dsl'
import { compileRuleSet } from '@/lib/rule-compiler'
import type { CanonicalRuleSet } from '@/lib/rule-dsl'

const TEST_SET: CanonicalRuleSet = {
  locationId: 'loc1',
  rules: DEFAULT_RULE_SET.rules,
}

describe('Rule DSL', () => {
  it('default rule set contains all four severity levels', () => {
    const severities = new Set(TEST_SET.rules.map(r => r.severity))
    expect(severities.has('HARD')).toBe(true)
    expect(severities.has('STRONG')).toBe(true)
    expect(severities.has('PREFERENCE')).toBe(true)
    expect(severities.has('OPTIMIZATION')).toBe(true)
  })

  it('hardRules() returns only HARD rules', () => {
    const hard = hardRules(TEST_SET)
    expect(hard.every(r => r.severity === 'HARD')).toBe(true)
    expect(hard.length).toBeGreaterThan(0)
  })

  it('softRules() returns STRONG and PREFERENCE rules', () => {
    const soft = softRules(TEST_SET)
    expect(soft.every(r => r.severity === 'STRONG' || r.severity === 'PREFERENCE')).toBe(true)
    expect(soft.length).toBeGreaterThan(0)
  })

  it('optimizationRules() returns only OPTIMIZATION rules', () => {
    const opt = optimizationRules(TEST_SET)
    expect(opt.every(r => r.severity === 'OPTIMIZATION')).toBe(true)
    expect(opt.length).toBeGreaterThan(0)
  })

  it('rulesByType() filters correctly', () => {
    const rules = rulesByType(TEST_SET, 'MAX_WEEKLY_HOURS')
    expect(rules.length).toBeGreaterThan(0)
    expect(rules.every(r => r.type === 'MAX_WEEKLY_HOURS')).toBe(true)
  })

  it('default rule set includes ArbZG 48h max weekly hours', () => {
    const maxHours = rulesByType(TEST_SET, 'MAX_WEEKLY_HOURS')[0]
    expect(maxHours).toBeDefined()
    expect((maxHours.params as { hours: number }).hours).toBe(48)
    expect(maxHours.source).toBe('law')
  })

  it('default rule set includes 11h min rest period', () => {
    const minRest = rulesByType(TEST_SET, 'MIN_REST_PERIOD')[0]
    expect(minRest).toBeDefined()
    expect((minRest.params as { hours: number }).hours).toBe(11)
  })
})

describe('Rule Compiler', () => {
  it('compiles HARD rules into HarteRegel[] entries', () => {
    const { hart } = compileRuleSet(TEST_SET)
    expect(hart.length).toBeGreaterThan(0)
    expect(hart.every(r => typeof r.id === 'string' && typeof r.typ === 'string')).toBe(true)
  })

  it('compiles MAX_WEEKLY_HOURS to max_wochenstunden', () => {
    const { hart } = compileRuleSet(TEST_SET)
    const r = hart.find(r => r.typ === 'max_wochenstunden')
    expect(r).toBeDefined()
    expect(r!.wert).toBe(48)
    expect(r!.quelle).toBe('gesetz')
  })

  it('compiles MIN_REST_PERIOD to min_ruhezeit', () => {
    const { hart } = compileRuleSet(TEST_SET)
    const r = hart.find(r => r.typ === 'min_ruhezeit')
    expect(r).toBeDefined()
    expect(r!.wert).toBe(11)
  })

  it('compiles MAX_CONSECUTIVE_DAYS to max_folgetage', () => {
    const { hart } = compileRuleSet(TEST_SET)
    expect(hart.find(r => r.typ === 'max_folgetage')).toBeDefined()
  })

  it('compiles STRONG / PREFERENCE rules into WeicheRegel[] entries', () => {
    const { weich } = compileRuleSet(TEST_SET)
    expect(weich.length).toBeGreaterThan(0)
  })

  it('STRONG rules get higher weight than PREFERENCE rules by default', () => {
    const { weich } = compileRuleSet(TEST_SET)
    const strong = weich.filter(r => {
      const canonical = TEST_SET.rules.find(c => c.id === r.id)
      return canonical?.severity === 'STRONG'
    })
    const pref = weich.filter(r => {
      const canonical = TEST_SET.rules.find(c => c.id === r.id)
      return canonical?.severity === 'PREFERENCE'
    })
    const avgStrong = strong.reduce((s, r) => s + r.gewicht, 0) / strong.length
    const avgPref   = pref.reduce((s, r) => s + r.gewicht, 0) / pref.length
    expect(avgStrong).toBeGreaterThan(avgPref)
  })

  it('compiles empty rule set to empty arrays', () => {
    const empty: CanonicalRuleSet = { locationId: 'x', rules: [] }
    const { hart, weich } = compileRuleSet(empty)
    expect(hart).toHaveLength(0)
    expect(weich).toHaveLength(0)
  })

  it('preserves rule IDs through compilation', () => {
    const { hart, weich } = compileRuleSet(TEST_SET)
    const allIds = [...hart.map(r => r.id), ...weich.map(r => r.id)]
    const hardIds = TEST_SET.rules.filter(r => r.severity === 'HARD').map(r => r.id)
    for (const id of hardIds) {
      expect(allIds).toContain(id)
    }
  })
})
