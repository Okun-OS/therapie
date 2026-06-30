'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { UserPlus, CheckCircle2 } from 'lucide-react'
import type { EmployeeDraft } from '@/lib/employee-draft'

const EMPLOYMENT_OPTIONS = ['Vollzeit', 'Teilzeit', 'Minijob', 'Individuell']
const NEW_ROLE_VALUE = '__new_role__'
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const EMPTY_DRAFT: EmployeeDraft = { weeklyHours: 38, multiGroupCapable: false }

function toCsv(values?: string[]) {
  return values?.join(', ') ?? ''
}

function fromCsv(value: string): string[] | undefined {
  const items = value.split(',').map(v => v.trim()).filter(Boolean)
  return items.length > 0 ? items : undefined
}

function toFreeText(values?: string[]) {
  return values?.join('\n') ?? ''
}

function fromFreeText(value: string): string[] | undefined {
  const trimmed = value.trim()
  return trimmed ? [trimmed] : undefined
}

export function EmployeeCreationForm({
  open,
  onClose,
  onSave,
  initialDraft,
  employeeName,
}: {
  open: boolean
  onClose: () => void
  onSave: (draft: EmployeeDraft) => Promise<void>
  initialDraft?: EmployeeDraft
  employeeName?: string
}) {
  const isEditMode = !!initialDraft
  const [draft, setDraft] = useState<EmployeeDraft>(initialDraft ?? EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [roles, setRoles] = useState<string[]>([])
  const [addingRole, setAddingRole] = useState(false)
  const [newRole, setNewRole] = useState('')

  useEffect(() => {
    if (!open) return
    setDraft(initialDraft ?? EMPTY_DRAFT)
  }, [open, initialDraft])

  useEffect(() => {
    if (!open) return
    fetch('/api/roles').then(r => r.json()).then(d => setRoles(d.roles ?? [])).catch(() => {})
  }, [open])

  function update<K extends keyof EmployeeDraft>(key: K, value: EmployeeDraft[K]) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  function toggleDay(key: 'workDays' | 'fixedOffDays', day: string) {
    setDraft(prev => {
      const current = prev[key] ?? []
      const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day]
      return { ...prev, [key]: next.length > 0 ? next : undefined }
    })
  }

  function reset() {
    setDraft(initialDraft ?? EMPTY_DRAFT)
    setError(null)
    setDone(false)
    setAddingRole(false)
    setNewRole('')
  }

  async function handleAddRole() {
    const trimmed = newRole.trim()
    if (!trimmed) return
    const res = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: trimmed }),
    })
    const data = await res.json()
    if (data.roles) setRoles(data.roles)
    update('roleType', trimmed)
    setAddingRole(false)
    setNewRole('')
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
      <Modal open={open} onClose={() => { reset(); onClose() }} title={isEditMode ? 'Profil aktualisiert' : 'Mitarbeiter angelegt'} size="md">
        <div className="text-center py-4">
          <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
          <p className="text-navy font-semibold">
            {isEditMode ? `${draft.name} wurde aktualisiert` : `${draft.name} wurde im System angelegt`}
          </p>
          {!isEditMode && <p className="text-sm text-gray-500 mt-1">Einladung per E-Mail wird versendet</p>}
          <Button className="mt-5 w-full" onClick={() => { reset(); onClose() }}>Schließen</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title={isEditMode ? `${employeeName ?? 'Mitarbeiter'} bearbeiten` : 'Mitarbeiter per Formular anlegen'}
      size="lg"
    >
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
          <div>
            {addingRole ? (
              <div>
                <label className="block text-sm font-semibold text-navy mb-1.5">Neue Rolle</label>
                <div className="flex gap-1.5">
                  <Input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="z.B. Pflegefachkraft" />
                  <Button type="button" size="sm" onClick={handleAddRole}>OK</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setAddingRole(false); setNewRole('') }}>Abbrechen</Button>
                </div>
              </div>
            ) : (
              <Select
                label="Rolle"
                value={draft.roleType ?? ''}
                onChange={e => {
                  if (e.target.value === NEW_ROLE_VALUE) { setAddingRole(true); return }
                  update('roleType', e.target.value || undefined)
                }}
              >
                <option value="">Bitte wählen</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
                <option value={NEW_ROLE_VALUE}>+ Neue Rolle hinzufügen</option>
              </Select>
            )}
          </div>
          <Select label="Beschäftigungsart" value={draft.employmentType ?? ''} onChange={e => update('employmentType', e.target.value || undefined)}>
            <option value="">Bitte wählen</option>
            {EMPLOYMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Arbeitstage / Woche</label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={1} max={7} step={1}
                value={draft.workDaysPerWeek ?? 5}
                onChange={e => update('workDaysPerWeek', Number(e.target.value))}
                className="flex-1 accent-brand"
              />
              <span className="font-bold text-navy w-12 text-center">{draft.workDaysPerWeek ?? 5} Tage</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Konkrete Arbeitstage (optional)</label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay('workDays', day)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                    draft.workDays?.includes(day)
                      ? 'bg-brand text-navy border-brand'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Feste freie Tage (optional)</label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay('fixedOffDays', day)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                    draft.fixedOffDays?.includes(day)
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Input
          label="Tägliche Soll-Stunden (optional)"
          type="number"
          min={1}
          max={12}
          step={0.5}
          value={draft.dailyTargetHours ?? ''}
          onChange={e => update('dailyTargetHours', e.target.value ? Number(e.target.value) : undefined)}
          hint="Nur ausfüllen, falls abweichend von Wochenstunden ÷ Arbeitstage"
        />

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
        <Textarea
          label="Persönliche Besonderheiten"
          value={toFreeText(draft.besonderheiten)}
          onChange={e => update('besonderheiten', fromFreeText(e.target.value))}
          placeholder="z.B. Alleinerziehend, kein Führerschein, Wunsch nach Frühdiensten, gesundheitliche Einschränkungen, Sprachen, ..."
          hint="Freitext – beliebig ausführlich. Die KI berücksichtigt diese Angaben bei der Dienstplanung."
          rows={4}
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
          {isEditMode ? 'Änderungen speichern' : 'Mitarbeiter anlegen'}
        </Button>
      </div>
    </Modal>
  )
}
