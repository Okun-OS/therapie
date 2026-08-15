'use client'

// §78 Einrichtungs-Wizard — deterministische Konfiguration in 5 Schritten.
// Die KI ist ausschließlich Ausfüllhilfe: sie liefert Vorschläge mit Checkboxen,
// geschrieben wird nur, was der Mensch auswählt und bestätigt — über dieselben
// CRUD-Endpoints wie die manuellen Editoren.

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/lib/toast-context'
import {
  CalendarDays, Clock, Layers, Users, ShieldAlert, Sparkles, Check,
  ChevronRight, ChevronLeft, Loader2, Plus, Trash2, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import type { WochentagKuerzel } from '@/lib/company-model-types'

interface WizShift { id: string; name: string; type?: string; startTime: string; endTime: string; minStaff: number }
interface WizUnit { id: string; name: string; type: string; parentId: string | null; minStaff: number }
interface WizEmployee { id: string; name: string; gruppe?: string }
interface Proposal {
  arbeitstage?: string[]
  schichten: { name: string; von: string; bis: string; minStaff?: number }[]
  etagen: { name: string; minStaffFruehSpaet?: number }[]
  gruppen: { name: string; etage?: string; minStaffProTag?: number }[]
  basiswerte?: { maxWeeklyHours?: number; restHours?: number; maxConsecutiveDays?: number }
  regeln: string[]
}

const STEPS = [
  { key: 'betrieb', label: 'Betriebsform', icon: CalendarDays },
  { key: 'dienste', label: 'Dienste', icon: Clock },
  { key: 'struktur', label: 'Struktur', icon: Layers },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'regeln', label: 'Regeln', icon: ShieldAlert },
]

const BETRIEBSFORMEN: { label: string; hint: string; tage: WochentagKuerzel[] }[] = [
  { label: 'Montag – Freitag', hint: 'Klassischer Wochenbetrieb (Kita, Praxis, Büro)', tage: ['Mo', 'Di', 'Mi', 'Do', 'Fr'] },
  { label: 'Montag – Samstag', hint: '6-Tage-Betrieb (Handel, Gastronomie)', tage: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] },
  { label: '7 Tage', hint: 'Durchgehender Betrieb (Pflege, Klinik, Hotel)', tage: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] },
]

export default function SetupWizardPage() {
  const { showToast } = useToast()
  const [step, setStep] = useState(0)
  const [locationId, setLocationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [arbeitstage, setArbeitstage] = useState<WochentagKuerzel[]>([])
  const [shifts, setShifts] = useState<WizShift[]>([])
  const [units, setUnits] = useState<WizUnit[]>([])
  const [employees, setEmployees] = useState<WizEmployee[]>([])
  const [baseRules, setBaseRules] = useState({ maxWeeklyHours: 40, restHours: 11, maxConsecutiveDays: 5 })
  const [constraintCount, setConstraintCount] = useState(0)

  const load = useCallback(async () => {
    const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => null)
    const locId = me?.user?.locationId as string | undefined
    if (!locId) { setLoading(false); return }
    setLocationId(locId)
    const [modelRes, shiftsRes, unitsRes, empRes, rulesRes, ccRes] = await Promise.all([
      fetch('/api/location-model').then(r => r.json()).catch(() => ({})),
      fetch('/api/shifts').then(r => r.json()).catch(() => ({})),
      fetch(`/api/planning-units?locationId=${locId}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/employees?locationId=${locId}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/planning-rules?locationId=${locId}`).then(r => r.json()).catch(() => ({})),
      fetch('/api/admin/custom-constraints').then(r => r.json()).catch(() => ({})),
    ])
    setArbeitstage((modelRes.model?.schichtmodell?.arbeitstage as WochentagKuerzel[]) ?? [])
    setShifts((shiftsRes.shifts as WizShift[]) ?? [])
    setUnits((unitsRes.units as WizUnit[]) ?? [])
    setEmployees(((empRes.employees ?? []) as WizEmployee[]))
    if (rulesRes.rules) {
      setBaseRules({
        maxWeeklyHours: rulesRes.rules.maxWeeklyHours ?? 40,
        restHours: rulesRes.rules.restHours ?? 11,
        maxConsecutiveDays: rulesRes.rules.maxConsecutiveDays ?? 5,
      })
    }
    setConstraintCount(((ccRes.constraints ?? []) as { status: string }[]).filter(c => c.status === 'active' || c.status === 'pending').length)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // ── Schritt 1: Betriebsform ───────────────────────────────────────────────
  const [savingDays, setSavingDays] = useState(false)
  const applyBetriebsform = async (tage: WochentagKuerzel[]) => {
    setSavingDays(true)
    try {
      const res = await fetch('/api/location-model', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arbeitstage: tage }),
      })
      if (!res.ok) throw new Error()
      setArbeitstage(tage)
      showToast('Arbeitstage gespeichert', 'success')
    } catch { showToast('Speichern fehlgeschlagen', 'error') } finally { setSavingDays(false) }
  }

  // ── Schritt 2: Dienste ────────────────────────────────────────────────────
  // §80 Zeitanker: 'early' = Beginn fix (Ende ergibt sich aus den Stunden),
  // 'late' = Ende fix (Beginn ergibt sich). Nur die verankerte Zeit ist Pflicht;
  // die andere Seite ist der Rahmen und wird sinnvoll vorbelegt.
  const [newShift, setNewShift] = useState({
    name: '', anchor: 'early' as 'early' | 'late', startTime: '07:00', endTime: '15:30', minStaff: 1,
  })
  const [addingShift, setAddingShift] = useState(false)

  const shiftMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const fmtTime = (mins: number) => {
    const m = ((mins % 1440) + 1440) % 1440
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  }
  // Rahmen (9h) für die nicht-verankerte Seite: großzügig genug für Vollzeit,
  // der Solver kürzt pro Person auf deren Tagessoll
  const FRAME_MIN = 9 * 60
  const setAnchor = (anchor: 'early' | 'late') => setNewShift(p => ({
    ...p,
    anchor,
    ...(anchor === 'early'
      ? { endTime: fmtTime(shiftMinutes(p.startTime) + FRAME_MIN) }
      : { startTime: fmtTime(shiftMinutes(p.endTime) - FRAME_MIN) }),
  }))

  const addShift = async (data?: { name: string; startTime: string; endTime: string; minStaff?: number; type?: string }) => {
    const payload = data ?? { ...newShift, type: newShift.anchor }
    if (!payload.name.trim() || !locationId) return false
    if (shifts.some(s => s.name.trim().toLowerCase() === payload.name.trim().toLowerCase())) {
      showToast(`„${payload.name}" existiert bereits`, 'error')
      return false
    }
    const res = await fetch('/api/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: payload.name, startTime: payload.startTime, endTime: payload.endTime,
        minStaff: payload.minStaff ?? 1, type: payload.type ?? 'mid', locationId,
      }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      showToast(d.error ?? 'Dienst konnte nicht angelegt werden', 'error')
      return false
    }
    const d = await res.json()
    setShifts(prev => [...prev, d.shift])
    return true
  }
  const deleteShift = async (id: string) => {
    const res = await fetch(`/api/shifts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setShifts(prev => prev.filter(s => s.id !== id))
      showToast('Dienst gelöscht', 'success')
    } else {
      const d = await res.json().catch(() => ({}))
      showToast(d.error ?? 'Löschen fehlgeschlagen', 'error')
    }
  }

  // ── Schritt 3: Struktur ───────────────────────────────────────────────────
  const [newUnit, setNewUnit] = useState({ name: '', type: 'gruppe' as 'gruppe' | 'etage', parentId: '', minStaff: 1 })
  const addUnit = async (data?: { name: string; type: string; parentId?: string | null; minStaff?: number }) => {
    const payload = data ?? { ...newUnit, parentId: newUnit.type === 'gruppe' && newUnit.parentId ? newUnit.parentId : null }
    if (!payload.name.trim() || !locationId) return null
    if (units.some(u => u.name.trim().toLowerCase() === payload.name.trim().toLowerCase())) {
      showToast(`„${payload.name}" existiert bereits`, 'error')
      return null
    }
    const res = await fetch('/api/planning-units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, name: payload.name.trim(), type: payload.type, parentId: payload.parentId ?? null, minStaff: payload.minStaff ?? 1 }),
    })
    if (!res.ok) return null
    const d = await res.json()
    setUnits(prev => [...prev.filter(u => u.id !== d.unit.id), d.unit])
    return d.unit as WizUnit
  }
  const deleteUnit = async (id: string) => {
    const res = await fetch(`/api/planning-units?id=${id}`, { method: 'DELETE' })
    if (res.ok) setUnits(prev => prev.filter(u => u.id !== id).map(u => u.parentId === id ? { ...u, parentId: null } : u))
  }

  // ── Schritt 5: Regeln ─────────────────────────────────────────────────────
  const [savingBase, setSavingBase] = useState(false)
  const saveBaseRules = async () => {
    if (!locationId) return
    setSavingBase(true)
    try {
      const res = await fetch('/api/planning-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, ...baseRules }),
      })
      if (!res.ok) throw new Error()
      showToast('Basiswerte gespeichert', 'success')
    } catch { showToast('Speichern fehlgeschlagen', 'error') } finally { setSavingBase(false) }
  }
  const [rulesText, setRulesText] = useState('')
  const [submittingRules, setSubmittingRules] = useState(false)
  const [ruleResults, setRuleResults] = useState<{ text: string; ok: boolean; info: string }[]>([])
  const submitRules = async (lines?: string[]) => {
    const items = (lines ?? rulesText.split('\n')).map(l => l.trim()).filter(Boolean)
    if (items.length === 0) return
    setSubmittingRules(true)
    const results: { text: string; ok: boolean; info: string }[] = []
    for (const line of items) {
      try {
        const res = await fetch('/api/admin/custom-constraints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: line.length > 60 ? `${line.slice(0, 57)}…` : line, description: line }),
        })
        const d = await res.json().catch(() => ({}))
        if (res.ok) { results.push({ text: line, ok: true, info: 'Code erstellt — zur Prüfung' }); setConstraintCount(c => c + 1) }
        else results.push({ text: line, ok: false, info: d.error ?? 'Fehlgeschlagen' })
      } catch { results.push({ text: line, ok: false, info: 'Netzwerkfehler' }) }
      setRuleResults([...results])
    }
    setSubmittingRules(false)
    setRulesText('')
  }

  // ── KI-Ausfüllhilfe ───────────────────────────────────────────────────────
  const [aiOpen, setAiOpen] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [applying, setApplying] = useState(false)

  const analyze = async (useOnboarding: boolean) => {
    setAiLoading(true)
    setProposal(null)
    try {
      const res = await fetch('/api/admin/setup-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: useOnboarding ? undefined : aiText }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      const p = d.proposal as Proposal
      setProposal(p)
      const init: Record<string, boolean> = {}
      p.schichten.forEach((_, i) => { init[`s${i}`] = true })
      p.etagen.forEach((_, i) => { init[`e${i}`] = true })
      p.gruppen.forEach((_, i) => { init[`g${i}`] = true })
      p.regeln.forEach((_, i) => { init[`r${i}`] = true })
      if (p.arbeitstage?.length) init['tage'] = true
      if (p.basiswerte) init['basis'] = true
      setChecked(init)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Analyse fehlgeschlagen', 'error')
    } finally { setAiLoading(false) }
  }

  const applyProposal = async () => {
    if (!proposal) return
    setApplying(true)
    let applied = 0
    try {
      if (checked['tage'] && proposal.arbeitstage?.length) {
        await applyBetriebsform(proposal.arbeitstage as WochentagKuerzel[]); applied++
      }
      // Etagen zuerst (Gruppen brauchen die IDs)
      const etageIdByName = new Map<string, string>()
      units.filter(u => u.type === 'etage').forEach(u => etageIdByName.set(u.name.toLowerCase(), u.id))
      for (let i = 0; i < proposal.etagen.length; i++) {
        if (!checked[`e${i}`]) continue
        const e = proposal.etagen[i]
        const existing = units.find(u => u.name.toLowerCase() === e.name.toLowerCase())
        if (existing) { etageIdByName.set(e.name.toLowerCase(), existing.id); continue }
        const created = await addUnit({ name: e.name, type: 'etage', minStaff: e.minStaffFruehSpaet ?? 1 })
        if (created) { etageIdByName.set(e.name.toLowerCase(), created.id); applied++ }
      }
      for (let i = 0; i < proposal.gruppen.length; i++) {
        if (!checked[`g${i}`]) continue
        const g = proposal.gruppen[i]
        const parentId = g.etage ? etageIdByName.get(g.etage.toLowerCase()) ?? null : null
        const created = await addUnit({ name: g.name, type: 'gruppe', parentId, minStaff: g.minStaffProTag ?? 1 })
        if (created) applied++
      }
      for (let i = 0; i < proposal.schichten.length; i++) {
        if (!checked[`s${i}`]) continue
        const s = proposal.schichten[i]
        const ok = await addShift({ name: s.name, startTime: s.von, endTime: s.bis, minStaff: s.minStaff })
        if (ok) applied++
      }
      if (checked['basis'] && proposal.basiswerte && locationId) {
        const next = {
          maxWeeklyHours: proposal.basiswerte.maxWeeklyHours ?? baseRules.maxWeeklyHours,
          restHours: proposal.basiswerte.restHours ?? baseRules.restHours,
          maxConsecutiveDays: proposal.basiswerte.maxConsecutiveDays ?? baseRules.maxConsecutiveDays,
        }
        setBaseRules(next)
        await fetch('/api/planning-rules', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationId, ...next }),
        })
        applied++
      }
      const regelLines = proposal.regeln.filter((_, i) => checked[`r${i}`])
      if (regelLines.length > 0) {
        await submitRules(regelLines)
        applied += regelLines.length
      }
      showToast(`${applied} Position(en) übernommen`, 'success')
      setProposal(null)
    } catch {
      showToast('Übernahme teilweise fehlgeschlagen — Listen prüfen', 'error')
    } finally { setApplying(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="p-6 flex justify-center min-h-[300px] items-center"><Loader2 size={24} className="animate-spin text-brand" /></div>
  }

  const etagen = units.filter(u => u.type === 'etage')
  const gruppen = units.filter(u => u.type !== 'etage')
  const ohneStammgruppe = employees.filter(e => !e.gruppe?.trim()).length
  const currentForm = BETRIEBSFORMEN.find(b => b.tage.length === arbeitstage.length && b.tage.every(t => arbeitstage.includes(t)))

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="font-bold text-navy text-xl">Standort einrichten</h1>
        <p className="text-sm text-gray-500">
          Fünf Schritte zur fertigen Dienstplanung. Alles, was du hier einträgst, gilt exakt so — nichts wird automatisch verändert.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          return (
            <button
              key={s.key}
              onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                i === step ? 'bg-navy text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
              }`}
            >
              <Icon size={13} />{i + 1}. {s.label}
            </button>
          )
        })}
      </div>

      {/* KI-Ausfüllhilfe */}
      <Card padding="md" className="border-purple-100">
        <button onClick={() => setAiOpen(o => !o)} className="w-full flex items-center gap-2 text-left">
          <Sparkles size={14} className="text-purple-500" />
          <span className="text-xs font-semibold text-gray-600">KI-Ausfüllhilfe — Betrieb beschreiben, Vorschläge prüfen, übernehmen</span>
          <span className="ml-auto text-[10px] text-purple-400 bg-purple-50 rounded-full px-2 py-0.5">schreibt nichts ohne dein OK</span>
        </button>
        {aiOpen && (
          <div className="mt-3 space-y-3">
            <textarea
              value={aiText}
              onChange={e => setAiText(e.target.value)}
              rows={4}
              placeholder='Beschreibe deinen Betrieb frei, z.B. "Kita mit zwei Etagen, oben 4 Gruppen, unten 4 Gruppen, je zwei Erzieher pro Gruppe. Frühdienst ab 6:00, Spätdienst bis 17:00…"'
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300/40 placeholder:text-gray-300 resize-none"
            />
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => analyze(false)} disabled={aiLoading || !aiText.trim()} className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white border-0">
                {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}Text analysieren
              </Button>
              <Button size="sm" variant="secondary" onClick={() => analyze(true)} disabled={aiLoading} className="gap-1.5">
                {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}Vorhandenes Onboarding analysieren
              </Button>
            </div>

            {proposal && (
              <div className="border border-purple-100 rounded-xl p-3 space-y-3 bg-purple-50/30">
                <p className="text-xs font-semibold text-purple-700">Vorschläge — Haken setzen und übernehmen:</p>
                {proposal.arbeitstage && proposal.arbeitstage.length > 0 && (
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={!!checked['tage']} onChange={e => setChecked(p => ({ ...p, tage: e.target.checked }))} className="accent-purple-600" />
                    <span><b>Arbeitstage:</b> {proposal.arbeitstage.join(', ')}</span>
                  </label>
                )}
                {proposal.schichten.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase">Dienste</p>
                    {proposal.schichten.map((s, i) => (
                      <label key={i} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={!!checked[`s${i}`]} onChange={e => setChecked(p => ({ ...p, [`s${i}`]: e.target.checked }))} className="accent-purple-600" />
                        <span>{s.name} · {s.von}–{s.bis}{s.minStaff ? ` · min. ${s.minStaff}` : ''}</span>
                        {shifts.some(x => x.name.toLowerCase() === s.name.toLowerCase()) && <span className="text-[10px] text-gray-400">(existiert schon)</span>}
                      </label>
                    ))}
                  </div>
                )}
                {(proposal.etagen.length > 0 || proposal.gruppen.length > 0) && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase">Struktur</p>
                    {proposal.etagen.map((e, i) => (
                      <label key={i} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={!!checked[`e${i}`]} onChange={ev => setChecked(p => ({ ...p, [`e${i}`]: ev.target.checked }))} className="accent-purple-600" />
                        <span>🏢 Etage {e.name}{e.minStaffFruehSpaet ? ` · Früh/Spät je ${e.minStaffFruehSpaet}` : ''}</span>
                      </label>
                    ))}
                    {proposal.gruppen.map((g, i) => (
                      <label key={i} className="flex items-center gap-2 text-xs cursor-pointer pl-4">
                        <input type="checkbox" checked={!!checked[`g${i}`]} onChange={ev => setChecked(p => ({ ...p, [`g${i}`]: ev.target.checked }))} className="accent-purple-600" />
                        <span>👥 {g.name}{g.etage ? ` (${g.etage})` : ''}{g.minStaffProTag ? ` · ${g.minStaffProTag}/Tag` : ''}</span>
                        {units.some(x => x.name.toLowerCase() === g.name.toLowerCase()) && <span className="text-[10px] text-gray-400">(existiert schon)</span>}
                      </label>
                    ))}
                  </div>
                )}
                {proposal.basiswerte && (
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={!!checked['basis']} onChange={e => setChecked(p => ({ ...p, basis: e.target.checked }))} className="accent-purple-600" />
                    <span><b>Basiswerte:</b> {proposal.basiswerte.maxWeeklyHours ?? '–'}h/Woche · {proposal.basiswerte.restHours ?? '–'}h Ruhe · max. {proposal.basiswerte.maxConsecutiveDays ?? '–'} Tage</span>
                  </label>
                )}
                {proposal.regeln.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase">Individuelle Regeln → werden zu Code (mit Prüfung)</p>
                    {proposal.regeln.map((r, i) => (
                      <label key={i} className="flex items-start gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={!!checked[`r${i}`]} onChange={e => setChecked(p => ({ ...p, [`r${i}`]: e.target.checked }))} className="accent-purple-600 mt-0.5" />
                        <span>{r}</span>
                      </label>
                    ))}
                  </div>
                )}
                <Button size="sm" onClick={applyProposal} disabled={applying} className="gap-1.5">
                  {applying ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Ausgewählte übernehmen
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Schritt-Inhalte */}
      {step === 0 && (
        <Card padding="lg">
          <p className="text-sm font-semibold text-navy mb-1">An welchen Tagen wird gearbeitet?</p>
          <p className="text-xs text-gray-400 mb-4">Nur markierte Tage werden verplant. Später jederzeit änderbar.</p>
          <div className="grid sm:grid-cols-3 gap-2">
            {BETRIEBSFORMEN.map(b => (
              <button
                key={b.label}
                onClick={() => applyBetriebsform(b.tage)}
                disabled={savingDays}
                className={`text-left border rounded-xl p-3 transition-all ${
                  currentForm?.label === b.label ? 'border-brand bg-brand/5 ring-2 ring-brand/20' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-semibold text-navy">{b.label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{b.hint}</p>
                {currentForm?.label === b.label && <p className="text-[10px] text-brand font-semibold mt-1">✓ Aktiv</p>}
              </button>
            ))}
          </div>
          {arbeitstage.length > 0 && !currentForm && (
            <p className="text-xs text-gray-500 mt-3">Aktuell individuell: {arbeitstage.join(', ')} — Feinjustierung im <Link href="/admin/model" className="text-brand hover:underline">Planungsmodell</Link>.</p>
          )}
        </Card>
      )}

      {step === 1 && (
        <Card padding="lg">
          <p className="text-sm font-semibold text-navy mb-1">Welche Dienste gibt es?</p>
          <p className="text-xs text-gray-400 mb-4">
            Trage exakt die Dienste ein, die es wirklich gibt. Du gibst nur die Zeit an, die <b>wirklich feststeht</b> —
            ob das der Beginn oder das Ende ist, wählst du je Dienst.
          </p>
          <div className="space-y-1.5 mb-4">
            {shifts.map(s => (
              <div key={s.id} className="flex items-center gap-3 border border-gray-100 rounded-xl px-3 py-2 group">
                <span className="text-sm font-medium text-navy flex-1">{s.name}</span>
                <span className="text-xs text-gray-500">
                  {s.type === 'early' ? (
                    <>ab <b className="text-navy">{s.startTime}</b> <span className="text-gray-400">(bis max. {s.endTime})</span></>
                  ) : s.type === 'late' ? (
                    <><span className="text-gray-400">(ab frühestens {s.startTime})</span> bis <b className="text-navy">{s.endTime}</b></>
                  ) : (
                    <>{s.startTime} – {s.endTime}</>
                  )}
                </span>
                <span className="text-[10px] text-gray-400">min. {s.minStaff}</span>
                <button onClick={() => deleteShift(s.id)} className="p-1 rounded-lg text-gray-400 hover:text-red-600 transition-opacity">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {shifts.length === 0 && <p className="text-sm text-gray-400 italic">Noch keine Dienste angelegt.</p>}
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1.5">Welche Zeit steht fest?</label>
              <div className="flex gap-2 flex-wrap">
                {([
                  ['early', 'Der Beginn', 'z.B. Frühdienst: startet immer 06:00, Ende je nach Stunden'],
                  ['late', 'Das Ende', 'z.B. Spätdienst: endet immer 17:00, Beginn je nach Stunden'],
                ] as const).map(([val, label, hint]) => (
                  <button
                    key={val}
                    onClick={() => setAnchor(val)}
                    className={`text-left border rounded-xl px-3 py-2 flex-1 min-w-[200px] transition-all ${
                      newShift.anchor === val ? 'border-brand bg-brand/5 ring-2 ring-brand/20' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-xs font-semibold text-navy">{label} steht fest</p>
                    <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{hint}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]">
                <label className="text-[10px] font-semibold text-gray-400 uppercase">Name</label>
                <input value={newShift.name} onChange={e => setNewShift(p => ({ ...p, name: e.target.value }))}
                  placeholder={newShift.anchor === 'early' ? 'z.B. Frühdienst' : 'z.B. Spätdienst'}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              {newShift.anchor === 'early' ? (
                <>
                  <div>
                    <label className="text-[10px] font-semibold text-brand uppercase">Beginn (fest)</label>
                    <input type="time" value={newShift.startTime}
                      onChange={e => setNewShift(p => ({ ...p, startTime: e.target.value, endTime: fmtTime(shiftMinutes(e.target.value) + FRAME_MIN) }))}
                      className="text-sm border-2 border-brand/40 rounded-lg px-2 py-1 block font-semibold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase">Ende spätestens</label>
                    <input type="time" value={newShift.endTime} onChange={e => setNewShift(p => ({ ...p, endTime: e.target.value }))}
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 block text-gray-500" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase">Beginn frühestens</label>
                    <input type="time" value={newShift.startTime} onChange={e => setNewShift(p => ({ ...p, startTime: e.target.value }))}
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 block text-gray-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-brand uppercase">Ende (fest)</label>
                    <input type="time" value={newShift.endTime}
                      onChange={e => setNewShift(p => ({ ...p, endTime: e.target.value, startTime: fmtTime(shiftMinutes(e.target.value) - FRAME_MIN) }))}
                      className="text-sm border-2 border-brand/40 rounded-lg px-2 py-1 block font-semibold" />
                  </div>
                </>
              )}
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase">Min.</label>
                <input type="number" min={0} max={50} value={newShift.minStaff} onChange={e => setNewShift(p => ({ ...p, minStaff: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center block" />
              </div>
              <Button size="sm" onClick={async () => { setAddingShift(true); if (await addShift()) setNewShift(p => ({ ...p, name: '' })); setAddingShift(false) }}
                disabled={!newShift.name.trim() || addingShift} className="gap-1">
                {addingShift ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}Anlegen
              </Button>
            </div>
            <p className="text-[11px] text-gray-400">
              Nur die <span className="text-brand font-semibold">fett markierte</span> Zeit ist verbindlich. Die andere Seite
              ist der Rahmen — wie lange jemand tatsächlich bleibt, ergibt sich aus seinen Wochenstunden (inkl. Pause).
            </p>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card padding="lg">
          <p className="text-sm font-semibold text-navy mb-1">Gibt es Etagen, Bereiche oder Gruppen?</p>
          <p className="text-xs text-gray-400 mb-4">
            Optional. Mit Struktur stellt der Dienstplan sicher, dass jede Gruppe täglich besetzt ist und jede Etage
            Früh- und Spätdienst hat. Ohne Gruppen einfach weiter zu Schritt 4.
          </p>
          {units.length > 0 && (
            <div className="rounded-xl border border-gray-100 divide-y divide-gray-100 mb-4">
              {[...etagen, ...gruppen.filter(g => !g.parentId)].map(top => {
                const children = top.type === 'etage' ? gruppen.filter(g => g.parentId === top.id) : []
                return [top, ...children].map(u => (
                  <div key={u.id} className={`flex items-center gap-2 px-3 py-2 group ${u.type === 'etage' ? 'bg-gray-50/60' : ''}`}>
                    <span className={`text-sm ${u.id !== top.id ? 'pl-5' : ''} ${u.type === 'etage' ? 'font-semibold' : ''} text-navy`}>
                      {u.type === 'etage' ? '🏢 ' : '👥 '}{u.name}
                    </span>
                    <span className="ml-auto text-[10px] text-gray-400">{u.type === 'etage' ? `Früh/Spät je ${u.minStaff}` : `${u.minStaff}/Tag`}</span>
                    <button onClick={() => deleteUnit(u.id)} className="p-1 rounded-lg text-gray-400 hover:text-red-600 transition-opacity">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              })}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase">Typ</label>
              <select value={newUnit.type} onChange={e => setNewUnit(p => ({ ...p, type: e.target.value as 'gruppe' | 'etage' }))}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 block">
                <option value="gruppe">Gruppe</option>
                <option value="etage">Etage</option>
              </select>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] font-semibold text-gray-400 uppercase">Name</label>
              <input value={newUnit.name} onChange={e => setNewUnit(p => ({ ...p, name: e.target.value }))} placeholder={newUnit.type === 'etage' ? 'z.B. Erdgeschoss' : 'z.B. Igelgruppe'}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20" />
            </div>
            {newUnit.type === 'gruppe' && etagen.length > 0 && (
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase">Etage</label>
                <select value={newUnit.parentId} onChange={e => setNewUnit(p => ({ ...p, parentId: e.target.value }))}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 block">
                  <option value="">Keine</option>
                  {etagen.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase">{newUnit.type === 'etage' ? 'Früh/Spät' : 'Pro Tag'}</label>
              <input type="number" min={0} max={50} value={newUnit.minStaff} onChange={e => setNewUnit(p => ({ ...p, minStaff: Math.max(0, parseInt(e.target.value) || 0) }))}
                className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center block" />
            </div>
            <Button size="sm" onClick={async () => { if (await addUnit()) setNewUnit(p => ({ ...p, name: '' })) }} disabled={!newUnit.name.trim()} className="gap-1">
              <Plus size={13} />Anlegen
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card padding="lg">
          <p className="text-sm font-semibold text-navy mb-1">Dein Team</p>
          <p className="text-xs text-gray-400 mb-4">
            Mitarbeiter mit Wochenstunden, Arbeitstagen, festen freien Tagen und Stammgruppe — das Herzstück der Planung.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div className="border border-gray-100 rounded-xl p-3">
              <p className="text-2xl font-bold text-navy">{employees.length}</p>
              <p className="text-xs text-gray-500">Mitarbeiter angelegt</p>
            </div>
            <div className={`border rounded-xl p-3 ${ohneStammgruppe > 0 && gruppen.length > 0 ? 'border-amber-200 bg-amber-50/50' : 'border-gray-100'}`}>
              <p className="text-2xl font-bold text-navy">{gruppen.length > 0 ? ohneStammgruppe : '—'}</p>
              <p className="text-xs text-gray-500">{gruppen.length > 0 ? 'davon ohne Stammgruppe' : 'Keine Gruppen konfiguriert'}</p>
            </div>
          </div>
          <Link href="/admin/employees">
            <Button size="sm" className="gap-1.5"><ExternalLink size={13} />Mitarbeiter verwalten</Button>
          </Link>
        </Card>
      )}

      {step === 4 && (
        <Card padding="lg">
          <p className="text-sm font-semibold text-navy mb-1">Regeln</p>
          <p className="text-xs text-gray-400 mb-4">
            Drei gesetzliche Basiswerte — plus deine individuellen Regeln, die als geprüfter Code in den Planer einfließen.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {([
              ['maxWeeklyHours', 'Max. Std./Woche'],
              ['restHours', 'Ruhezeit (Std.)'],
              ['maxConsecutiveDays', 'Max. Folgetage'],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] font-semibold text-gray-400 uppercase">{label}</label>
                <input type="number" min={1} max={80} value={baseRules[key]}
                  onChange={e => setBaseRules(p => ({ ...p, [key]: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
            ))}
          </div>
          <Button size="sm" variant="secondary" onClick={saveBaseRules} disabled={savingBase} className="gap-1.5 mb-5">
            {savingBase ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Basiswerte speichern
          </Button>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Individuelle Regeln (eine pro Zeile)</p>
            <p className="text-[11px] text-gray-400 mb-2">
              Werden in CP-SAT-Code übersetzt und erscheinen unter <Link href="/admin/model" className="text-brand hover:underline">Planungsmodell → Custom-Regeln</Link> zur Prüfung ({constraintCount} vorhanden).
            </p>
            <textarea
              value={rulesText}
              onChange={e => setRulesText(e.target.value)}
              rows={4}
              placeholder={'Franka arbeitet täglich 7:00–15:30\nKatrin ist dienstags im Bereich Unten\nJede Gruppe braucht ab 8:00 mindestens 2 Kräfte'}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20 placeholder:text-gray-300 resize-none"
            />
            <Button size="sm" onClick={() => submitRules()} disabled={submittingRules || !rulesText.trim()} className="gap-1.5 mt-2">
              {submittingRules ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}Als Code-Regeln erstellen
            </Button>
            {ruleResults.length > 0 && (
              <div className="mt-3 space-y-1">
                {ruleResults.map((r, i) => (
                  <p key={i} className={`text-xs ${r.ok ? 'text-green-600' : 'text-red-500'}`}>
                    {r.ok ? '✓' : '✕'} {r.text.slice(0, 70)} — {r.info}
                  </p>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className="gap-1">
          <ChevronLeft size={14} />Zurück
        </Button>
        {step < STEPS.length - 1 ? (
          <Button size="sm" onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))} className="gap-1">
            Weiter<ChevronRight size={14} />
          </Button>
        ) : (
          <Link href="/admin/schedule">
            <Button size="sm" className="gap-1.5"><Check size={14} />Fertig — zum Dienstplan</Button>
          </Link>
        )}
      </div>
    </div>
  )
}
