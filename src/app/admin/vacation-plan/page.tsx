'use client'

import { useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import {
  EMPLOYEES, LOCATIONS, VACATION_PREFERENCES, SCHOOL_HOLIDAYS_2026,
} from '@/lib/mock-data'
import { formatDate } from '@/lib/utils'
import type { VacationPlanEntry } from '@/lib/types'
import {
  Sparkles, Loader, CheckCircle, AlertTriangle, Baby, Palmtree,
  Calendar, Info, Download, Clock,
} from 'lucide-react'

const GERMAN_STATES = ['Berlin', 'Bayern', 'Hamburg', 'Baden-Württemberg', 'Nordrhein-Westfalen', 'Hessen', 'Niedersachsen', 'Sachsen']
const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const PRIORITY_LABEL: Record<string, string> = { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' }
const PRIORITY_COLOR: Record<string, string> = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-gray-100 text-gray-500' }

interface PrefRow {
  employeeId: string
  hasChildren: boolean
  preferredMonths: number[]
  preferredPeriod: string
  notes: string
  priority: 'low' | 'medium' | 'high'
}

const AI_STEPS = [
  'Analysiere Einrichtungsregeln...',
  'Prüfe Schulferienzeiten...',
  'Berücksichtige Mitarbeiter-Wünsche...',
  'Berechne Mindestbesetzung...',
  'Optimiere Fairness...',
  'Finalisiere Urlaubsplan...',
]

export default function VacationPlanPage() {
  const { user } = useAuth()
  const locationId = user?.locationId ?? 'loc1'
  const location = LOCATIONS.find(l => l.id === locationId)

  const employees = EMPLOYEES.filter(e => e.locationId === locationId && e.role === 'employee')

  const [facilityDescription, setFacilityDescription] = useState(
    `Wir sind eine Kita mit 6 Gruppen. Jede Gruppe muss immer mit mindestens 1 Fachkraft besetzt sein. Wir haben 2 Etagen mit je 3 Gruppen, maximal 2 Mitarbeiter pro Etage dürfen gleichzeitig Urlaub haben. Gesamtteam: ${employees.length} Mitarbeiter.`
  )
  const [planningStart, setPlanningStart] = useState('2026-06-01')
  const [planningEnd, setPlanningEnd] = useState('2026-09-30')
  const [maxConcurrent, setMaxConcurrent] = useState(2)
  const [selectedState, setSelectedState] = useState('Berlin')

  const [prefs, setPrefs] = useState<PrefRow[]>(() =>
    employees.map(emp => {
      const pref = VACATION_PREFERENCES.find(p => p.employeeId === emp.id)
      return {
        employeeId: emp.id,
        hasChildren: emp.hasChildren ?? false,
        preferredMonths: pref?.preferredMonths ?? [7, 8],
        preferredPeriod: pref?.preferredPeriod ?? '',
        notes: pref?.notes ?? '',
        priority: pref?.priority ?? 'medium',
      }
    })
  )

  const [aiRunning, setAiRunning] = useState(false)
  const [aiStep, setAiStep] = useState(0)
  const [generatedPlan, setGeneratedPlan] = useState<VacationPlanEntry[] | null>(null)
  const [reasoning, setReasoning] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [aiError, setAiError] = useState<string | null>(null)

  const schoolHolidays = useMemo(
    () => SCHOOL_HOLIDAYS_2026.filter(h => h.state === selectedState),
    [selectedState]
  )

  const updatePref = (empId: string, field: keyof PrefRow, value: unknown) => {
    setPrefs(prev => prev.map(p => p.employeeId === empId ? { ...p, [field]: value } : p))
  }

  const toggleMonth = (empId: string, month: number) => {
    setPrefs(prev => prev.map(p => {
      if (p.employeeId !== empId) return p
      const months = p.preferredMonths.includes(month)
        ? p.preferredMonths.filter(m => m !== month)
        : [...p.preferredMonths, month]
      return { ...p, preferredMonths: months }
    }))
  }

  const runAI = async () => {
    setAiRunning(true)
    setAiStep(0)
    setAiError(null)
    setGeneratedPlan(null)
    setReasoning(null)
    setWarnings([])

    let step = 0
    const interval = setInterval(() => {
      step = Math.min(step + 1, AI_STEPS.length - 2)
      setAiStep(step)
    }, 900)

    try {
      const payload = {
        facilityDescription,
        planningStart,
        planningEnd,
        maxConcurrent,
        state: selectedState,
        employees: prefs.map(p => {
          const emp = employees.find(e => e.id === p.employeeId)!
          return {
            id: emp.id,
            name: emp.name,
            hasChildren: p.hasChildren,
            remainingDays: emp.vacationDaysTotal - emp.vacationDaysUsed,
            preferredMonths: p.preferredMonths,
            preferredPeriod: p.preferredPeriod,
            notes: p.notes,
            priority: p.priority,
          }
        }),
        schoolHolidays,
      }

      const res = await fetch('/api/ai/vacation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      clearInterval(interval)
      setAiStep(AI_STEPS.length - 1)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error ?? 'API-Fehler')
      }

      const data = await res.json()
      setGeneratedPlan(data.plan ?? [])
      setReasoning(data.reasoning ?? null)
      setWarnings(data.warnings ?? [])
    } catch (err: unknown) {
      clearInterval(interval)
      setAiError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setAiRunning(false)
    }
  }

  const exportPlan = () => {
    if (!generatedPlan) return
    const lines = [`KI-Urlaubsplan – ${location?.name ?? 'Standort'}`, `Zeitraum: ${planningStart} bis ${planningEnd}`, '']
    generatedPlan.forEach(entry => {
      lines.push(`${entry.employeeName}:`)
      entry.slots.forEach(s => lines.push(`  ${formatDate(s.startDate)} – ${formatDate(s.endDate)} (${s.days} Tage)`))
      if (entry.note) lines.push(`  Hinweis: ${entry.note}`)
      lines.push('')
    })
    if (reasoning) { lines.push('Begründung:'); lines.push(reasoning) }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `urlaubsplan_${location?.name?.replace(/\s/g, '_')}_${planningStart.slice(0, 7)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Header title="KI-Urlaubsplan" subtitle={`${location?.name} · KI-gestützte Planung`} />
      <div className="p-4 sm:p-6 space-y-4">

        {/* Intro */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
          <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Beschreibe deine Einrichtung und setze Regeln. Die KI plant den Urlaub fair ein – mit Priorität für Mitarbeiter mit Kindern in Schulferienzeiten.
          </p>
        </div>

        {/* ── REGELWERK ─────────────────────────────────────────────── */}
        <Card>
          <p className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
            <Calendar size={15} className="text-purple-500" />
            Planungsregeln
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Einrichtungsbeschreibung & besondere Regeln</label>
              <textarea
                value={facilityDescription}
                onChange={e => setFacilityDescription(e.target.value)}
                rows={4}
                placeholder="Beschreibe deine Einrichtung, Gruppenstruktur, Besetzungsregeln, Besonderheiten..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Planung von</label>
                <input type="date" value={planningStart} onChange={e => setPlanningStart(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Planung bis</label>
                <input type="date" value={planningEnd} onChange={e => setPlanningEnd(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Max. gleichzeitig</label>
                <div className="flex items-center gap-2">
                  <input type="range" min={1} max={Math.max(1, employees.length - 1)} value={maxConcurrent}
                    onChange={e => setMaxConcurrent(Number(e.target.value))}
                    className="flex-1 accent-brand" />
                  <span className="text-sm font-bold text-navy w-6 text-center">{maxConcurrent}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Bundesland (Ferien)</label>
                <select value={selectedState} onChange={e => setSelectedState(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand">
                  {GERMAN_STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* School holidays preview */}
            {schoolHolidays.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 mb-2">Schulferien {selectedState} 2026</p>
                <div className="flex flex-wrap gap-2">
                  {schoolHolidays.map(h => (
                    <span key={h.name + h.startDate} className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg font-medium">
                      {h.name}: {formatDate(h.startDate)} – {formatDate(h.endDate)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* ── MITARBEITER-WÜNSCHE ────────────────────────────────────── */}
        <Card>
          <p className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
            <Palmtree size={15} className="text-green-500" />
            Wünsche der Mitarbeiter
          </p>
          <div className="space-y-4">
            {prefs.map(pref => {
              const emp = employees.find(e => e.id === pref.employeeId)!
              return (
                <div key={pref.employeeId} className="border border-gray-100 rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center text-brand text-xs font-bold flex-shrink-0">
                        {emp.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-navy flex items-center gap-1">
                          {emp.name}
                          {pref.hasChildren && <Baby size={12} className="text-blue-400" />}
                        </p>
                        <p className="text-xs text-gray-400">{emp.weeklyHours}h/Wo · {emp.vacationDaysTotal - emp.vacationDaysUsed} Tage Resturlaub</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <div
                          onClick={() => updatePref(pref.employeeId, 'hasChildren', !pref.hasChildren)}
                          className={`relative w-8 h-4 rounded-full transition-colors ${pref.hasChildren ? 'bg-blue-400' : 'bg-gray-300'}`}
                        >
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${pref.hasChildren ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-xs text-gray-500">Hat Kinder</span>
                      </label>
                      <select
                        value={pref.priority}
                        onChange={e => updatePref(pref.employeeId, 'priority', e.target.value)}
                        className="text-xs px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
                      >
                        <option value="high">Prio: Hoch</option>
                        <option value="medium">Prio: Mittel</option>
                        <option value="low">Prio: Niedrig</option>
                      </select>
                    </div>
                  </div>

                  {/* Month preference */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Bevorzugte Monate:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MONTH_NAMES.map((name, i) => {
                        const month = i + 1
                        const selected = pref.preferredMonths.includes(month)
                        return (
                          <button
                            key={month}
                            onClick={() => toggleMonth(pref.employeeId, month)}
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${selected ? 'bg-navy text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >
                            {name}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <input
                    value={pref.notes}
                    onChange={e => updatePref(pref.employeeId, 'notes', e.target.value)}
                    placeholder="Notiz / Begründung (optional)"
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              )
            })}
          </div>
        </Card>

        {/* ── AI PANEL ──────────────────────────────────────────────── */}
        <div className={`rounded-2xl p-5 border-2 transition-all ${generatedPlan ? 'bg-green-50 border-green-200' : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-100'}`}>
          {!aiRunning && !generatedPlan && !aiError ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={18} className="text-purple-600" />
                  <p className="font-bold text-navy">KI-Urlaubsplan erstellen</p>
                </div>
                <p className="text-sm text-gray-600">Die KI plant fair und regelkonform – unter Berücksichtigung deiner Einrichtungsregeln und aller Mitarbeiterwünsche.</p>
              </div>
              <Button onClick={runAI} size="lg" className="gap-2 bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-500 whitespace-nowrap">
                <Sparkles size={18} />
                Plan erstellen
              </Button>
            </div>
          ) : aiRunning ? (
            <div className="text-center py-2">
              <Loader size={28} className="mx-auto text-purple-600 animate-spin mb-3" />
              <p className="text-sm font-semibold text-purple-700">{AI_STEPS[Math.min(aiStep, AI_STEPS.length - 1)]}</p>
              <div className="flex justify-center gap-1 mt-3">
                {AI_STEPS.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all ${i <= aiStep ? 'w-8 bg-purple-500' : 'w-3 bg-purple-200'}`} />
                ))}
              </div>
            </div>
          ) : aiError ? (
            <div className="flex items-center gap-3">
              <AlertTriangle size={24} className="text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-red-700">Fehler</p>
                <p className="text-sm text-red-600">{aiError}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setAiError(null)}>Erneut</Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <CheckCircle size={24} className="text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-green-700">KI-Urlaubsplan erstellt!</p>
                <p className="text-sm text-green-600">Alle Regeln eingehalten · Schulferien berücksichtigt · Fairness optimiert.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={exportPlan} className="gap-1.5 border border-green-300">
                  <Download size={14} />Exportieren
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setGeneratedPlan(null); setReasoning(null); setWarnings([]) }} className="text-gray-500">
                  Neu planen
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── GENERATED PLAN ────────────────────────────────────────── */}
        {generatedPlan && (
          <div className="space-y-3">
            {reasoning && (
              <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={15} className="text-purple-600" />
                  <p className="text-sm font-bold text-purple-800">KI-Begründung</p>
                </div>
                <p className="text-sm text-purple-700">{reasoning}</p>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                {warnings.map((w, i) => (
                  <p key={i} className="text-sm text-amber-700 flex items-start gap-2">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />{w}
                  </p>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {generatedPlan.map(entry => {
                const emp = employees.find(e => e.id === entry.employeeId)
                const pref = prefs.find(p => p.employeeId === entry.employeeId)
                const totalDays = entry.slots.reduce((s, sl) => s + sl.days, 0)
                return (
                  <div key={entry.employeeId} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-navy flex items-center justify-center text-brand text-xs font-bold flex-shrink-0">
                          {entry.employeeName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-semibold text-navy flex items-center gap-1.5">
                            {entry.employeeName}
                            {pref?.hasChildren && <Baby size={12} className="text-blue-400" />}
                          </p>
                          <p className="text-xs text-gray-400">{emp?.position} · {emp?.weeklyHours}h/Wo</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {pref && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_COLOR[pref.priority]}`}>
                            Prio: {PRIORITY_LABEL[pref.priority]}
                          </span>
                        )}
                        <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                          <Palmtree size={11} />{totalDays} Tage gesamt
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {entry.slots.map((slot, i) => (
                        <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                          <Calendar size={13} className="text-gray-400 flex-shrink-0" />
                          <p className="text-sm text-navy font-medium">
                            {formatDate(slot.startDate)} – {formatDate(slot.endDate)}
                          </p>
                          <span className="text-xs text-gray-500 ml-auto">{slot.days} Tage</span>
                        </div>
                      ))}
                    </div>

                    {entry.note && (
                      <p className="text-xs text-gray-500 mt-2 italic flex items-start gap-1.5">
                        <Info size={11} className="flex-shrink-0 mt-0.5" />{entry.note}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
