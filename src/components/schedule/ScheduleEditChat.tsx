'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import {
  CalendarCheck, ShieldCheck, Clock, Sparkles, Trash2,
  ArrowLeftRight, CalendarOff, Bot, Zap, X, AlertTriangle, Loader,
} from 'lucide-react'
import type { ScheduleEditDraft, ScheduleEditChange } from '@/lib/schedule-edit-draft'
import { draftToChangeStrings, draftToPermanentRuleStrings } from '@/lib/schedule-edit-draft'

interface EmployeeBrief { id: string; name: string; gruppe?: string; bereich?: string }
interface ShiftBrief { id: string; name: string; type: string; startTime: string; endTime: string }
interface EntryBrief { employeeId: string; employeeName: string; date: string; shiftId: string; shiftName: string }

type Mode = 'quick' | 'ai'
type QuickCmd = 'remove' | 'swap' | 'free' | 'weekends'

function storageKey(locationId: string, periodLabel: string) {
  return `schedule-edit-v2:${locationId}:${periodLabel}`
}

function mergeChanges(existing: ScheduleEditChange[], incoming: ScheduleEditChange[]): ScheduleEditChange[] {
  const map = new Map<string, ScheduleEditChange>()
  for (const c of existing) map.set(`${c.employeeId}|${c.date}`, c)
  for (const c of incoming) map.set(`${c.employeeId}|${c.date}`, c)
  return Array.from(map.values())
}

function loadDraft(key: string): ScheduleEditDraft {
  try {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(key) : null
    if (saved) return JSON.parse(saved) as ScheduleEditDraft
  } catch { /* ignore */ }
  return {}
}

export function ScheduleEditChat({
  open,
  onClose,
  onApply,
  onReplan,
  locationId,
  periodLabel,
  periodStart,
  periodEnd,
  employees,
  shifts,
  entries,
}: {
  open: boolean
  onClose: () => void
  onApply: (changes: ScheduleEditChange[], permanentRules: string[]) => Promise<void>
  onReplan: (permanentRules: string[]) => Promise<void>
  locationId: string
  periodLabel: string
  periodStart?: string
  periodEnd?: string
  employees: EmployeeBrief[]
  shifts: ShiftBrief[]
  entries: EntryBrief[]
}) {
  const key = storageKey(locationId, periodLabel)

  const [mode, setMode] = useState<Mode>('quick')
  const [draft, setDraft] = useState<ScheduleEditDraft>(() => loadDraft(key))
  const [applying, setApplying] = useState(false)

  // Quick command state
  const [activeCmd, setActiveCmd] = useState<QuickCmd | null>(null)
  const [quickError, setQuickError] = useState('')

  // Remove entry form
  const [removeEmpId, setRemoveEmpId] = useState('')
  const [removeDate, setRemoveDate] = useState('')

  // Swap form
  const [swapEmpA, setSwapEmpA] = useState('')
  const [swapEmpB, setSwapEmpB] = useState('')
  const [swapDate, setSwapDate] = useState('')

  // Free period form
  const [freeEmpId, setFreeEmpId] = useState('')
  const [freeVon, setFreeVon] = useState('')
  const [freeBis, setFreeBis] = useState('')

  // Remove weekends form
  const [weekendEmpId, setWeekendEmpId] = useState('')

  // AI state
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiReply, setAiReply] = useState('')
  const [aiError, setAiError] = useState('')

  function updateDraft(newDraft: ScheduleEditDraft) {
    setDraft(newDraft)
    try { localStorage.setItem(key, JSON.stringify(newDraft)) } catch { /* quota */ }
  }

  function addChanges(incoming: ScheduleEditChange[], newPermanentRules?: string[]) {
    const merged = mergeChanges(draft.changes ?? [], incoming)
    updateDraft({
      ...draft,
      changes: merged,
      ...(newPermanentRules?.length
        ? { permanentRules: [...(draft.permanentRules ?? []), ...newPermanentRules] }
        : {}),
    })
    setQuickError('')
  }

  function removeChangeAt(idx: number) {
    const newChanges = (draft.changes ?? []).filter((_, i) => i !== idx)
    updateDraft({ ...draft, changes: newChanges })
  }

  function resetDraft() {
    updateDraft({})
    setAiReply('')
    setAiError('')
  }

  // --- Quick commands ---

  function handleRemove() {
    if (!removeEmpId || !removeDate) { setQuickError('Bitte Mitarbeiter und Datum auswählen.'); return }
    const emp = employees.find(e => e.id === removeEmpId)
    if (!emp) return
    addChanges([{ employeeId: removeEmpId, employeeName: emp.name, date: removeDate, action: 'remove' }])
    setRemoveDate('')
  }

  function handleSwap() {
    if (!swapEmpA || !swapEmpB || !swapDate) { setQuickError('Bitte beide Mitarbeiter und das Datum auswählen.'); return }
    if (swapEmpA === swapEmpB) { setQuickError('Bitte zwei verschiedene Mitarbeiter auswählen.'); return }
    const entryA = entries.find(e => e.employeeId === swapEmpA && e.date === swapDate)
    const entryB = entries.find(e => e.employeeId === swapEmpB && e.date === swapDate)
    if (!entryA && !entryB) { setQuickError('Keiner der Mitarbeiter hat an diesem Tag einen Eintrag.'); return }
    const empA = employees.find(e => e.id === swapEmpA)!
    const empB = employees.find(e => e.id === swapEmpB)!
    const changes: ScheduleEditChange[] = []
    if (entryA && entryB) {
      changes.push({ employeeId: swapEmpA, employeeName: empA.name, date: swapDate, action: 'assign', shiftId: entryB.shiftId, shiftName: entryB.shiftName })
      changes.push({ employeeId: swapEmpB, employeeName: empB.name, date: swapDate, action: 'assign', shiftId: entryA.shiftId, shiftName: entryA.shiftName })
    } else if (entryA) {
      changes.push({ employeeId: swapEmpB, employeeName: empB.name, date: swapDate, action: 'assign', shiftId: entryA.shiftId, shiftName: entryA.shiftName })
      changes.push({ employeeId: swapEmpA, employeeName: empA.name, date: swapDate, action: 'remove' })
    } else {
      changes.push({ employeeId: swapEmpA, employeeName: empA.name, date: swapDate, action: 'assign', shiftId: entryB!.shiftId, shiftName: entryB!.shiftName })
      changes.push({ employeeId: swapEmpB, employeeName: empB.name, date: swapDate, action: 'remove' })
    }
    addChanges(changes)
    setSwapDate('')
  }

  function handleFree() {
    if (!freeEmpId || !freeVon || !freeBis) { setQuickError('Bitte Mitarbeiter und Zeitraum auswählen.'); return }
    const emp = employees.find(e => e.id === freeEmpId)
    if (!emp) return
    const [sy, sm, sd] = freeVon.split('-').map(Number)
    const [ey, em, ed] = freeBis.split('-').map(Number)
    const start = new Date(sy, sm - 1, sd)
    const end = new Date(ey, em - 1, ed)
    if (start > end) { setQuickError('Von-Datum muss vor Bis-Datum liegen.'); return }
    const changes: ScheduleEditChange[] = []
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (entries.some(e => e.employeeId === freeEmpId && e.date === dateStr)) {
        changes.push({ employeeId: freeEmpId, employeeName: emp.name, date: dateStr, action: 'remove' })
      }
    }
    if (changes.length === 0) { setQuickError('Keine Einträge im gewählten Zeitraum gefunden.'); return }
    addChanges(changes)
    setFreeVon('')
    setFreeBis('')
  }

  function handleRemoveWeekends() {
    const targetEntries = weekendEmpId
      ? entries.filter(e => e.employeeId === weekendEmpId)
      : entries
    const changes: ScheduleEditChange[] = []
    for (const entry of targetEntries) {
      const dow = new Date(entry.date + 'T00:00:00').getDay()
      if (dow === 0 || dow === 6) {
        const emp = employees.find(e => e.id === entry.employeeId)
        if (emp) changes.push({ employeeId: entry.employeeId, employeeName: emp.name, date: entry.date, action: 'remove' })
      }
    }
    if (changes.length === 0) { setQuickError('Keine Wochenendeinträge in diesem Zeitraum gefunden.'); return }
    addChanges(changes)
  }

  // --- AI one-shot ---

  async function handleAiSend() {
    const text = aiInput.trim()
    if (!text || aiLoading) return
    setAiLoading(true)
    setAiReply('')
    setAiError('')
    try {
      const res = await fetch('/api/ai/schedule-edit-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          draft,
          locationId,
          periodLabel,
          employees,
          shifts,
          entries,
        }),
      })
      const json = await res.json()
      if (json.error) {
        setAiError(`Fehler: ${json.error}`)
      } else {
        setAiReply(json.reply ?? '')
        if (json.draft) {
          const newDraft = json.draft as ScheduleEditDraft
          updateDraft({
            changes: mergeChanges(draft.changes ?? [], newDraft.changes ?? []),
            permanentRules: [...(draft.permanentRules ?? []), ...(newDraft.permanentRules ?? [])],
          })
          setAiInput('')
        }
      }
    } catch (err) {
      setAiError(`Netzwerkfehler: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`)
    } finally {
      setAiLoading(false)
    }
  }

  // --- Apply / Replan ---

  async function handleApply(withPermanentRules: boolean) {
    setApplying(true)
    try {
      await onApply(draft.changes ?? [], withPermanentRules ? (draft.permanentRules ?? []) : [])
      resetDraft()
      onClose()
    } finally {
      setApplying(false)
    }
  }

  async function handleReplan() {
    setApplying(true)
    try {
      resetDraft()
      await onReplan(draft.permanentRules ?? [])
    } finally {
      setApplying(false)
    }
  }

  const changePreview = draftToChangeStrings(draft)
  const permanentRulePreview = draftToPermanentRuleStrings(draft)
  const hasPermanentRules = permanentRulePreview.length > 0
  const hasChanges = (draft.changes?.length ?? 0) > 0

  const swapEntryA = swapEmpA && swapDate ? entries.find(e => e.employeeId === swapEmpA && e.date === swapDate) : undefined
  const swapEntryB = swapEmpB && swapDate ? entries.find(e => e.employeeId === swapEmpB && e.date === swapDate) : undefined

  const selectClass = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-navy/20'
  const inputClass = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy/20'

  return (
    <Modal open={open} onClose={onClose} title={`Dienstplan bearbeiten · ${periodLabel}`} size="lg">
      {/* Mode switcher */}
      <div className="flex rounded-xl bg-gray-100 p-1 mb-5">
        <button
          onClick={() => setMode('quick')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'quick' ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Zap size={14} />
          Schnellbefehle
        </button>
        <button
          onClick={() => setMode('ai')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'ai' ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Bot size={14} />
          KI-Assistent
        </button>
      </div>

      {/* ─── Quick commands tab ─────────────────────────── */}
      {mode === 'quick' && (
        <div className="space-y-3 mb-5">
          <div className="grid grid-cols-2 gap-2">
            {([
              { cmd: 'remove' as QuickCmd, icon: Trash2, label: 'Eintrag entfernen' },
              { cmd: 'swap' as QuickCmd, icon: ArrowLeftRight, label: 'Schichten tauschen' },
              { cmd: 'free' as QuickCmd, icon: CalendarOff, label: 'Freistellen' },
              { cmd: 'weekends' as QuickCmd, icon: CalendarCheck, label: 'Wochenenden entfernen' },
            ]).map(({ cmd, icon: Icon, label }) => (
              <button
                key={cmd}
                onClick={() => { setActiveCmd(activeCmd === cmd ? null : cmd); setQuickError('') }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${activeCmd === cmd ? 'bg-navy text-white border-navy' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {activeCmd === 'remove' && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500">Dienst eines Mitarbeiters an einem Tag entfernen</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Mitarbeiter</label>
                  <select value={removeEmpId} onChange={e => setRemoveEmpId(e.target.value)} className={selectClass}>
                    <option value="">Auswählen…</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Datum</label>
                  <input type="date" value={removeDate} onChange={e => setRemoveDate(e.target.value)} min={periodStart} max={periodEnd} className={inputClass} />
                </div>
              </div>
              <Button size="sm" onClick={handleRemove} disabled={!removeEmpId || !removeDate}>Eintrag entfernen</Button>
            </div>
          )}

          {activeCmd === 'swap' && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500">Schichten zweier Mitarbeiter an einem Tag tauschen</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Mitarbeiter A</label>
                  <select value={swapEmpA} onChange={e => setSwapEmpA(e.target.value)} className={selectClass}>
                    <option value="">Auswählen…</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Mitarbeiter B</label>
                  <select value={swapEmpB} onChange={e => setSwapEmpB(e.target.value)} className={selectClass}>
                    <option value="">Auswählen…</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Datum</label>
                <input type="date" value={swapDate} onChange={e => setSwapDate(e.target.value)} min={periodStart} max={periodEnd} className={inputClass} />
              </div>
              {swapDate && swapEmpA && swapEmpB && (
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>
                    {employees.find(e => e.id === swapEmpA)?.name}:{' '}
                    <span className="font-semibold text-navy">{swapEntryA?.shiftName ?? 'kein Dienst'}</span>
                  </span>
                  <ArrowLeftRight size={12} className="text-gray-300 flex-shrink-0 mt-0.5" />
                  <span>
                    {employees.find(e => e.id === swapEmpB)?.name}:{' '}
                    <span className="font-semibold text-navy">{swapEntryB?.shiftName ?? 'kein Dienst'}</span>
                  </span>
                </div>
              )}
              <Button size="sm" onClick={handleSwap} disabled={!swapEmpA || !swapEmpB || !swapDate}>Tauschen</Button>
            </div>
          )}

          {activeCmd === 'free' && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500">Mitarbeiter für einen Zeitraum von allen Diensten freistellen</p>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Mitarbeiter</label>
                <select value={freeEmpId} onChange={e => setFreeEmpId(e.target.value)} className={selectClass}>
                  <option value="">Auswählen…</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Von</label>
                  <input type="date" value={freeVon} onChange={e => setFreeVon(e.target.value)} min={periodStart} max={periodEnd} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Bis</label>
                  <input type="date" value={freeBis} onChange={e => setFreeBis(e.target.value)} min={freeVon || periodStart} max={periodEnd} className={inputClass} />
                </div>
              </div>
              <Button size="sm" onClick={handleFree} disabled={!freeEmpId || !freeVon || !freeBis}>Freistellen</Button>
            </div>
          )}

          {activeCmd === 'weekends' && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500">Alle Wochenendeinträge im aktuellen Zeitraum entfernen</p>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Mitarbeiter (leer = alle)</label>
                <select value={weekendEmpId} onChange={e => setWeekendEmpId(e.target.value)} className={selectClass}>
                  <option value="">Alle Mitarbeiter</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <Button size="sm" onClick={handleRemoveWeekends}>Wochenendeinträge entfernen</Button>
            </div>
          )}

          {quickError && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <AlertTriangle size={12} className="flex-shrink-0" />
              {quickError}
            </div>
          )}
        </div>
      )}

      {/* ─── AI assistant tab ──────────────────────────── */}
      {mode === 'ai' && (
        <div className="space-y-3 mb-5">
          <p className="text-xs text-gray-500">
            Beschreibe die gewünschte Änderung in natürlicher Sprache. Die KI setzt sie direkt und ohne Nachfragen um.
          </p>
          <textarea
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAiSend() }}
            placeholder='z.B. „Tausche Anna und Tom am Freitag" oder „Gib Klaus diese Woche frei"'
            rows={3}
            disabled={aiLoading}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20 resize-none disabled:opacity-50"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleAiSend} loading={aiLoading} disabled={!aiInput.trim() || aiLoading} className="gap-1.5">
              {aiLoading ? <Loader size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {aiLoading ? 'Wird analysiert…' : 'Änderungen erstellen'}
            </Button>
            <span className="text-[10px] text-gray-400">oder ⌘↵</span>
          </div>
          {aiReply && (
            <div className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
              {aiReply}
            </div>
          )}
          {aiError && (
            <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
              {aiError}
            </div>
          )}
        </div>
      )}

      {/* ─── Shared draft preview + apply ──────────────── */}
      {hasChanges && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Vorgemerkte Änderungen ({draft.changes?.length})
            </p>
            <button
              onClick={resetDraft}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={11} />
              Zurücksetzen
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {changePreview.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-100 text-xs font-medium px-2.5 py-1 rounded-full">
                {c}
                <button onClick={() => removeChangeAt(i)} className="ml-0.5 hover:text-blue-900 rounded-full">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>

          {hasPermanentRules && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-amber-700">Dauerhafte Regeln erkannt</p>
              {permanentRulePreview.map((r, i) => (
                <p key={i} className="text-xs text-amber-900">• {r}</p>
              ))}
            </div>
          )}

          {hasPermanentRules ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Sollen diese Regeln dauerhaft im Planungsmodell gespeichert werden?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleApply(true)}
                  disabled={applying}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold py-2.5 transition-colors disabled:opacity-50"
                >
                  <ShieldCheck size={14} />
                  Dauerhaft speichern
                </button>
                <button
                  onClick={() => handleApply(false)}
                  disabled={applying}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium py-2.5 transition-colors disabled:opacity-50"
                >
                  <Clock size={14} />
                  Nur für diesen Plan
                </button>
              </div>
              <button
                onClick={handleReplan}
                disabled={applying}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 transition-colors disabled:opacity-50"
              >
                <Sparkles size={14} />
                Regeln speichern &amp; Dienstplan neu erstellen
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button className="flex-1 gap-1.5" loading={applying} onClick={() => handleApply(false)}>
                <CalendarCheck size={14} />
                Änderungen übernehmen
              </Button>
              <button
                onClick={handleReplan}
                disabled={applying}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 transition-colors disabled:opacity-50"
              >
                <Sparkles size={14} />
                Dienstplan neu erstellen
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
