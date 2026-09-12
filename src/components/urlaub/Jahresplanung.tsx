'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { FeatureIntro } from '@/components/onboarding/FeatureIntro'
import { VacationRulesChat } from '@/components/vacation/VacationRulesChat'
import { EmptyState } from '@/components/ui/EmptyState'
import { SCHOOL_HOLIDAYS_2026 } from '@/lib/school-holidays'
import { formatDate, sanitizeAiText } from '@/lib/utils'
import type { VacationPlanEntry, VacationPlanSummary, VacationPlanConflict, VacationRules, VacationPlanPreference, Employee, Location } from '@/lib/types'
import type { VacationRulesDraft } from '@/lib/vacation-rules-draft'
import {
  Sparkles, Loader, CheckCircle, AlertTriangle, Baby, Palmtree,
  Calendar, Info, Download, Clock, MessageCircle, Send, PartyPopper,
} from 'lucide-react'

const DEFAULT_RULES = (employeeCount: number): VacationRules => ({
  facilityDescription: `Wir sind eine Kita mit 6 Gruppen. Jede Gruppe muss immer mit mindestens 1 Fachkraft besetzt sein. Wir haben 2 Etagen mit je 3 Gruppen, maximal 2 Mitarbeiter pro Etage dürfen gleichzeitig Urlaub haben. Gesamtteam: ${employeeCount} Mitarbeiter.`,
  maxConcurrent: 2,
  customRules: [],
  schoolHolidayPriorityMode: 'slight',
})

const SCHOOL_HOLIDAY_MODE_LABEL: Record<VacationRules['schoolHolidayPriorityMode'], string> = {
  always: 'Immer priorisieren',
  slight: 'Nur leicht bevorzugen',
  none: 'Keine Priorisierung',
}

const GERMAN_STATES = ['Berlin', 'Bayern', 'Hamburg', 'Baden-Württemberg', 'Nordrhein-Westfalen', 'Hessen', 'Niedersachsen', 'Sachsen']
const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const PRIORITY_LABEL: Record<string, string> = { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' }
const PRIORITY_COLOR: Record<string, string> = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-gray-100 text-gray-500' }

interface PrefRow {
  employeeId: string
  hasChildren: boolean
  schoolHolidayPriority: 'low' | 'medium' | 'high'
  preferredMonths: number[]
  preferredPeriod: string
  notes: string
  priority: 'low' | 'medium' | 'high'
}

const AI_STEPS = [
  'Analysiere Standortregeln...',
  'Prüfe Schulferienzeiten...',
  'Berücksichtige Mitarbeiter-Wünsche...',
  'Berechne Mindestbesetzung...',
  'Optimiere Fairness...',
  'Finalisiere Urlaubsplan...',
]

export function Jahresplanung() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [EMPLOYEES, setEMPLOYEES] = useState<Employee[]>([])
  const [LOCATIONS, setLOCATIONS] = useState<Location[]>([])

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEMPLOYEES(d.employees))
    fetch('/api/locations').then(r => r.json()).then(d => setLOCATIONS(d.locations))
  }, [])

  const locationId = user?.locationId
  const location = LOCATIONS.find(l => l.id === locationId)

  const employees = EMPLOYEES.filter(e => e.locationId === locationId && e.role === 'employee')

  const [rules, setRules] = useState<VacationRules>(DEFAULT_RULES(employees.length))
  const [rulesChatOpen, setRulesChatOpen] = useState(false)

  useEffect(() => {
    if (!locationId) return
    fetch(`/api/vacation-rules?locationId=${locationId}`)
      .then(r => r.json())
      .then(d => setRules(d.rules ?? DEFAULT_RULES(employees.length)))
      .catch(() => setRules(DEFAULT_RULES(employees.length)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId])

  const handleSaveRules = async (draft: VacationRulesDraft) => {
    const next: VacationRules = {
      facilityDescription: draft.facilityDescription || rules.facilityDescription,
      maxConcurrent: draft.maxConcurrent ?? rules.maxConcurrent,
      customRules: draft.customRules ?? rules.customRules,
      schoolHolidayPriorityMode: draft.schoolHolidayPriorityMode ?? rules.schoolHolidayPriorityMode,
    }
    setRules(next)
    await fetch('/api/vacation-rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, rules: next }),
    })
    showToast('Urlaubsregeln gespeichert – gelten für alle künftigen Planungen')
  }

  const handleSchoolHolidayModeChange = (mode: VacationRules['schoolHolidayPriorityMode']) => {
    const next = { ...rules, schoolHolidayPriorityMode: mode }
    setRules(next)
    fetch('/api/vacation-rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, rules: next }),
    }).catch(() => {})
  }

  const [collectingWishes, setCollectingWishes] = useState(false)

  const handleCollectWishes = async () => {
    setCollectingWishes(true)
    try {
      const res = await fetch('/api/vacation-plan/collect-wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId }),
      })
      const data = await res.json()
      showToast(`${data.notified ?? employees.length} Mitarbeiter wurden benachrichtigt, ihre Urlaubswünsche einzutragen`)
    } catch {
      showToast('Benachrichtigung konnte nicht versendet werden', 'error')
    } finally {
      setCollectingWishes(false)
    }
  }

  const [planningStart, setPlanningStart] = useState('2026-06-01')
  const [planningEnd, setPlanningEnd] = useState('2026-09-30')
  const [selectedState, setSelectedState] = useState(location?.state ?? 'Berlin')

  const [vacationPreferences, setVacationPreferences] = useState<VacationPlanPreference[]>([])

  useEffect(() => {
    fetch('/api/vacation-preferences')
      .then(r => r.json())
      .then(d => setVacationPreferences(d.preferences ?? []))
      .catch(() => setVacationPreferences([]))
  }, [])

  const [prefs, setPrefs] = useState<PrefRow[]>([])

  useEffect(() => {
    setPrefs(employees.map(emp => {
      const pref = vacationPreferences.find(p => p.employeeId === emp.id)
      return {
        employeeId: emp.id,
        hasChildren: emp.hasChildren ?? false,
        schoolHolidayPriority: pref?.schoolHolidayPriority ?? 'medium',
        preferredMonths: pref?.preferredMonths ?? [7, 8],
        preferredPeriod: pref?.preferredPeriod ?? '',
        notes: pref?.notes ?? '',
        priority: pref?.priority ?? 'medium',
      }
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees.length, vacationPreferences])

  const [aiRunning, setAiRunning] = useState(false)
  const [aiStep, setAiStep] = useState(0)
  const [generatedPlan, setGeneratedPlan] = useState<VacationPlanEntry[] | null>(null)
  const [reasoning, setReasoning] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [summary, setSummary] = useState<VacationPlanSummary | null>(null)
  const [conflicts, setConflicts] = useState<VacationPlanConflict[]>([])
  const [aiError, setAiError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)

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
    setSummary(null)
    setConflicts([])
    setPublished(false)

    let step = 0
    const interval = setInterval(() => {
      step = Math.min(step + 1, AI_STEPS.length - 2)
      setAiStep(step)
    }, 900)

    try {
      const payload = {
        facilityDescription: rules.facilityDescription,
        customRules: rules.customRules,
        planningStart,
        planningEnd,
        maxConcurrent: rules.maxConcurrent,
        schoolHolidayPriorityMode: rules.schoolHolidayPriorityMode,
        state: selectedState,
        employees: prefs.map(p => {
          const emp = employees.find(e => e.id === p.employeeId)!
          return {
            id: emp.id,
            name: emp.name,
            hasChildren: p.hasChildren,
            schoolHolidayPriority: p.hasChildren ? p.schoolHolidayPriority : undefined,
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
      setReasoning(data.reasoning ? sanitizeAiText(data.reasoning) : null)
      setWarnings((data.warnings ?? []).map((w: string) => sanitizeAiText(w)))
      setSummary(data.summary ?? null)
      setConflicts((data.conflicts ?? []).map((c: VacationPlanConflict) => ({ ...c, reasoning: sanitizeAiText(c.reasoning) })))
    } catch (err: unknown) {
      clearInterval(interval)
      setAiError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setAiRunning(false)
    }
  }

  const handlePublish = async () => {
    if (!generatedPlan) return
    setPublishing(true)
    try {
      const createdRequests = await fetch('/api/vacation-plan/publish-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, locationName: location?.name ?? 'Standort', entries: generatedPlan }),
      }).then(r => r.json()).then(d => d.requests)
      setPublished(true)
      showToast('Urlaubsplan freigegeben – Mitarbeiter werden benachrichtigt')
      await fetch('/api/vacation-plan/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: createdRequests, conflicts, locationId }),
      })
    } catch {
      // Benachrichtigungen sind ein Zusatznutzen – ein Fehler hier darf die Freigabe nicht blockieren.
    } finally {
      setPublishing(false)
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

  if (!locationId) {
    return (
      <>
        
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={AlertTriangle}
            title="Dein Account ist noch keinem Standort zugeordnet"
            description="Ein OKUN-Administrator muss deinen Account einmalig einem Standort zuordnen, bevor hier ein Urlaubsplan erstellt werden kann. Bitte wende dich an die OKUN-Plattformverwaltung."
          />
        </div>
      </>
    )
  }

  return (
    <>
      
      <div className="p-4 sm:p-6 space-y-4">
        <FeatureIntro
          featureKey="admin-vacation-plan"
          text="Hier erstellen Sie zunächst die Jahresurlaubsplanung. Einzelne Urlaubsanträge während des Jahres werden später separat bearbeitet."
        />

        {/* Intro */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
          <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Beschreibe deinen Standort und setze Regeln. Die KI plant den Urlaub fair ein – mit Priorität für Mitarbeiter mit Kindern in Schulferienzeiten.
          </p>
        </div>

        {/* ── REGELWERK ─────────────────────────────────────────────── */}
        <Card>
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-sm font-bold text-navy flex items-center gap-2">
              <Calendar size={15} className="text-purple-500" />
              Planungsregeln
            </p>
            <Button variant="ghost" size="sm" onClick={() => setRulesChatOpen(true)} className="gap-1.5 text-purple-700">
              <MessageCircle size={14} />Regeln per KI-Chat bearbeiten
            </Button>
          </div>

          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-purple-700 mb-1">Standortbeschreibung & Besetzungsregeln</p>
              <p className="text-sm text-purple-900">{rules.facilityDescription}</p>
              <p className="text-xs text-purple-700 mt-2">Maximal <span className="font-bold">{rules.maxConcurrent}</span> Mitarbeiter gleichzeitig im Urlaub.</p>
              {rules.customRules.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {rules.customRules.map((r, i) => (
                    <span key={i} className="text-xs bg-white text-purple-800 px-2 py-1 rounded-lg border border-purple-200">{r}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1.5 flex items-center gap-1.5">
                <Baby size={13} />Ferienregelung für Mitarbeiter mit schulpflichtigen Kindern
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(SCHOOL_HOLIDAY_MODE_LABEL) as VacationRules['schoolHolidayPriorityMode'][]).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleSchoolHolidayModeChange(mode)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all ${rules.schoolHolidayPriorityMode === mode ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-100'}`}
                  >
                    {SCHOOL_HOLIDAY_MODE_LABEL[mode]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Input
                type="date"
                label="Planung von"
                value={planningStart}
                onChange={e => setPlanningStart(e.target.value)}
              />
              <Input
                type="date"
                label="Planung bis"
                value={planningEnd}
                onChange={e => setPlanningEnd(e.target.value)}
              />
              <Select
                label="Bundesland (Ferien)"
                value={selectedState}
                onChange={e => setSelectedState(e.target.value)}
                hint="Automatisch aus dem Bundesland des Standorts übernommen."
              >
                {GERMAN_STATES.map(s => <option key={s}>{s}</option>)}
              </Select>
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
          <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
            <p className="text-sm font-bold text-navy flex items-center gap-2">
              <Palmtree size={15} className="text-green-500" />
              Wünsche der Mitarbeiter
            </p>
            <Button variant="ghost" size="sm" loading={collectingWishes} onClick={handleCollectWishes} className="gap-1.5 text-green-700 border border-gray-200">
              <Send size={14} />Wünsche einsammeln
            </Button>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Mitarbeiter werden benachrichtigt und tragen ihre Wünsche selbst im Mitarbeiterportal ein. Du kannst die Angaben hier bei Bedarf anpassen.
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
                      <Select
                        value={pref.priority}
                        onChange={e => updatePref(pref.employeeId, 'priority', e.target.value)}
                      >
                        <option value="high">Prio: Hoch</option>
                        <option value="medium">Prio: Mittel</option>
                        <option value="low">Prio: Niedrig</option>
                      </Select>
                    </div>
                  </div>

                  {pref.hasChildren && (
                    <div>
                      <Select
                        label="Priorität Schulferien:"
                        value={pref.schoolHolidayPriority}
                        onChange={e => updatePref(pref.employeeId, 'schoolHolidayPriority', e.target.value)}
                      >
                        <option value="high">Hoch</option>
                        <option value="medium">Mittel</option>
                        <option value="low">Niedrig</option>
                      </Select>
                    </div>
                  )}

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

                  <Input
                    value={pref.notes}
                    onChange={e => updatePref(pref.employeeId, 'notes', e.target.value)}
                    placeholder="Notiz / Begründung (optional)"
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
                <p className="text-sm text-gray-600">Die KI plant fair und regelkonform – unter Berücksichtigung deiner Standortregeln und aller Mitarbeiterwünsche.</p>
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
          ) : published ? (
            <div className="flex items-center gap-3">
              <PartyPopper size={24} className="text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-green-700">Urlaubsplan freigegeben!</p>
                <p className="text-sm text-green-600">Alle Mitarbeiter wurden über ihren genehmigten Urlaub benachrichtigt.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={exportPlan} className="gap-1.5 border border-green-300">
                <Download size={14} />Exportieren
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <CheckCircle size={24} className="text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-green-700">KI-Urlaubsplan erstellt!</p>
                <p className="text-sm text-green-600">Alle Regeln eingehalten · Schulferien berücksichtigt · Fairness optimiert.</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" loading={publishing} onClick={handlePublish} className="gap-1.5">
                  <Send size={14} />Freigeben
                </Button>
                <Button variant="ghost" size="sm" onClick={exportPlan} className="gap-1.5 border border-green-300">
                  <Download size={14} />Exportieren
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setGeneratedPlan(null); setReasoning(null); setWarnings([]); setSummary(null); setConflicts([]); setPublished(false) }} className="text-gray-500">
                  Neu planen
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── GENERATED PLAN ────────────────────────────────────────── */}
        {generatedPlan && (
          <div className="space-y-3">
            {summary && (
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-green-700 font-bold text-sm">{summary.fulfillmentPercent}%</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-navy">Qualitätsprüfung</p>
                  <p className="text-xs text-gray-500">{summary.fulfilledCount} von {summary.totalCount} Wünschen vollständig erfüllt.</p>
                </div>
              </div>
            )}

            {conflicts.length > 0 && (
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={15} className="text-orange-600" />
                  <p className="text-sm font-bold text-orange-800">Konflikte & Priorisierung</p>
                </div>
                <div className="space-y-2">
                  {conflicts.map((c, i) => (
                    <div key={i} className="text-sm text-orange-700">
                      <span className="font-semibold">{c.employeeNames.join(', ')}: </span>{c.reasoning}
                    </div>
                  ))}
                </div>
              </div>
            )}

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

      <VacationRulesChat
        open={rulesChatOpen}
        onClose={() => setRulesChatOpen(false)}
        initialDraft={{ ...rules, readyToSave: true, confirmed: true }}
        onSave={handleSaveRules}
      />
    </>
  )
}

