'use client'

import { useState, useEffect, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Euro, Moon, Sun, Star, Calendar, Settings, Bot, ChevronLeft, ChevronRight,
  Plus, Trash2, Edit2, Check, X, Send, Loader2, Info, Clock,
} from 'lucide-react'
import { minutesToHours, formatEuros } from '@/lib/surcharge-engine'
import type { EmployeeSurchargeRow, RuleResult, ConfiguredSurchargeRule } from '@/lib/surcharge-engine'
import type { Anthropic } from '@anthropic-ai/sdk'

// ── Types ───────────────────────────────────────────────────────────────────

interface RuleSet {
  id: string
  defaultHourlyWage: number | null
  onboardingCompleted: boolean
  rules: ConfiguredSurchargeRule[]
  wageConfigs: { id: string; employeeId: string | null; hourlyWage: number; validFrom: string; validTo: string | null }[]
}

type ChatMessage = {
  role: 'user' | 'assistant'
  displayText: string
  rawContent?: Anthropic.Messages.ContentBlock[]
}

// ── Constants ───────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

const RULE_TYPE_LABELS: Record<string, string> = {
  night: 'Nachtzuschlag',
  sunday: 'Sonntagszuschlag',
  holiday: 'Feiertagszuschlag',
  saturday: 'Samstagszuschlag',
  overtime: 'Überstunden',
  shift_24h: '24h-Dienst',
  oncall_passive: 'Bereitschaft',
  oncall_active: 'Rufbereitschaft',
  custom: 'Individuell',
}

const RULE_TYPE_COLORS: Record<string, string> = {
  night: 'bg-indigo-100 text-indigo-700',
  sunday: 'bg-orange-100 text-orange-700',
  holiday: 'bg-red-100 text-red-700',
  saturday: 'bg-amber-100 text-amber-700',
  overtime: 'bg-purple-100 text-purple-700',
  shift_24h: 'bg-teal-100 text-teal-700',
  oncall_passive: 'bg-sky-100 text-sky-700',
  oncall_active: 'bg-blue-100 text-blue-700',
  custom: 'bg-gray-100 text-gray-700',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function rateDisplay(rule: ConfiguredSurchargeRule): string {
  if (rule.rateType === 'percent') return `+${rule.rateValue}%`
  if (rule.rateType === 'fixed_per_hour') return `${rule.rateValue.toFixed(2)} €/h`
  return `${rule.rateValue.toFixed(2)} €/Dienst`
}

function extractTextFromContent(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter(b => b.type === 'text')
    .map(b => (b as Anthropic.Messages.TextBlock).text)
    .join('\n')
}

// ── Tab: Berechnung ─────────────────────────────────────────────────────────

function BerechnungTab() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState<EmployeeSurchargeRow[]>([])
  const [bundesland, setBundesland] = useState<string | undefined>()
  const [usingDefaults, setUsingDefaults] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/surcharges?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => {
        setRows(d.rows ?? [])
        if (d.bundesland) setBundesland(d.bundesland)
        setUsingDefaults(d.usingDefaults ?? false)
      })
      .finally(() => setLoading(false))
  }, [year, month])

  function navigate(dir: -1 | 1) {
    let m = month + dir, y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setMonth(m); setYear(y)
  }

  // Collect all unique rule IDs/names across all rows
  const ruleIndex = new Map<string, { id: string; name: string }>()
  for (const row of rows) {
    for (const r of row.byRule) {
      if (!ruleIndex.has(r.ruleId)) ruleIndex.set(r.ruleId, { id: r.ruleId, name: r.ruleName })
    }
  }
  const ruleColumns = Array.from(ruleIndex.values())

  const hasAny = rows.some(r => r.byRule.length > 0)
  const totalWorked = rows.reduce((s, r) => s + r.totalWorkedMinutes, 0)
  const ruleColTotals = new Map<string, { minutes: number; euros: number }>()
  for (const row of rows) {
    for (const r of row.byRule) {
      const cur = ruleColTotals.get(r.ruleId) ?? { minutes: 0, euros: 0 }
      ruleColTotals.set(r.ruleId, { minutes: cur.minutes + r.minutes, euros: cur.euros + r.euros })
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-navy min-w-[140px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={() => navigate(1)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {bundesland && (
          <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full">
            {bundesland}
          </span>
        )}
      </div>

      {usingDefaults && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Es sind noch keine eigenen Zuschlagsregeln konfiguriert. Die Berechnung erfolgt nach den gesetzlichen Standardwerten (§3b EStG). Richten Sie Ihre Regeln im Tab <strong>KI-Einrichtung</strong> ein.</span>
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-navy">Mitarbeiter-Übersicht · {MONTH_NAMES[month - 1]} {year}</h3>
          <span className="text-xs text-gray-400">{rows.length} Mitarbeiter</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-navy border-t-brand rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Euro} title="Keine Einträge" description="Für diesen Monat gibt es keine Zeiterfassungsdaten." className="py-12" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-white">Mitarbeiter</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Gesamt</th>
                  {ruleColumns.map(col => (
                    <th key={col.id} className="text-right px-4 py-3 text-xs font-semibold text-navy uppercase tracking-wide whitespace-nowrap">
                      {col.name}
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-600 uppercase tracking-wide">€ Zuschlag</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const ruleMap = new Map(row.byRule.map(r => [r.ruleId, r]))
                  const totalEuros = row.byRule.reduce((s, r) => s + r.euros, 0)
                  return (
                    <tr key={row.employeeId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-5 py-3 font-medium text-navy sticky left-0 bg-inherit">{row.employeeName}</td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs">{minutesToHours(row.totalWorkedMinutes)}</td>
                      {ruleColumns.map(col => {
                        const r = ruleMap.get(col.id)
                        return (
                          <td key={col.id} className="px-4 py-3 text-right">
                            {r ? (
                              <div>
                                <div className="font-semibold text-navy">{minutesToHours(r.minutes)}</div>
                                {r.euros > 0 && <div className="text-[10px] text-emerald-600">{formatEuros(r.euros)}</div>}
                              </div>
                            ) : (
                              <span className="text-gray-200">–</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                        {totalEuros > 0 ? formatEuros(totalEuros) : <span className="text-gray-300">–</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {hasAny && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td className="px-5 py-3 text-xs font-bold text-gray-600 uppercase">Gesamt</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-gray-500">{minutesToHours(totalWorked)}</td>
                    {ruleColumns.map(col => {
                      const t = ruleColTotals.get(col.id)
                      return (
                        <td key={col.id} className="px-4 py-3 text-right">
                          <div className="text-xs font-bold text-navy">{t ? minutesToHours(t.minutes) : '–'}</div>
                          {t && t.euros > 0 && <div className="text-[10px] text-emerald-600 font-semibold">{formatEuros(t.euros)}</div>}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-right text-xs font-bold text-emerald-700">
                      {formatEuros(Array.from(ruleColTotals.values()).reduce((s, t) => s + t.euros, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-gray-400">
        Grundlage: konfigurierte Zuschlagsregeln · Feiertage nach Bundesland ({bundesland ?? 'nicht ermittelt'}) · Kategorien können sich überlappen.
      </p>
    </div>
  )
}

// ── Tab: Konfiguration ──────────────────────────────────────────────────────

const EMPTY_RULE: Omit<ConfiguredSurchargeRule, 'id' | 'isActive' | 'sortOrder'> = {
  name: '',
  type: 'night',
  rateType: 'percent',
  rateValue: 0,
  daysOfWeek: [],
  includeHolidays: false,
  excludeHolidays: false,
  priority: 0,
  roundingMinutes: 0,
}

function KonfigurationTab() {
  const [ruleSet, setRuleSet] = useState<RuleSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [editRule, setEditRule] = useState<ConfiguredSurchargeRule | Omit<ConfiguredSurchargeRule, 'id' | 'isActive' | 'sortOrder'> | null>(null)
  const [editWage, setEditWage] = useState(false)
  const [wageInput, setWageInput] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const d = await fetch('/api/surcharge-rules').then(r => r.json())
    setRuleSet(d.ruleSet ?? null)
    if (d.ruleSet?.defaultHourlyWage) setWageInput(String(d.ruleSet.defaultHourlyWage))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveWage() {
    setSaving(true)
    await fetch('/api/surcharge-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultHourlyWage: wageInput ? parseFloat(wageInput) : null }),
    })
    await load()
    setEditWage(false)
    setSaving(false)
  }

  async function deleteRule(ruleId: string) {
    if (!confirm('Regel löschen?')) return
    await fetch(`/api/surcharge-rules?ruleId=${ruleId}`, { method: 'DELETE' })
    await load()
  }

  async function toggleActive(rule: ConfiguredSurchargeRule) {
    const rules = (ruleSet?.rules ?? []).map(r =>
      r.id === rule.id ? { ...r, isActive: !r.isActive } : r
    )
    await fetch('/api/surcharge-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules }),
    })
    await load()
  }

  async function saveRule(rule: typeof editRule) {
    if (!rule) return
    setSaving(true)
    const existing = ruleSet?.rules ?? []
    let rules: ConfiguredSurchargeRule[]
    if ('id' in rule) {
      rules = existing.map(r => r.id === rule.id ? rule as ConfiguredSurchargeRule : r)
    } else {
      rules = [...existing, { ...rule, id: '', isActive: true, sortOrder: existing.length } as ConfiguredSurchargeRule]
    }
    await fetch('/api/surcharge-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules }),
    })
    await load()
    setEditRule(null)
    setSaving(false)
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-navy border-t-brand rounded-full animate-spin" />
    </div>
  )

  const rules = ruleSet?.rules ?? []

  return (
    <div className="space-y-6">
      {/* Default wage */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-navy">Standard-Stundenlohn</h3>
            <p className="text-xs text-gray-500 mt-0.5">Wird für die Euro-Berechnung der prozentualen Zuschläge verwendet, falls kein mitarbeiterspezifischer Lohn hinterlegt ist.</p>
          </div>
          {!editWage && (
            <button onClick={() => setEditWage(true)} className="text-xs text-brand hover:underline flex items-center gap-1">
              <Edit2 className="w-3 h-3" /> Bearbeiten
            </button>
          )}
        </div>
        {editWage ? (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number" step="0.01" min="0"
                value={wageInput}
                onChange={e => setWageInput(e.target.value)}
                placeholder="z.B. 16.50"
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm w-40 focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <button onClick={saveWage} disabled={saving} className="px-4 py-2 bg-navy text-white text-sm rounded-xl hover:bg-navy/90 disabled:opacity-50 transition-colors">
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
            <button onClick={() => setEditWage(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
              Abbrechen
            </button>
          </div>
        ) : (
          <div className="text-2xl font-bold text-navy">
            {ruleSet?.defaultHourlyWage ? `${ruleSet.defaultHourlyWage.toFixed(2)} €/h` : <span className="text-gray-300 text-base">Nicht hinterlegt</span>}
          </div>
        )}
      </Card>

      {/* Rules list */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-navy">Zuschlagsregeln ({rules.length})</h3>
          <button
            onClick={() => setEditRule({ ...EMPTY_RULE })}
            className="flex items-center gap-1.5 text-xs bg-navy text-white px-3 py-1.5 rounded-lg hover:bg-navy/90 transition-colors"
          >
            <Plus className="w-3 h-3" /> Neue Regel
          </button>
        </div>

        {rules.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">Noch keine Regeln konfiguriert.</p>
            <p className="text-xs text-gray-300 mt-1">Nutzen Sie den <strong>KI-Einrichtung</strong>-Tab für eine geführte Einrichtung.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {rules.map(rule => (
              <div key={rule.id} className={`flex items-center gap-4 px-5 py-3.5 ${!rule.isActive ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RULE_TYPE_COLORS[rule.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {RULE_TYPE_LABELS[rule.type] ?? rule.type}
                    </span>
                    <span className="font-medium text-sm text-navy truncate">{rule.name}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                    <span className="font-semibold text-brand">{rateDisplay(rule)}</span>
                    {rule.timeStart && rule.timeEnd && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{rule.timeStart}–{rule.timeEnd}</span>
                    )}
                    {rule.daysOfWeek.length > 0 && (
                      <span>{rule.daysOfWeek.map(d => ['So','Mo','Di','Mi','Do','Fr','Sa'][d]).join(', ')}</span>
                    )}
                    {rule.includeHolidays && <span className="text-red-400">Nur Feiertage</span>}
                    {rule.excludeHolidays && <span className="text-gray-400">Keine Feiertage</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(rule)}
                    className={`w-9 h-5 rounded-full transition-colors ${rule.isActive ? 'bg-navy' : 'bg-gray-200'}`}
                    title={rule.isActive ? 'Deaktivieren' : 'Aktivieren'}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full mx-auto transition-transform ${rule.isActive ? 'translate-x-2' : '-translate-x-2'}`} />
                  </button>
                  <button onClick={() => setEditRule(rule)} className="p-1.5 text-gray-400 hover:text-navy hover:bg-gray-100 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteRule(rule.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Rule edit modal */}
      {editRule && (
        <RuleEditModal
          rule={editRule}
          saving={saving}
          onSave={saveRule}
          onClose={() => setEditRule(null)}
        />
      )}
    </div>
  )
}

// ── Rule edit modal ─────────────────────────────────────────────────────────

function RuleEditModal({
  rule: initialRule,
  saving,
  onSave,
  onClose,
}: {
  rule: ConfiguredSurchargeRule | Omit<ConfiguredSurchargeRule, 'id' | 'isActive' | 'sortOrder'>
  saving: boolean
  onSave: (r: typeof initialRule) => void
  onClose: () => void
}) {
  const [rule, setRule] = useState(initialRule)
  const set = (patch: Partial<typeof rule>) => setRule(r => ({ ...r, ...patch }))

  const DOW_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

  function toggleDay(d: number) {
    const days = (rule.daysOfWeek ?? []) as number[]
    set({ daysOfWeek: days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort() })
  }

  const isNew = !('id' in rule)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-navy">{isNew ? 'Neue Regel' : 'Regel bearbeiten'}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Bezeichnung *</label>
            <input
              value={rule.name} onChange={e => set({ name: e.target.value })}
              placeholder="z.B. Nachtzuschlag"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Kategorie *</label>
            <select
              value={rule.type} onChange={e => set({ type: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              {Object.entries(RULE_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* Rate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Berechnungsart *</label>
              <select
                value={rule.rateType} onChange={e => set({ rateType: e.target.value as ConfiguredSurchargeRule['rateType'] })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="percent">% auf Stundenlohn</option>
                <option value="fixed_per_hour">€ pro Stunde</option>
                <option value="fixed_per_shift">€ pro Dienst</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Wert * {rule.rateType === 'percent' ? '(%)' : '(€)'}
              </label>
              <input
                type="number" step="0.01" min="0"
                value={rule.rateValue || ''}
                onChange={e => set({ rateValue: parseFloat(e.target.value) || 0 })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>

          {/* Time window */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Startzeit (HH:MM)</label>
              <input
                type="time" value={rule.timeStart ?? ''}
                onChange={e => set({ timeStart: e.target.value || undefined })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Endzeit (HH:MM)</label>
              <input
                type="time" value={rule.timeEnd ?? ''}
                onChange={e => set({ timeEnd: e.target.value || undefined })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>

          {/* Days of week */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Wochentage (leer = alle)</label>
            <div className="flex gap-1.5 flex-wrap">
              {DOW_LABELS.map((l, d) => {
                const selected = (rule.daysOfWeek as number[]).includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`w-10 h-8 rounded-lg text-xs font-semibold transition-colors ${selected ? 'bg-navy text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {l}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Holiday flags */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox" checked={rule.includeHolidays}
                onChange={e => set({ includeHolidays: e.target.checked, excludeHolidays: e.target.checked ? false : rule.excludeHolidays })}
                className="rounded"
              />
              Nur an Feiertagen
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox" checked={rule.excludeHolidays}
                onChange={e => set({ excludeHolidays: e.target.checked, includeHolidays: e.target.checked ? false : rule.includeHolidays })}
                className="rounded"
              />
              Nicht an Feiertagen
            </label>
          </div>

          {/* Priority + rounding */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Priorität (0 = niedrig)</label>
              <input
                type="number" min="0" step="1"
                value={rule.priority}
                onChange={e => set({ priority: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Rundung (Min., 0 = keine)</label>
              <input
                type="number" min="0" step="1"
                value={rule.roundingMinutes}
                onChange={e => set({ roundingMinutes: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>

          {/* Max minutes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Max. Minuten pro Dienst (leer = unbegrenzt)</label>
            <input
              type="number" min="0" step="1"
              value={rule.maxMinutesPerDay ?? ''}
              onChange={e => set({ maxMinutesPerDay: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={() => onSave(rule)}
            disabled={saving || !rule.name || !rule.rateValue}
            className="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-medium hover:bg-navy/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tab: KI-Einrichtung ─────────────────────────────────────────────────────

type ApiMessage = { role: 'user' | 'assistant'; content: Anthropic.Messages.ContentBlock[] | string }

function KIEinrichtungTab() {
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [apiMessages, setApiMessages] = useState<ApiMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [rulesCount, setRulesCount] = useState(0)
  const [started, setStarted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  async function start() {
    setStarted(true)
    await sendToApi([], [])
  }

  async function sendToApi(
    currentApiMsgs: ApiMessage[],
    currentChat: ChatMessage[],
    userText?: string,
  ) {
    const newApiMsgs: ApiMessage[] = userText
      ? [...currentApiMsgs, { role: 'user', content: userText }]
      : currentApiMsgs

    if (userText) {
      const newChat: ChatMessage[] = [...currentChat, { role: 'user', displayText: userText }]
      setChat(newChat)
      setApiMessages(newApiMsgs)
    }

    setLoading(true)
    try {
      const res = await fetch('/api/ai/surcharge-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newApiMsgs }),
      })
      const data = await res.json()

      const assistantContent = data.content as Anthropic.Messages.ContentBlock[]
      const displayText = extractTextFromContent(assistantContent)

      const newAssistantApiMsg: ApiMessage = { role: 'assistant', content: assistantContent }
      let nextApiMsgs = [...newApiMsgs, newAssistantApiMsg]
      let nextChat = [...(userText ? [...currentChat, { role: 'user' as const, displayText: userText }] : currentChat),
        { role: 'assistant' as const, displayText, rawContent: assistantContent }]

      // If tool was used, append tool_result and continue
      if (data.toolResult) {
        const toolResultMsg: ApiMessage = {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: data.toolResult.toolUseId,
            content: JSON.stringify(data.toolResult.result),
          }] as unknown as Anthropic.Messages.ContentBlock[],
        }
        nextApiMsgs = [...nextApiMsgs, toolResultMsg]
        setApiMessages(nextApiMsgs)
        setChat(nextChat)

        // Continue conversation with tool result
        const res2 = await fetch('/api/ai/surcharge-onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: nextApiMsgs }),
        })
        const data2 = await res2.json()
        const content2 = data2.content as Anthropic.Messages.ContentBlock[]
        const text2 = extractTextFromContent(content2)
        nextApiMsgs = [...nextApiMsgs, { role: 'assistant', content: content2 }]
        nextChat = [...nextChat, { role: 'assistant', displayText: text2, rawContent: content2 }]

        if (data.completed) {
          setCompleted(true)
          setRulesCount(data.rulesCount ?? 0)
        }
      }

      setApiMessages(nextApiMsgs)
      setChat(nextChat)
    } catch {
      setChat(c => [...c, { role: 'assistant', displayText: 'Fehler bei der Kommunikation mit dem Assistenten. Bitte versuchen Sie es erneut.' }])
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    await sendToApi(apiMessages, chat, text)
  }

  if (!started) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-6">
        <div className="w-16 h-16 bg-navy/10 rounded-2xl flex items-center justify-center mx-auto">
          <Bot className="w-8 h-8 text-navy" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-navy">KI-gestützte Regeleinrichtung</h3>
          <p className="text-sm text-gray-500 mt-2">
            Der Assistent hilft Ihnen dabei, Ihre Zuschlagsregeln Schritt für Schritt zu erfassen.
            Er fragt gezielt nach, wenn Informationen fehlen, und speichert die Regeln erst nach Ihrer ausdrücklichen Bestätigung.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 text-left">
          <strong>Hinweis:</strong> Der Assistent erfindet keine Prozentsätze oder Tarifvorgaben. Er erfasst ausschließlich, was Sie ihm mitteilen.
        </div>
        <button
          onClick={start}
          className="px-8 py-3 bg-navy text-white rounded-xl font-medium hover:bg-navy/90 transition-colors"
        >
          Einrichtung starten
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 260px)', minHeight: 400 }}>
      {completed && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span><strong>{rulesCount} Regel{rulesCount !== 1 ? 'n' : ''}</strong> wurden erfolgreich gespeichert. Sie können die Regeln im Tab <strong>Konfiguration</strong> anpassen.</span>
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {chat.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 bg-navy/10 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                <Bot className="w-4 h-4 text-navy" />
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-navy text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}
            >
              {msg.displayText}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 bg-navy/10 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1">
              <Bot className="w-4 h-4 text-navy" />
            </div>
            <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!completed && (
        <div className="mt-4 flex gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Antwort eingeben…"
            disabled={loading}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-3 bg-navy text-white rounded-xl hover:bg-navy/90 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

type Tab = 'berechnung' | 'konfiguration' | 'ki'

const TABS: { id: Tab; label: string; icon: typeof Euro }[] = [
  { id: 'berechnung', label: 'Berechnung', icon: Euro },
  { id: 'konfiguration', label: 'Konfiguration', icon: Settings },
  { id: 'ki', label: 'KI-Einrichtung', icon: Bot },
]

export default function SurchargesPage() {
  const [tab, setTab] = useState<Tab>('berechnung')

  return (
    <DashboardLayout requiredRole="admin">
      <Header title="Zuschlags-Engine" subtitle="Zuschlagsberechnung und Regelkonfiguration" />

      <div className="p-4 sm:p-6">
        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-white text-navy shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'berechnung' && <BerechnungTab />}
        {tab === 'konfiguration' && <KonfigurationTab />}
        {tab === 'ki' && <KIEinrichtungTab />}
      </div>
    </DashboardLayout>
  )
}
