'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { UserPlus, CheckCircle2 } from 'lucide-react'
import type { EmployeeDraft } from '@/lib/employee-draft'

const ROLE_OPTIONS = ['Erzieher', 'Leitung', 'Stellvertretung', 'Springer', 'Verwaltung', 'Praktikant', 'Auszubildender', 'Hauswirtschaft', 'Sonstige']
const EMPLOYMENT_OPTIONS = ['Vollzeit', 'Teilzeit', 'Minijob', 'Individuell']

const EMPTY_DRAFT: EmployeeDraft = { weeklyHours: 38, multiGroupCapable: false }

function toCsv(values?: string[]) {
  return values?.join(', ') ?? ''
}

function fromCsv(value: string): string[] | undefined {
  const items = value.split(',').map(v => v.trim()).filter(Boolean)
  return items.length > 0 ? items : undefined
}

export function EmployeeCreationForm({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (draft: EmployeeDraft) => Promise<void>
}) {
  const [draft, setDraft] = useState<EmployeeDraft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function update<K extends keyof EmployeeDraft>(key: K, value: EmployeeDraft[K]) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  function reset() {
    setDraft(EMPTY_DRAFT)
    setError(null)
    setDone(false)
  }

  async function handleSubmit() {
    if (!draft.name?.trim() || !draft.email?.trim()) {
      setError('Name und E-Mail sind erforderlich')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSave(draft)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mitarbeiter konnte nicht angelegt werden')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <Modal open={open} onClose={() => { reset(); onClose() }} title="Mitarbeiter angelegt" size="md">
        <div className="text-center py-4">
          <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
          <p className="text-navy font-semibold">{draft.name} wurde im System angelegt</p>
          <p className="text-sm text-gray-500 mt-1">Einladung per E-Mail wird versendet</p>
          <Button className="mt-5 w-full" onClick={() => { reset(); onClose() }}>Schließen</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Mitarbeiter per Formular anlegen" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name *" value={draft.name ?? ''} onChange={e => update('name', e.target.value)} placeholder="Vor- und Nachname" />
          <Input label="E-Mail *" type="email" value={draft.email ?? ''} onChange={e => update('email', e.target.value)} placeholder="name@beispiel.de" />
          <Input label="Telefon" value={draft.phone ?? ''} onChange={e => update('phone', e.target.value)} />
          <Input label="Geburtsdatum" type="date" value={draft.birthDate ?? ''} onChange={e => update('birthDate', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Gruppe" value={draft.gruppe ?? ''} onChange={e => update('gruppe', e.target.value)} />
          <Input label="Bereich" value={draft.bereich ?? ''} onChange={e => update('bereich', e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={!!draft.multiGroupCapable}
            onChange={e => update('multiGroupCapable', e.target.checked)}
            className="rounded accent-brand"
          />
          Kann in mehreren Gruppen eingesetzt werden
        </label>

        <Input label="Feste Einsatzorte" value={draft.fixedLocations ?? ''} onChange={e => update('fixedLocations', e.target.value)} hint="Falls die Person nur an bestimmten Standorten eingesetzt werden kann" />

        <div className="grid grid-cols-2 gap-3">
          <Select label="Rolle" value={draft.roleType ?? ''} onChange={e => update('roleType', e.target.value || undefined)}>
            <option value="">Bitte wählen</option>
            {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Select label="Beschäftigungsart" value={draft.employmentType ?? ''} onChange={e => update('employmentType', e.target.value || undefined)}>
            <option value="">Bitte wählen</option>
            {EMPLOYMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </Select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5">Wochenstunden</label>
          <div className="flex items-center gap-3">
            <input
              type="range" min={5} max={60} step={1}
              value={draft.weeklyHours ?? 38}
              onChange={e => update('weeklyHours', Number(e.target.value))}
              className="flex-1 accent-brand"
            />
            <span className="font-bold text-navy w-12 text-center">{draft.weeklyHours ?? 38}h</span>
          </div>
        </div>

        <Input
          label="Qualifikationen"
          value={toCsv(draft.qualifications)}
          onChange={e => update('qualifications', fromCsv(e.target.value))}
          hint="Kommagetrennt, z.B. Erste-Hilfe-Schein, Schwimmbefähigung"
        />
        <Input
          label="Erlaubte Aufgaben"
          value={toCsv(draft.allowedTasks)}
          onChange={e => update('allowedTasks', fromCsv(e.target.value))}
          hint="Kommagetrennt – fließt in die Dienstplanung ein"
        />
        <Input
          label="Persönliche Besonderheiten"
          value={toCsv(draft.besonderheiten)}
          onChange={e => update('besonderheiten', fromCsv(e.target.value))}
          hint="Kommagetrennt, z.B. Alleinerziehend, kein Führerschein, Wunsch nach Frühdiensten"
        />
        <Textarea
          label="Individuelle Absprachen"
          value={draft.absprachen ?? ''}
          onChange={e => update('absprachen', e.target.value || undefined)}
          placeholder="z.B. feste Bürozeit montags, nie Spätdienst am Freitag"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button className="w-full gap-2" loading={saving} onClick={handleSubmit}>
          <UserPlus size={16} />
          Mitarbeiter anlegen
        </Button>
      </div>
    </Modal>
  )
}
