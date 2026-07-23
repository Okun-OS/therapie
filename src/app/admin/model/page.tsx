'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/lib/toast-context'
import {
  ShieldAlert,
  Heart,
  Plus,
  Trash2,
  Loader2,
  Clock,
  Users,
  MessageCircle,
  Save,
  Brain,
  CalendarDays,
} from 'lucide-react'

const ALL_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const
type Wochentag = typeof ALL_DAYS[number]
import type { LocationModel, HarteRegel, WeicheRegel } from '@/lib/company-model-types'
import Link from 'next/link'

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

  const load = useCallback(async () => {
    const [modelRes, shiftsRes] = await Promise.all([
      fetch('/api/location-model'),
      fetch('/api/shifts'),
    ])
    const [modelData, shiftsData] = await Promise.all([modelRes.json(), shiftsRes.json()])
    setModel(modelData.model ?? null)
    setShifts((shiftsData.shifts as DbShift[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDeleteHardRule = (ruleId: string) => {
    setModel(prev => prev ? {
      ...prev,
      planungsRegeln: { ...prev.planungsRegeln, hart: prev.planungsRegeln.hart.filter(r => r.id !== ruleId) },
    } : prev)
  }

  const handleDeleteSoftRule = (ruleId: string) => {
    setModel(prev => prev ? {
      ...prev,
      planungsRegeln: { ...prev.planungsRegeln, weich: prev.planungsRegeln.weich.filter(r => r.id !== ruleId) },
    } : prev)
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

  const handleDayToggle = async (day: Wochentag) => {
    if (!model || savingDays) return
    const current = model.schichtmodell?.arbeitstage ?? ['Mo', 'Di', 'Mi', 'Do', 'Fr']
    const next = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day].sort((a, b) => ALL_DAYS.indexOf(a as Wochentag) - ALL_DAYS.indexOf(b as Wochentag))
    if (next.length === 0) return // must keep at least one
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
      setModel(model) // revert
      showToast('Speichern fehlgeschlagen', 'error')
    } finally {
      setSavingDays(false)
    }
  }

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
            <Button className="gap-2">
              <MessageCircle size={16} />
              Zum Onboarding
            </Button>
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
            <MessageCircle size={14} />
            Onboarding-Chat
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
            const active = (model.schichtmodell?.arbeitstage ?? ['Mo', 'Di', 'Mi', 'Do', 'Fr']).includes(day)
            const isWeekend = day === 'Sa' || day === 'So'
            return (
              <button
                key={day}
                onClick={() => handleDayToggle(day)}
                disabled={savingDays}
                className={[
                  'w-10 h-10 rounded-xl text-sm font-semibold transition-all select-none',
                  active
                    ? isWeekend
                      ? 'bg-brand text-white shadow-sm shadow-brand/30'
                      : 'bg-navy text-white'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200',
                  savingDays ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                ].join(' ')}
              >
                {day}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Nur markierte Tage werden beim Dienstplan verplant.
        </p>
      </Card>

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
      {shifts.length > 0 && (
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Schichten &amp; Mindestbesetzung</p>
          </div>
          <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {shifts.map(s => {
              const current = minEdits[s.id] ?? s.minStaff
              const edited = current !== s.minStaff
              return (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5">
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
                      value={current}
                      onChange={e => setMinEdits(prev => ({ ...prev, [s.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className={`w-14 text-center text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors ${edited ? 'border-brand bg-brand/5 font-semibold text-brand' : 'border-gray-200 text-navy'}`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

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
          <Button
            size="sm"
            onClick={handleAddRule}
            disabled={!ruleText.trim() || addingRule}
            className="gap-1.5 flex-shrink-0"
          >
            {addingRule ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {addingRule ? 'KI...' : 'Hinzufügen'}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Die KI erkennt automatisch, ob es eine harte oder weiche Regel ist.
        </p>
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
