'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/lib/toast-context'
import {
  ShieldAlert, Heart, Plus, Trash2, Loader2, Clock, Users, MessageCircle,
  Save, Brain, CalendarDays, Pencil, Check, X, Send, Bot, ChevronDown, ChevronUp,
  Code2, Zap, XCircle, AlertTriangle, RotateCcw,
} from 'lucide-react'
import type { LocationModel, HarteRegel, WeicheRegel, WochentagKuerzel } from '@/lib/company-model-types'
import Link from 'next/link'

const ALL_DAYS: WochentagKuerzel[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const QUELLE_LABELS: Record<string, string> = {
  gesetz: 'Gesetz',
  tarifvertrag: 'Tarifvertrag',
  betriebsvereinbarung: 'Betriebsvereinbarung',
  unternehmen: 'Unternehmen',
}
const QUELLE_VARIANTS: Record<string, 'default' | 'warning' | 'danger' | 'success'> = {
  gesetz: 'danger',
  tarifvertrag: 'warning',
  betriebsvereinbarung: 'default',
  unternehmen: 'default',
}

interface DbShift {
  id: string
  name: string
  startTime: string
  endTime: string
  minStaff: number
}

interface ShiftEdit {
  name: string
  startTime: string
  endTime: string
  minStaff: number
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface CustomConstraintRow {
  id: string
  name: string
  description: string
  code: string
  status: string
  errorLog?: string | null
  createdAt: string
}

export default function AdminModelPage() {
  const { showToast } = useToast()
  const [model, setModel] = useState<LocationModel | null>(null)
  const [shifts, setShifts] = useState<DbShift[]>([])
  const [loading, setLoading] = useState(true)
  const [minEdits, setMinEdits] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [ruleText, setRuleText] = useState('')
  const [addingRule, setAddingRule] = useState(false)
  const [savingDays, setSavingDays] = useState(false)

  // Shift editing
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null)
  const [shiftEditDraft, setShiftEditDraft] = useState<ShiftEdit>({ name: '', startTime: '', endTime: '', minStaff: 1 })
  const [savingShift, setSavingShift] = useState(false)
  const [deletingShiftId, setDeletingShiftId] = useState<string | null>(null)

  // New shift form
  const [showNewShift, setShowNewShift] = useState(false)
  const [newShift, setNewShift] = useState<ShiftEdit>({ name: '', startTime: '06:00', endTime: '14:00', minStaff: 1 })
  const [addingShift, setAddingShift] = useState(false)

  // Shift AI chat
  const [shiftChatOpen, setShiftChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Custom constraints (§70)
  const [customConstraints, setCustomConstraints] = useState<CustomConstraintRow[]>([])
  const [ccName, setCcName] = useState('')
  const [ccDescription, setCcDescription] = useState('')
  const [ccGenerating, setCcGenerating] = useState(false)
  const [ccActioning, setCcActioning] = useState<string | null>(null)
  const [ccExpandedId, setCcExpandedId] = useState<string | null>(null)

  // Reset / Neustart
  const [resetOpen, setResetOpen] = useState(false)
  const [resetScope, setResetScope] = useState({
    planungsmodell: true,
    planungsrichtlinien: true,
    customConstraints: true,
    schichten: false,
    onboarding: false,
  })
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)

  const load = useCallback(async () => {
    const [modelRes, shiftsRes, ccRes] = await Promise.all([
      fetch('/api/location-model'),
      fetch('/api/shifts'),
      fetch('/api/admin/custom-constraints'),
    ])
    const [modelData, shiftsData, ccData] = await Promise.all([modelRes.json(), shiftsRes.json(), ccRes.json()])
    setModel(modelData.model ?? null)
    setShifts((shiftsData.shifts as DbShift[]) ?? [])
    setCustomConstraints((ccData.constraints as CustomConstraintRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  // ── Regeln ────────────────────────────────────────────────────────────────

  const persistRules = async (updated: LocationModel) => {
    try {
      const res = await fetch('/api/location-model', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planungsRegeln: updated.planungsRegeln }),
      })
      if (!res.ok) throw new Error()
    } catch {
      showToast('Speichern fehlgeschlagen', 'error')
    }
  }

  const handleDeleteHardRule = async (ruleId: string) => {
    if (!model) return
    const updated = {
      ...model,
      planungsRegeln: { ...model.planungsRegeln, hart: model.planungsRegeln.hart.filter(r => r.id !== ruleId) },
    }
    setModel(updated)
    await persistRules(updated)
    showToast('Regel entfernt', 'success')
  }

  const handleDeleteSoftRule = async (ruleId: string) => {
    if (!model) return
    const updated = {
      ...model,
      planungsRegeln: { ...model.planungsRegeln, weich: model.planungsRegeln.weich.filter(r => r.id !== ruleId) },
    }
    setModel(updated)
    await persistRules(updated)
    showToast('Regel entfernt', 'success')
  }

  const handleAddRule = async () => {
    if (!ruleText.trim() || addingRule) return
    setAddingRule(true)
    try {
      const res = await fetch('/api/location-model/add-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ruleText.trim() }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setModel(data.model)
      setRuleText('')
      showToast('Regel hinzugefügt', 'success')
    } catch {
      showToast('Regel konnte nicht hinzugefügt werden', 'error')
    } finally {
      setAddingRule(false)
    }
  }

  // ── Arbeitstage ───────────────────────────────────────────────────────────

  const handleDayToggle = async (day: WochentagKuerzel) => {
    if (!model || savingDays) return
    const current: WochentagKuerzel[] = model.schichtmodell?.arbeitstage ?? ['Mo', 'Di', 'Mi', 'Do', 'Fr']
    const next = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day].sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b))
    if (next.length === 0) return
    const optimistic = { ...model, schichtmodell: { ...model.schichtmodell, arbeitstage: next } }
    setModel(optimistic)
    setSavingDays(true)
    try {
      const res = await fetch('/api/location-model', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arbeitstage: next }),
      })
      if (!res.ok) throw new Error()
      showToast('Arbeitstage gespeichert', 'success')
    } catch {
      setModel(model)
      showToast('Speichern fehlgeschlagen', 'error')
    } finally {
      setSavingDays(false)
    }
  }

  // ── Mindestbesetzung ──────────────────────────────────────────────────────

  const hasMinEdits = Object.keys(minEdits).length > 0

  const handleSaveMinBesetzung = async () => {
    setSaving(true)
    try {
      await Promise.all(
        Object.entries(minEdits).map(([id, minStaff]) =>
          fetch(`/api/shifts/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minStaff }),
          })
        )
      )
      setShifts(prev => prev.map(s => minEdits[s.id] !== undefined ? { ...s, minStaff: minEdits[s.id] } : s))
      setMinEdits({})
      showToast('Mindestbesetzung gespeichert', 'success')
    } catch {
      showToast('Speichern fehlgeschlagen', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Schicht bearbeiten ────────────────────────────────────────────────────

  const startEditShift = (s: DbShift) => {
    setEditingShiftId(s.id)
    setShiftEditDraft({ name: s.name, startTime: s.startTime, endTime: s.endTime, minStaff: s.minStaff })
  }

  const handleSaveShiftEdit = async () => {
    if (!editingShiftId) return
    setSavingShift(true)
    try {
      const res = await fetch(`/api/shifts/${editingShiftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftEditDraft),
      })
      if (!res.ok) throw new Error()
      setShifts(prev => prev.map(s => s.id === editingShiftId ? { ...s, ...shiftEditDraft } : s))
      setEditingShiftId(null)
      setMinEdits(prev => { const n = { ...prev }; delete n[editingShiftId]; return n })
      showToast('Schicht gespeichert', 'success')
    } catch {
      showToast('Speichern fehlgeschlagen', 'error')
    } finally {
      setSavingShift(false)
    }
  }

  const handleDeleteShift = async (id: string) => {
    setDeletingShiftId(id)
    try {
      const res = await fetch(`/api/shifts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setShifts(prev => prev.filter(s => s.id !== id))
      showToast('Schicht gelöscht', 'success')
    } catch {
      showToast('Löschen fehlgeschlagen', 'error')
    } finally {
      setDeletingShiftId(null)
    }
  }

  const handleAddShift = async () => {
    if (!newShift.name.trim() || addingShift) return
    setAddingShift(true)
    try {
      const locationId = (await fetch('/api/location-model').then(r => r.json()))
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newShift,
          type: 'standard',
          locationId: locationId.model?.locationId,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setShifts(prev => [...prev, data.shift])
      setNewShift({ name: '', startTime: '06:00', endTime: '14:00', minStaff: 1 })
      setShowNewShift(false)
      showToast('Schicht hinzugefügt', 'success')
    } catch {
      showToast('Schicht konnte nicht hinzugefügt werden', 'error')
    } finally {
      setAddingShift(false)
    }
  }

  // ── Schicht-Chat ──────────────────────────────────────────────────────────

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() }
    const history = [...chatMessages, userMsg]
    setChatMessages(history)
    setChatInput('')
    setChatLoading(true)
    try {
      const shiftSummary = shifts.map(s => `${s.name} (${s.startTime}–${s.endTime}, min. ${s.minStaff} MA)`).join(', ')
      const res = await fetch('/api/admin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          system: `Du bist ein Planungsassistent. Aktuelle Schichten: ${shiftSummary}.
Hilf beim Anpassen von Schichten und Mindestbesetzung.
Antworte auf Deutsch, kurz und konkret.
Wenn der Nutzer eine Schicht anlegen, ändern oder löschen möchte, erkläre, was er tun soll, oder frage nach fehlenden Details.`,
        }),
      })
      const data = await res.json()
      const reply = data.content ?? data.message ?? 'Keine Antwort'
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Fehler beim Senden. Bitte nochmal versuchen.' }])
    } finally {
      setChatLoading(false)
    }
  }

  // ── Custom Constraints ────────────────────────────────────────────────────

  const handleGenerateConstraint = async () => {
    if (!ccName.trim() || !ccDescription.trim() || ccGenerating) return
    setCcGenerating(true)
    try {
      const res = await fetch('/api/admin/custom-constraints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ccName.trim(), description: ccDescription.trim() }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setCustomConstraints(prev => [data.constraint, ...prev])
      setCcName('')
      setCcDescription('')
      setCcExpandedId(data.constraint.id)
      showToast('Code generiert — bitte prüfen und aktivieren', 'success')
    } catch {
      showToast('Generierung fehlgeschlagen', 'error')
    } finally {
      setCcGenerating(false)
    }
  }

  const handleCcAction = async (id: string, action: 'active' | 'rejected' | 'delete') => {
    setCcActioning(id)
    try {
      if (action === 'delete') {
        const res = await fetch(`/api/admin/custom-constraints/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error()
        setCustomConstraints(prev => prev.filter(c => c.id !== id))
        showToast('Gelöscht', 'success')
      } else {
        const res = await fetch(`/api/admin/custom-constraints/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: action }),
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setCustomConstraints(prev => prev.map(c => c.id === id ? { ...c, status: data.constraint.status } : c))
        showToast(action === 'active' ? 'Aktiviert' : 'Abgelehnt', 'success')
      }
    } catch {
      showToast('Aktion fehlgeschlagen', 'error')
    } finally {
      setCcActioning(null)
    }
  }

  // ── Zurücksetzen ──────────────────────────────────────────────────────────

  const handleReset = async () => {
    if (resetConfirmText !== 'ZURÜCKSETZEN' || resetting) return
    setResetting(true)
    try {
      const res = await fetch('/api/admin/location-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...resetScope, confirm: resetConfirmText }),
      })
      if (!res.ok) throw new Error(await res.text())
      showToast('Standort-Planungsdaten zurückgesetzt', 'success')
      setResetOpen(false)
      setResetConfirmText('')
      setLoading(true)
      await load()
    } catch {
      showToast('Zurücksetzen fehlgeschlagen', 'error')
    } finally {
      setResetting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <Loader2 size={24} className="animate-spin text-brand" />
      </div>
    )
  }

  if (!model) {
    return (
      <div className="p-4 sm:p-6 space-y-5">
        <Card padding="lg" className="text-center py-12">
          <Brain size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="font-semibold text-navy mb-1">Kein Planungsmodell vorhanden</p>
          <p className="text-sm text-gray-500 mb-5">
            Führe zuerst das Standort-Onboarding durch, damit ein Planungsmodell erstellt wird.
          </p>
          <Link href="/admin/onboarding">
            <Button className="gap-2"><MessageCircle size={16} />Zum Onboarding</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-bold text-navy text-xl">{model.locationName}</h1>
          <p className="text-sm text-gray-500">{model.betriebsTyp?.replace('_', '/')} · {model.bundesland ?? 'Bundesland nicht angegeben'}</p>
        </div>
        <Link href="/admin/onboarding">
          <Button variant="secondary" size="sm" className="gap-1.5">
            <MessageCircle size={14} />Onboarding-Chat
          </Button>
        </Link>
      </div>

      {/* Arbeitstage */}
      <Card padding="lg">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays size={14} className="text-gray-400" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Arbeitstage</p>
          {savingDays && <Loader2 size={12} className="animate-spin text-brand ml-auto" />}
        </div>
        <div className="flex gap-2 flex-wrap">
          {ALL_DAYS.map(day => {
            const activeDays: WochentagKuerzel[] = model.schichtmodell?.arbeitstage ?? ['Mo', 'Di', 'Mi', 'Do', 'Fr']
            const active = activeDays.includes(day)
            const isWeekend = day === 'Sa' || day === 'So'
            return (
              <button
                key={day}
                onClick={() => handleDayToggle(day)}
                disabled={savingDays}
                className={[
                  'w-10 h-10 rounded-xl text-sm font-semibold transition-all select-none',
                  active
                    ? isWeekend ? 'bg-brand text-white shadow-sm shadow-brand/30' : 'bg-navy text-white'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200',
                  savingDays ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                ].join(' ')}
              >
                {day}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">Nur markierte Tage werden beim Dienstplan verplant.</p>
      </Card>

      {/* Mindestbesetzung-Änderungs-Banner */}
      {hasMinEdits && (
        <div className="flex items-center justify-between gap-3 bg-brand/10 border border-brand/20 rounded-xl px-4 py-3">
          <p className="text-sm text-navy font-medium">Mindestbesetzung wurde geändert.</p>
          <Button size="sm" onClick={handleSaveMinBesetzung} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Speichern
          </Button>
        </div>
      )}

      {/* Schichten & Mindestbesetzung */}
      <Card padding="lg">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-gray-400" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Schichten &amp; Mindestbesetzung</p>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShiftChatOpen(o => !o)}
              className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-brand transition-colors"
              title="KI-Chat für Schichten"
            >
              <Bot size={13} />
              KI-Assistent
              {shiftChatOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            <button
              onClick={() => setShowNewShift(o => !o)}
              className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-navy transition-colors"
            >
              <Plus size={13} />
              Neue Schicht
            </button>
          </div>
        </div>

        {/* Schicht-Chat */}
        {shiftChatOpen && (
          <div className="mb-4 border border-gray-100 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
              <Bot size={12} className="text-brand" />
              <p className="text-[11px] font-semibold text-gray-600">KI-Assistent für Schichten</p>
              <p className="text-[10px] text-gray-400 ml-1">Erkläre deine Schichten — die KI hilft beim Anpassen</p>
            </div>
            <div className="max-h-48 overflow-y-auto px-3 py-2 space-y-2 bg-white">
              {chatMessages.length === 0 && (
                <p className="text-xs text-gray-400 italic py-2">
                  Beschreibe deine Schichten oder Änderungswünsche, z.&nbsp;B. &quot;Wir haben Früh-, Spät- und Nachtdienst von 6–14, 14–22 und 22–6 Uhr, je 2 Personen Minimum.&quot;
                </p>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex gap-1.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    m.role === 'user' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-1.5 justify-start">
                  <div className="bg-gray-100 rounded-xl px-3 py-2">
                    <Loader2 size={12} className="animate-spin text-gray-400" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-gray-100 flex gap-2 px-3 py-2 bg-white">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
                placeholder="Schichten beschreiben oder ändern…"
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              <button
                onClick={handleChatSend}
                disabled={chatLoading || !chatInput.trim()}
                className="p-1.5 rounded-lg bg-navy text-white hover:bg-navy/90 disabled:opacity-40 transition-colors"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Neue Schicht Form */}
        {showNewShift && (
          <div className="mb-3 border border-dashed border-brand/30 rounded-xl bg-brand/5 p-3 space-y-2">
            <p className="text-xs font-semibold text-brand">Neue Schicht</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={newShift.name}
                onChange={e => setNewShift(p => ({ ...p, name: e.target.value }))}
                placeholder="Name (z.B. Frühschicht)"
                className="col-span-2 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500 w-8">Von</label>
                <input type="time" value={newShift.startTime} onChange={e => setNewShift(p => ({ ...p, startTime: e.target.value }))}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500 w-8">Bis</label>
                <input type="time" value={newShift.endTime} onChange={e => setNewShift(p => ({ ...p, endTime: e.target.value }))}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              <div className="flex items-center gap-1.5">
                <Users size={12} className="text-gray-400" />
                <label className="text-xs text-gray-500">Min.</label>
                <input type="number" min={1} max={50} value={newShift.minStaff} onChange={e => setNewShift(p => ({ ...p, minStaff: parseInt(e.target.value) || 1 }))}
                  className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setShowNewShift(false)} className="gap-1"><X size={12} />Abbrechen</Button>
              <Button size="sm" onClick={handleAddShift} disabled={!newShift.name.trim() || addingShift} className="gap-1">
                {addingShift ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Hinzufügen
              </Button>
            </div>
          </div>
        )}

        {shifts.length === 0 && !showNewShift ? (
          <p className="text-sm text-gray-400 italic">Noch keine Schichten angelegt.</p>
        ) : (
          <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {shifts.map(s => {
              const isEditing = editingShiftId === s.id
              const isDeleting = deletingShiftId === s.id
              if (isEditing) {
                return (
                  <div key={s.id} className="px-3 py-3 bg-brand/5 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={shiftEditDraft.name}
                        onChange={e => setShiftEditDraft(p => ({ ...p, name: e.target.value }))}
                        placeholder="Name"
                        className="col-span-2 text-sm border border-brand/30 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20"
                      />
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-gray-500 w-8">Von</label>
                        <input type="time" value={shiftEditDraft.startTime} onChange={e => setShiftEditDraft(p => ({ ...p, startTime: e.target.value }))}
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-gray-500 w-8">Bis</label>
                        <input type="time" value={shiftEditDraft.endTime} onChange={e => setShiftEditDraft(p => ({ ...p, endTime: e.target.value }))}
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users size={12} className="text-gray-400" />
                        <label className="text-xs text-gray-500">Min.</label>
                        <input type="number" min={1} max={50} value={shiftEditDraft.minStaff} onChange={e => setShiftEditDraft(p => ({ ...p, minStaff: parseInt(e.target.value) || 1 }))}
                          className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-brand/20" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingShiftId(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100">
                        <X size={12} />Abbrechen
                      </button>
                      <button onClick={handleSaveShiftEdit} disabled={savingShift} className="flex items-center gap-1 text-xs text-white bg-navy rounded-lg px-3 py-1 hover:bg-navy/90 disabled:opacity-50">
                        {savingShift ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Speichern
                      </button>
                    </div>
                  </div>
                )
              }
              return (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy truncate">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.startTime} – {s.endTime}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Users size={13} className="text-gray-400" />
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={minEdits[s.id] ?? s.minStaff}
                      onChange={e => setMinEdits(prev => ({ ...prev, [s.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className={`w-14 text-center text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors ${(minEdits[s.id] ?? s.minStaff) !== s.minStaff ? 'border-brand bg-brand/5 font-semibold text-brand' : 'border-gray-200 text-navy'}`}
                    />
                    <button
                      onClick={() => startEditShift(s)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-navy hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                      title="Schicht bearbeiten"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteShift(s.id)}
                      disabled={isDeleting}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Schicht löschen"
                    >
                      {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Harte Regeln */}
      <Card padding="lg">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert size={14} className="text-red-400" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Harte Regeln</p>
          <span className="text-xs text-gray-400">({model.planungsRegeln.hart.length})</span>
        </div>
        {model.planungsRegeln.hart.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Keine harten Regeln definiert.</p>
        ) : (
          <div className="space-y-1.5">
            {model.planungsRegeln.hart.map(r => (
              <HardRuleRow key={r.id} regel={r} onDelete={() => handleDeleteHardRule(r.id)} />
            ))}
          </div>
        )}
      </Card>

      {/* Weiche Regeln */}
      <Card padding="lg">
        <div className="flex items-center gap-2 mb-3">
          <Heart size={14} className="text-brand" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Weiche Regeln</p>
          <span className="text-xs text-gray-400">({model.planungsRegeln.weich.length})</span>
        </div>
        {model.planungsRegeln.weich.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Keine weichen Regeln definiert.</p>
        ) : (
          <div className="space-y-1.5">
            {model.planungsRegeln.weich.map(r => (
              <SoftRuleRow key={r.id} regel={r} onDelete={() => handleDeleteSoftRule(r.id)} />
            ))}
          </div>
        )}
      </Card>

      {/* Regel hinzufügen */}
      <Card padding="lg">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Regel hinzufügen</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={ruleText}
            onChange={e => setRuleText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !addingRule && handleAddRule()}
            placeholder='z. B. „Max. 2 Spätdienste pro Mitarbeiter pro Woche"'
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 placeholder:text-gray-300"
            disabled={addingRule}
          />
          <Button size="sm" onClick={handleAddRule} disabled={!ruleText.trim() || addingRule} className="gap-1.5 flex-shrink-0">
            {addingRule ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {addingRule ? 'KI...' : 'Hinzufügen'}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Die KI erkennt automatisch, ob es eine harte oder weiche Regel ist.</p>
      </Card>

      {/* Custom Constraints §70 */}
      <Card padding="lg">
        <div className="flex items-center gap-2 mb-3">
          <Code2 size={14} className="text-purple-400" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custom-Regeln</p>
          <span className="text-xs text-gray-400">({customConstraints.filter(c => c.status === 'active').length} aktiv)</span>
          <span className="ml-auto text-[10px] text-purple-400 font-medium bg-purple-50 px-2 py-0.5 rounded-full">KI-generiert</span>
        </div>
        <p className="text-xs text-gray-400 mb-3 leading-relaxed">
          Beschreibe eine komplexe Planungsregel in natürlicher Sprache. Die KI generiert daraus CP-SAT-Constraint-Code,
          den du vor der Aktivierung prüfen kannst.
        </p>

        {/* Generator form */}
        <div className="space-y-2 mb-4">
          <input
            type="text"
            value={ccName}
            onChange={e => setCcName(e.target.value)}
            placeholder='Regelname (z.B. "Keine zwei Nachtdienste hintereinander")'
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400/30 placeholder:text-gray-300"
            disabled={ccGenerating}
          />
          <textarea
            value={ccDescription}
            onChange={e => setCcDescription(e.target.value)}
            placeholder='Beschreibe die Regel genau, z.B. "Kein Mitarbeiter soll mehr als 2 Nachtdienste in Folge haben. Nach 2 Nachtdiensten muss mindestens ein freier Tag folgen."'
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400/30 placeholder:text-gray-300 resize-none"
            disabled={ccGenerating}
          />
          <Button
            size="sm"
            onClick={handleGenerateConstraint}
            disabled={!ccName.trim() || !ccDescription.trim() || ccGenerating}
            className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white border-0"
          >
            {ccGenerating ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}
            {ccGenerating ? 'KI generiert Code…' : 'Code generieren'}
          </Button>
        </div>

        {/* Constraint list */}
        {customConstraints.length > 0 && (
          <div className="space-y-2">
            {customConstraints.map(c => {
              const isExpanded = ccExpandedId === c.id
              const isActioning = ccActioning === c.id
              const statusColors: Record<string, string> = {
                active: 'text-green-600 bg-green-50',
                rejected: 'text-red-500 bg-red-50',
                pending: 'text-amber-600 bg-amber-50',
              }
              const statusLabels: Record<string, string> = {
                active: 'Aktiv',
                rejected: 'Abgelehnt',
                pending: 'Warte auf Prüfung',
              }
              return (
                <div key={c.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50/50">
                    <button
                      onClick={() => setCcExpandedId(isExpanded ? null : c.id)}
                      className="flex-1 flex items-center gap-2 text-left min-w-0"
                    >
                      <Code2 size={13} className="text-purple-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-navy truncate">{c.name}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${statusColors[c.status] ?? 'text-gray-500 bg-gray-100'}`}>
                        {statusLabels[c.status] ?? c.status}
                      </span>
                      {isExpanded ? <ChevronUp size={13} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />}
                    </button>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {c.status !== 'active' && (
                        <button
                          onClick={() => handleCcAction(c.id, 'active')}
                          disabled={isActioning}
                          title="Aktivieren"
                          className="p-1.5 rounded-lg text-gray-300 hover:text-green-600 hover:bg-green-50 transition-colors"
                        >
                          {isActioning ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                        </button>
                      )}
                      {c.status !== 'rejected' && (
                        <button
                          onClick={() => handleCcAction(c.id, 'rejected')}
                          disabled={isActioning}
                          title="Ablehnen"
                          className="p-1.5 rounded-lg text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                        >
                          <XCircle size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => handleCcAction(c.id, 'delete')}
                        disabled={isActioning}
                        title="Löschen"
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-950 px-3 py-3">
                      <p className="text-[10px] text-gray-400 mb-1.5 font-mono uppercase tracking-wide">Python CP-SAT Code</p>
                      <pre className="text-[11px] text-green-300 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">{c.code}</pre>
                      {c.errorLog && (
                        <p className="text-[10px] text-red-400 mt-2 font-mono">{c.errorLog}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Zurücksetzen & Neustart */}
      <Card padding="lg" className="border-red-100">
        <div className="flex items-center gap-2 mb-2">
          <RotateCcw size={14} className="text-red-400" />
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">Zurücksetzen &amp; Neustart</p>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed mb-3">
          Setzt die Planungskonfiguration dieses Standorts zurück, um mit dem neuen Regelsystem frisch zu starten.
          Dienstpläne, Zeiterfassung, Urlaube und Mitarbeiter bleiben unberührt.
        </p>
        {!resetOpen ? (
          <Button variant="secondary" size="sm" onClick={() => setResetOpen(true)} className="gap-1.5 text-red-500 border-red-200 hover:bg-red-50">
            <RotateCcw size={13} />Standort zurücksetzen…
          </Button>
        ) : (
          <div className="border border-red-200 rounded-xl bg-red-50/40 p-3 space-y-3">
            <div className="space-y-1.5">
              {([
                ['planungsmodell', 'Planungsmodell', 'KI-generiertes Modell mit harten & weichen Regeln'],
                ['planungsrichtlinien', 'Planungsrichtlinien', 'Überstunden-Handling, Fristen, Solver-Parameter'],
                ['customConstraints', 'Custom-Regeln', 'Alle KI-generierten Zusatz-Constraints'],
                ['schichten', 'Schichten & Mindestbesetzung', 'Achtung: bestehende Dienstplan-Einträge verlieren ihre Schicht-Zuordnung'],
                ['onboarding', 'Onboarding-Status', 'Der Einrichtungs-Chat startet komplett neu'],
              ] as const).map(([key, label, hint]) => (
                <label key={key} className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={resetScope[key]}
                    onChange={e => setResetScope(p => ({ ...p, [key]: e.target.checked }))}
                    className="mt-0.5 accent-red-500"
                  />
                  <span className="text-xs">
                    <span className="font-medium text-navy">{label}</span>
                    <span className={`block ${key === 'schichten' ? 'text-red-400' : 'text-gray-400'}`}>{hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex items-start gap-2 text-[11px] text-red-500 bg-red-50 border border-red-100 rounded-lg px-2.5 py-2">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              <span>Diese Aktion kann nicht rückgängig gemacht werden. Tippe <b>ZURÜCKSETZEN</b> zur Bestätigung.</span>
            </div>
            <input
              type="text"
              value={resetConfirmText}
              onChange={e => setResetConfirmText(e.target.value)}
              placeholder="ZURÜCKSETZEN"
              className="w-full text-sm border border-red-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-300/40 placeholder:text-red-200"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setResetOpen(false); setResetConfirmText('') }} className="gap-1">
                <X size={12} />Abbrechen
              </Button>
              <Button
                size="sm"
                onClick={handleReset}
                disabled={resetConfirmText !== 'ZURÜCKSETZEN' || resetting || !Object.values(resetScope).some(Boolean)}
                className="gap-1.5 bg-red-600 hover:bg-red-700 text-white border-0"
              >
                {resetting ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                Endgültig zurücksetzen
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

function HardRuleRow({ regel, onDelete }: { regel: HarteRegel; onDelete: () => void }) {
  return (
    <div className="flex items-start gap-2 group rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-navy leading-snug">{regel.beschreibung}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <Badge variant={(QUELLE_VARIANTS[regel.quelle] ?? 'default') as 'default' | 'warning' | 'danger' | 'success'} className="text-[10px]">
            {QUELLE_LABELS[regel.quelle] ?? regel.quelle}
          </Badge>
          <span className="text-[10px] text-gray-400">{regel.kategorie}</span>
          {regel.wert !== undefined && (
            <span className="text-[10px] text-gray-400">{regel.wert}{regel.einheit ? ` ${regel.einheit}` : ''}</span>
          )}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="flex-shrink-0 p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
        title="Regel entfernen"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

function SoftRuleRow({ regel, onDelete }: { regel: WeicheRegel; onDelete: () => void }) {
  const pct = Math.round(regel.gewicht * 100)
  return (
    <div className="flex items-start gap-2 group rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-navy leading-snug">{regel.beschreibung}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] text-gray-400">{regel.kategorie}</span>
          <span className="text-[10px] text-gray-400">·</span>
          <div className="flex items-center gap-1">
            <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-gray-400">{pct}%</span>
          </div>
        </div>
      </div>
      <button
        onClick={onDelete}
        className="flex-shrink-0 p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
        title="Regel entfernen"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}
