'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/lib/toast-context'
import {
  Building2,
  MapPin,
  ShieldAlert,
  Heart,
  Plus,
  Trash2,
  Loader2,
  Clock,
  Users,
  MessageCircle,
  Save,
} from 'lucide-react'
import type { CompanyModel, HarteRegel, WeicheRegel, StandortModell } from '@/lib/company-model-types'
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

export default function CompanyModelPage() {
  const { showToast } = useToast()
  const [model, setModel] = useState<CompanyModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Per-location rule-add state
  const [addingRule, setAddingRule] = useState<Record<string, { text: string; busy: boolean }>>({})

  // Track minBesetzung edits per schicht
  const [minBesetzungEdits, setMinBesetzungEdits] = useState<Record<string, number>>({})

  useEffect(() => {
    fetch('/api/company-model')
      .then(r => r.json())
      .then(d => setModel(d.model))
      .finally(() => setLoading(false))
  }, [])

  const handleDeleteHardRule = (locationId: string, ruleId: string) => {
    setModel(prev => {
      if (!prev) return prev
      return {
        ...prev,
        standortModelle: prev.standortModelle.map(sm =>
          sm.locationId !== locationId ? sm : {
            ...sm,
            planungsRegeln: {
              ...sm.planungsRegeln,
              hart: sm.planungsRegeln.hart.filter(r => r.id !== ruleId),
            },
          }
        ),
      }
    })
  }

  const handleDeleteSoftRule = (locationId: string, ruleId: string) => {
    setModel(prev => {
      if (!prev) return prev
      return {
        ...prev,
        standortModelle: prev.standortModelle.map(sm =>
          sm.locationId !== locationId ? sm : {
            ...sm,
            planungsRegeln: {
              ...sm.planungsRegeln,
              weich: sm.planungsRegeln.weich.filter(r => r.id !== ruleId),
            },
          }
        ),
      }
    })
  }

  const handleAddRule = async (locationId: string) => {
    const state = addingRule[locationId]
    if (!state?.text.trim()) return

    setAddingRule(prev => ({ ...prev, [locationId]: { ...prev[locationId], busy: true } }))
    try {
      const res = await fetch('/api/company-model/add-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: state.text.trim(), locationId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setModel(data.model)
      setAddingRule(prev => ({ ...prev, [locationId]: { text: '', busy: false } }))
      showToast('Regel hinzugefügt', 'success')
    } catch {
      showToast('Regel konnte nicht hinzugefügt werden', 'error')
      setAddingRule(prev => ({ ...prev, [locationId]: { ...prev[locationId], busy: false } }))
    }
  }

  const handleMinBesetzungChange = (locationId: string, schichtId: string, value: number) => {
    setMinBesetzungEdits(prev => ({ ...prev, [`${locationId}|${schichtId}`]: value }))
  }

  const getMinBesetzung = (locationId: string, schichtId: string, original: number) =>
    minBesetzungEdits[`${locationId}|${schichtId}`] ?? original

  const hasMinBesetzungChanges = Object.keys(minBesetzungEdits).length > 0

  const handleSaveMinBesetzung = async () => {
    if (!model) return
    setSaving(true)
    const updatedModel: CompanyModel = {
      ...model,
      standortModelle: model.standortModelle.map(sm => ({
        ...sm,
        schichtmodell: {
          ...sm.schichtmodell,
          schichten: sm.schichtmodell.schichten.map(s => ({
            ...s,
            minBesetzungGesamt: getMinBesetzung(sm.locationId, s.id, s.minBesetzungGesamt),
          })),
        },
      })),
    }
    try {
      const res = await fetch('/api/company-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: updatedModel }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setModel(data.model)
      setMinBesetzungEdits({})
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
          <Building2 size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="font-semibold text-navy mb-1">Kein Unternehmensmodell vorhanden</p>
          <p className="text-sm text-gray-500 mb-5">
            Führe zuerst das Onboarding durch, damit ein Planungsmodell erstellt wird.
          </p>
          <Link href="/company/onboarding">
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
          <h1 className="font-bold text-navy text-xl">{model.organisation.name}</h1>
          <p className="text-sm text-gray-500">{model.organisation.branche} · {model.organisation.betriebsTyp}</p>
        </div>
        <Link href="/company/onboarding">
          <Button variant="secondary" size="sm" className="gap-1.5">
            <MessageCircle size={14} />
            Onboarding-Chat
          </Button>
        </Link>
      </div>

      {hasMinBesetzungChanges && (
        <div className="flex items-center justify-between gap-3 bg-brand/10 border border-brand/20 rounded-xl px-4 py-3">
          <p className="text-sm text-navy font-medium">Mindestbesetzung wurde geändert.</p>
          <Button size="sm" onClick={handleSaveMinBesetzung} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Speichern
          </Button>
        </div>
      )}

      {/* Standorte */}
      {model.standortModelle.map(sm => (
        <StandortCard
          key={sm.locationId}
          sm={sm}
          addingRule={addingRule[sm.locationId] ?? { text: '', busy: false }}
          onAddRuleTextChange={(text) =>
            setAddingRule(prev => ({ ...prev, [sm.locationId]: { ...(prev[sm.locationId] ?? { busy: false }), text } }))
          }
          onAddRule={() => handleAddRule(sm.locationId)}
          onDeleteHardRule={(ruleId) => handleDeleteHardRule(sm.locationId, ruleId)}
          onDeleteSoftRule={(ruleId) => handleDeleteSoftRule(sm.locationId, ruleId)}
          getMinBesetzung={(schichtId, original) => getMinBesetzung(sm.locationId, schichtId, original)}
          onMinBesetzungChange={(schichtId, value) => handleMinBesetzungChange(sm.locationId, schichtId, value)}
        />
      ))}
    </div>
  )
}

interface StandortCardProps {
  sm: StandortModell
  addingRule: { text: string; busy: boolean }
  onAddRuleTextChange: (text: string) => void
  onAddRule: () => void
  onDeleteHardRule: (ruleId: string) => void
  onDeleteSoftRule: (ruleId: string) => void
  getMinBesetzung: (schichtId: string, original: number) => number
  onMinBesetzungChange: (schichtId: string, value: number) => void
}

function StandortCard({
  sm,
  addingRule,
  onAddRuleTextChange,
  onAddRule,
  onDeleteHardRule,
  onDeleteSoftRule,
  getMinBesetzung,
  onMinBesetzungChange,
}: StandortCardProps) {
  return (
    <Card padding="lg" className="space-y-5">
      {/* Location header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center flex-shrink-0">
          <MapPin size={17} className="text-navy" />
        </div>
        <div>
          <p className="font-bold text-navy">{sm.locationName}</p>
          <p className="text-xs text-gray-400">{sm.locationId}</p>
        </div>
      </div>

      {/* Schichten / Mindestbesetzung */}
      {sm.schichtmodell.schichten.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Schichten &amp; Mindestbesetzung</p>
          </div>
          <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {sm.schichtmodell.schichten.map(s => {
              const current = getMinBesetzung(s.id, s.minBesetzungGesamt)
              const edited = current !== s.minBesetzungGesamt
              return (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy truncate">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.von} – {s.bis}{s.uebernacht ? ' (Übernacht)' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Users size={13} className="text-gray-400" />
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={current}
                      onChange={e => onMinBesetzungChange(s.id, Math.max(1, parseInt(e.target.value) || 1))}
                      className={`w-14 text-center text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors ${edited ? 'border-brand bg-brand/5 font-semibold text-brand' : 'border-gray-200 text-navy'}`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Harte Regeln */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert size={14} className="text-red-400" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Harte Regeln</p>
          <span className="text-xs text-gray-400">({sm.planungsRegeln.hart.length})</span>
        </div>
        {sm.planungsRegeln.hart.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-1">Keine harten Regeln definiert.</p>
        ) : (
          <div className="space-y-1.5">
            {sm.planungsRegeln.hart.map(regel => (
              <HardRuleRow key={regel.id} regel={regel} onDelete={() => onDeleteHardRule(regel.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Weiche Regeln */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Heart size={14} className="text-brand" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Weiche Regeln</p>
          <span className="text-xs text-gray-400">({sm.planungsRegeln.weich.length})</span>
        </div>
        {sm.planungsRegeln.weich.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-1">Keine weichen Regeln definiert.</p>
        ) : (
          <div className="space-y-1.5">
            {sm.planungsRegeln.weich.map(regel => (
              <SoftRuleRow key={regel.id} regel={regel} onDelete={() => onDeleteSoftRule(regel.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Add Rule */}
      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Regel hinzufügen</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={addingRule.text}
            onChange={e => onAddRuleTextChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !addingRule.busy && onAddRule()}
            placeholder={'z. B. „Max. 2 Spätdienste pro Mitarbeiter pro Woche“'}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 placeholder:text-gray-300"
            disabled={addingRule.busy}
          />
          <Button
            size="sm"
            onClick={onAddRule}
            disabled={!addingRule.text.trim() || addingRule.busy}
            className="gap-1.5 flex-shrink-0"
          >
            {addingRule.busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {addingRule.busy ? 'KI...' : 'Hinzufügen'}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          KI erkennt automatisch, ob es eine harte oder weiche Regel ist.
        </p>
      </div>
    </Card>
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
