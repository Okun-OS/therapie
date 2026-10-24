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
import type { VacationPlanEntry, VacationPlanSummary, VacationPlanConflict, VacationRules, VacationRequest, Employee, Location } from '@/lib/types'
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

/**
 * §231 Ein eingereichter Antrag, so wie die Planung ihn braucht.
 *
 * Hier stand `PrefRow`: bevorzugte Monate, ein Freitextzeitraum, eine selbst
 * gesetzte Priorität, eine Notiz. Gefragt wurde, ob das nicht doppelt
 * gemoppelt sei neben den Anträgen. Der Befund war schärfer: Sagen drei Leute
 * „Juli", weiß die Leitung nicht, ob sie kollidieren — und genau das zu sehen
 * ist der Zweck dieser Seite. Ein Antrag trägt Datum, also kann er es.
 */
interface AntragZeile {
  id: string
  employeeId: string
  name: string
  startDate: string
  endDate: string
  days: number
  reason?: string
  status: string
  submittedAt: string
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

  /**
   * §231 Die Frist zum Einreichen — sie ersetzt die Wunschmonate.
   *
   * Das Jahr wird mitgeschrieben: Ohne es wäre nach dem Jahreswechsel nicht
   * zu erkennen, ob eine Frist in der Vergangenheit abgelaufen oder nur alt
   * ist — und die Maske würde jedes Jahr „abgelaufen" melden.
   */
  const handleFristChange = (datum: string) => {
    const next: VacationRules = {
      ...rules,
      antragsfrist: datum || null,
      antragsfristJahr: datum ? Number(datum.slice(0, 4)) : null,
    }
    setRules(next)
    fetch('/api/vacation-rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, rules: next }),
    })
      .then(() => showToast(datum
        ? `Frist gespeichert — Anträge bis ${formatDate(datum)}`
        : 'Frist entfernt'))
      .catch(() => showToast('Die Frist konnte nicht gespeichert werden', 'error'))
  }

  const fristOffen = !!rules.antragsfrist
    && rules.antragsfrist >= new Date().toISOString().slice(0, 10)

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

  const [antraege, setAntraege] = useState<VacationRequest[]>([])

  useEffect(() => {
    if (!locationId) return
    fetch(`/api/vacation-requests?locationId=${locationId}`)
      .then(r => r.json())
      .then(d => setAntraege(d.requests ?? []))
      .catch(() => setAntraege([]))
  }, [locationId])

  /**
   * §231 Die Anträge, die in den Planungszeitraum fallen.
   *
   * Abgelehnte bleiben draußen — über die ist entschieden. Bereits genehmigte
   * bleiben DRIN: Sie stehen und belegen Platz, und ein Plan, der sie
   * übersieht, plant über sie hinweg.
   */
  const zeilen = useMemo<AntragZeile[]>(() => antraege
    .filter(a => a.status !== 'denied')
    .filter(a => a.startDate <= planningEnd && a.endDate >= planningStart)
    .filter(a => employees.some(e => e.id === a.employeeId))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map(a => ({
      id: a.id,
      employeeId: a.employeeId,
      name: a.employeeName,
      startDate: a.startDate,
      endDate: a.endDate,
      days: a.days,
      reason: a.reason,
      status: a.status,
      submittedAt: a.submittedAt,
    })),
    [antraege, planningStart, planningEnd, employees])

  /**
   * §231 Wo sich Anträge überschneiden — die Frage, für die es diese Seite gibt.
   *
   * Gezählt wird Tag für Tag, wie viele Menschen gleichzeitig weg wären, und
   * verglichen mit `maxConcurrent`. Vorher ließ sich das nicht ausrechnen: Aus
   * „Juli" und „Juli" folgt keine Überschneidung, nur ein Verdacht.
   */
  const engstellen = useMemo(() => {
    const belegung = new Map<string, string[]>()
    for (const z of zeilen) {
      for (let t = Date.parse(`${z.startDate}T00:00:00Z`);
        t <= Date.parse(`${z.endDate}T00:00:00Z`); t += 86400000) {
        const tag = new Date(t).toISOString().slice(0, 10)
        if (tag < planningStart || tag > planningEnd) continue
        belegung.set(tag, [...(belegung.get(tag) ?? []), z.name])
      }
    }
    // Zusammenhängende Tage über der Grenze zu einem Zeitraum zusammenfassen —
    // „12.–19.07., drei gleichzeitig" liest sich, acht Einzelzeilen nicht.
    const ueber = Array.from(belegung.entries())
      .filter(([, namen]) => namen.length > rules.maxConcurrent)
      .sort(([a], [b]) => a.localeCompare(b))
    const bloecke: { von: string; bis: string; namen: string[] }[] = []
    for (const [tag, namen] of ueber) {
      const letzter = bloecke[bloecke.length - 1]
      const anschluss = letzter
        && Date.parse(`${tag}T00:00:00Z`) - Date.parse(`${letzter.bis}T00:00:00Z`) === 86400000
      if (anschluss) {
        letzter.bis = tag
        letzter.namen = Array.from(new Set(letzter.namen.concat(namen)))
      } else {
        bloecke.push({ von: tag, bis: tag, namen: Array.from(new Set(namen)) })
      }
    }
    return bloecke
  }, [zeilen, rules.maxConcurrent, planningStart, planningEnd])

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
        /*
         * §231 Jede Person mit ihren EINGEREICHTEN Anträgen.
         *
         * Vorher gingen bevorzugte Monate und eine selbst gesetzte Priorität
         * hinaus. Die Monate konnten keine Überschneidung zeigen, und wer die
         * eigenen Wünsche selbst bewertet, taugt nicht als Rangfolge bei
         * Streit. Jetzt bekommt die Planung Datumsbereiche und den Zeitpunkt
         * der Einreichung — daran lässt sich beides entscheiden.
         */
        antragsfrist: rules.antragsfrist ?? null,
        employees: employees.map(emp => ({
          id: emp.id,
          name: emp.name,
          hasChildren: emp.hasChildren ?? false,
          remainingDays: emp.vacationDaysTotal - emp.vacationDaysUsed,
          antraege: zeilen
            .filter(z => z.employeeId === emp.id)
            .map(z => ({
              startDate: z.startDate, endDate: z.endDate, days: z.days,
              grund: z.reason, status: z.status, eingereichtAm: z.submittedAt,
            })),
        })),
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

        {/* ── EINGEREICHTE ANTRÄGE ───────────────────────────────────── */}
        <Card>
          <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
            <p className="text-sm font-bold text-navy flex items-center gap-2">
              <Palmtree size={15} className="text-green-500" />
              Eingereichte Anträge im Zeitraum
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" loading={collectingWishes}
                onClick={handleCollectWishes}
                className="gap-1.5 text-green-700 border border-gray-200">
                <Send size={14} />Zum Einreichen auffordern
              </Button>
            </div>
          </div>

          {/*
            §231 Die Frist.

            Sie ersetzt die Wunschmonate: Vorher sammelte die Leitung
            unverbindliche Monate ein und plante daraus. Jetzt setzt sie ein
            Datum — und was bis dahin da ist, wird gemeinsam geplant, statt
            dass der schnellste Antrag den besten Zeitraum bekommt.
          */}
          <div className="flex flex-wrap items-end gap-3 mt-3 mb-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">
                Anträge einreichen bis
              </label>
              <Input
                type="date"
                data-test="antragsfrist"
                value={rules.antragsfrist ?? ''}
                onChange={e => handleFristChange(e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-500 max-w-md pb-2">
              {rules.antragsfrist
                ? fristOffen
                  ? `Bis zum ${formatDate(rules.antragsfrist)} eingereichte Anträge werden `
                    + 'gemeinsam geplant. Danach gilt: wer zuerst kommt.'
                  : `Die Frist ist am ${formatDate(rules.antragsfrist)} abgelaufen — `
                    + `${zeilen.length} ${zeilen.length === 1 ? 'Antrag liegt' : 'Anträge liegen'} vor.`
                : 'Ohne Frist entscheidet die Reihenfolge des Eingangs. Mit Frist wird '
                  + 'gemeinsam geplant.'}
            </p>
          </div>

          {/*
            §231 Die Engstellen — die Frage, für die es diese Seite gibt.

            Aus „Juli" und „Juli" folgt keine Überschneidung, nur ein Verdacht.
            Aus zwei Datumsbereichen folgt eine Zahl.
          */}
          {engstellen.length > 0 && (
            <div data-test="engstellen" className="space-y-1.5 mb-4">
              {engstellen.map(b => (
                <div key={b.von} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900">
                    <span className="font-semibold">
                      {b.von === b.bis ? formatDate(b.von) : `${formatDate(b.von)} – ${formatDate(b.bis)}`}
                    </span>
                    {' '}· {b.namen.length} gleichzeitig abwesend, erlaubt sind {rules.maxConcurrent}
                    <span className="text-amber-700"> ({b.namen.join(', ')})</span>
                  </p>
                </div>
              ))}
            </div>
          )}

          {zeilen.length === 0 ? (
            <EmptyState
              icon={Palmtree}
              title="Noch keine Anträge für diesen Zeitraum"
              description={'Sobald Urlaub beantragt wird, steht er hier — mit Datum, Tagen '
                + 'und dem Zeitpunkt der Einreichung. Über „Zum Einreichen auffordern" '
                + 'bekommt das Team eine Nachricht.'}
            />
          ) : (
            <div data-test="antragsliste" className="space-y-2">
              {zeilen.map(z => {
                const emp = employees.find(e => e.id === z.employeeId)
                const nachFrist = !!rules.antragsfrist
                  && z.submittedAt.slice(0, 10) > rules.antragsfrist
                return (
                  <div key={z.id} className="flex items-center gap-3 border border-gray-100 rounded-xl p-3">
                    <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center text-brand text-xs font-bold flex-shrink-0">
                      {z.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-navy">{z.name}</p>
                        {emp?.hasChildren && (
                          <span title="Hat schulpflichtige Kinder">
                            <Baby size={12} className="text-blue-400" />
                          </span>
                        )}
                        <Badge variant={z.status === 'approved' ? 'success' : 'default'}>
                          {z.status === 'approved' ? 'Genehmigt' : 'Offen'}
                        </Badge>
                        {nachFrist && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"
                            title="Nach Ablauf der Frist eingereicht">
                            nach Frist
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatDate(z.startDate)} – {formatDate(z.endDate)} · {z.days}{' '}
                        {z.days === 1 ? 'Tag' : 'Tage'}
                        {z.reason ? ` · ${z.reason}` : ''}
                      </p>
                    </div>
                    <p className="text-[10px] text-gray-400 flex-shrink-0 text-right">
                      eingereicht<br />{formatDate(z.submittedAt.slice(0, 10))}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
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
                            {emp?.hasChildren && <Baby size={12} className="text-blue-400" />}
                          </p>
                          <p className="text-xs text-gray-400">{emp?.position} · {emp?.weeklyHours}h/Wo</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
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

