'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { OnboardingChat } from '@/components/onboarding/OnboardingChat'
import { ONBOARDING_PHASES } from '@/lib/onboarding-service'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import type { Location } from '@/lib/types'
import type { WochentagKuerzel } from '@/lib/company-model-types'
import {
  MapPin, MessageCircle, CheckCircle2, Sparkles, RotateCcw, AlertTriangle,
  FileText, Upload, Plus, Trash2, Loader2, ChevronRight,
} from 'lucide-react'
import Link from 'next/link'

interface LocState {
  locationId: string
  einrichtungsart: string | null
  organisationsstruktur: string | null
  personalstruktur: string | null
  arbeitszeiten: string | null
  dienstplanlogik: string | null
  pausenlogik: string | null
  wiederkehrendeAufgaben: string | null
  individuelleRegeln: string[]
  vertretungsregeln: string | null
  urlaubslogik: string | null
  zeiterfassung: string | null
  besonderheiten: string | null
  tagesablauf: string | null
  completedPhases: string[]
  completed: boolean
}

interface FormSchicht {
  name: string
  von: string
  bis: string
  minBesetzung: number
}

const ALL_WOCHENTAGE: WochentagKuerzel[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const BETRIEBSTYP_LABELS: Record<string, string> = {
  mon_fri: 'Montag–Freitag',
  mon_sat: 'Montag–Samstag',
  '7_tage': '7 Tage / Woche',
  '24_7': '24/7 Betrieb',
  schichtbetrieb: 'Schichtbetrieb',
  bedarfsgesteuert: 'Bedarfsgesteuert',
  bereitschaft: 'Bereitschaft',
}

type Method = 'chat' | 'form' | 'upload'

// ── Formular-Panel ──────────────────────────────────────────────────────────
function FormPanel({ onDone }: { onDone: () => void }) {
  const { showToast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [betriebsTyp, setBetriebsTyp] = useState<string>('mon_fri')
  const [bundesland, setBundesland] = useState('')
  const [arbeitstage, setArbeitstage] = useState<WochentagKuerzel[]>(['Mo', 'Di', 'Mi', 'Do', 'Fr'])
  const [schichten, setSchichten] = useState<FormSchicht[]>([
    { name: '', von: '06:00', bis: '14:00', minBesetzung: 1 },
  ])
  const [regelnText, setRegelnText] = useState('')

  function toggleTag(tag: WochentagKuerzel) {
    setArbeitstage(prev => prev.includes(tag) ? prev.filter(d => d !== tag) : [...prev, tag])
  }

  function addSchicht() {
    setSchichten(prev => [...prev, { name: '', von: '06:00', bis: '14:00', minBesetzung: 1 }])
  }

  function removeSchicht(i: number) {
    setSchichten(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateSchicht(i: number, field: keyof FormSchicht, value: string | number) {
    setSchichten(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  async function handleSubmit() {
    const filled = schichten.filter(s => s.name.trim())
    if (filled.length === 0) { showToast('Mindestens eine Schicht mit Namen erforderlich', 'error'); return }

    setSubmitting(true)
    try {
      const regeln = regelnText.split('\n').map(l => l.trim()).filter(Boolean)
      const res = await fetch('/api/location-model/from-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betriebsTyp, bundesland: bundesland || undefined, schichten: filled, regeln, arbeitstage }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Fehler beim Speichern')
      }
      showToast('Planungsmodell erfolgreich erstellt', 'success')
      onDone()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card padding="lg" className="mt-4 space-y-4">
      <p className="font-semibold text-navy">Schnelle Konfiguration — Formular</p>

      <Select
        label="Betriebstyp"
        value={betriebsTyp}
        onChange={e => setBetriebsTyp(e.target.value)}
      >
        {Object.entries(BETRIEBSTYP_LABELS).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </Select>

      <Input
        label="Bundesland (optional)"
        value={bundesland}
        onChange={e => setBundesland(e.target.value)}
        placeholder="z.B. Bayern"
      />

      <div>
        <p className="text-sm font-medium text-gray-700 mb-1.5">Arbeitstage</p>
        <div className="flex flex-wrap gap-2">
          {ALL_WOCHENTAGE.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                arbeitstage.includes(tag)
                  ? 'bg-brand text-white border-brand'
                  : 'border-gray-200 text-gray-600 hover:border-brand'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">Schichten</p>
          <Button size="sm" variant="ghost" onClick={addSchicht} className="gap-1 text-xs">
            <Plus size={13} /> Hinzufügen
          </Button>
        </div>
        <div className="space-y-2">
          {schichten.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
              <Input
                placeholder="Name (z.B. Frühschicht)"
                value={s.name}
                onChange={e => updateSchicht(i, 'name', e.target.value)}
              />
              <div>
                <p className="text-xs text-gray-500 mb-1">Von</p>
                <input
                  type="time"
                  value={s.von}
                  onChange={e => updateSchicht(i, 'von', e.target.value)}
                  className="border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Bis</p>
                <input
                  type="time"
                  value={s.bis}
                  onChange={e => updateSchicht(i, 'bis', e.target.value)}
                  className="border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Min.</p>
                <input
                  type="number"
                  min={1}
                  value={s.minBesetzung}
                  onChange={e => updateSchicht(i, 'minBesetzung', Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 border border-gray-200 rounded-xl px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
              <button
                type="button"
                onClick={() => removeSchicht(i)}
                disabled={schichten.length === 1}
                className="p-2 text-gray-300 hover:text-red-500 disabled:opacity-30 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Textarea
        label="Planungsregeln (eine pro Zeile, optional)"
        value={regelnText}
        onChange={e => setRegelnText(e.target.value)}
        placeholder={'z.B.\nMax. 2 Nachtschichten pro Woche\nKeine Spätschicht direkt nach Nachtschicht'}
        rows={4}
      />

      <div className="flex justify-end">
        <Button onClick={handleSubmit} loading={submitting} className="gap-1.5">
          Planungsmodell erstellen
          <ChevronRight size={16} />
        </Button>
      </div>
    </Card>
  )
}

// ── Upload-Panel ────────────────────────────────────────────────────────────
function UploadPanel({ onDone }: { onDone: () => void }) {
  const { showToast } = useToast()
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [erkanntesMuster, setErkanntesMuster] = useState<string | null>(null)

  async function handleAnalyze() {
    if (!text.trim()) { showToast('Bitte erst einen Dienstplan einfügen', 'error'); return }
    setSubmitting(true)
    setErkanntesMuster(null)
    try {
      const res = await fetch('/api/location-model/from-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planText: text }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Analyse fehlgeschlagen')
      }
      const data = await res.json()
      setErkanntesMuster(data.erkanntesMuster ?? null)
      showToast('Planungsmodell aus Dienstplan erstellt', 'success')
      onDone()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setText(ev.target?.result as string ?? '')
    reader.readAsText(file)
  }

  return (
    <Card padding="lg" className="mt-4 space-y-4">
      <p className="font-semibold text-navy">Aus bestehendem Plan lernen</p>
      <p className="text-sm text-gray-500">
        Füge einen vorhandenen Dienstplan ein (Textform, CSV oder ähnliches) — die KI erkennt automatisch Schichten, Muster und Regeln.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Datei hochladen (.txt / .csv)</label>
        <input
          type="file"
          accept=".txt,.csv"
          onChange={handleFile}
          className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand/10 file:text-brand hover:file:bg-brand/20 transition-colors"
        />
      </div>

      <Textarea
        label="Oder direkt einfügen"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Mo 06:00–14:00 Frühdienst (3 MA)&#10;Mo 14:00–22:00 Spätdienst (2 MA)&#10;Di ..."
        rows={8}
      />

      {erkanntesMuster && (
        <div className="flex items-start gap-2 text-sm text-brand bg-brand/5 border border-brand/20 rounded-xl px-3 py-2.5">
          <Sparkles size={15} className="flex-shrink-0 mt-0.5" />
          <span><strong>Erkanntes Muster:</strong> {erkanntesMuster}</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleAnalyze} loading={submitting} disabled={!text.trim()} className="gap-1.5">
          {submitting ? 'KI analysiert...' : 'Plan analysieren & Modell erstellen'}
          <ChevronRight size={16} />
        </Button>
      </div>
    </Card>
  )
}

// ── Hauptseite ──────────────────────────────────────────────────────────────
export default function AdminOnboarding() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const locationId = user?.locationId
  const [location, setLocation] = useState<Location | null>(null)
  const [state, setState] = useState<LocState | null>(null)
  const [loading, setLoading] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [activeMethod, setActiveMethod] = useState<Method | null>(null)
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  useEffect(() => {
    if (!locationId) return
    fetch('/api/locations')
      .then(r => r.json())
      .then(d => setLocation((d.locations as Location[]).find(l => l.id === locationId) ?? null))
  }, [locationId])

  useEffect(() => {
    fetch('/api/onboarding')
      .then(r => r.json())
      .then(json => setState((json.locations?.[0] as LocState) ?? null))
      .finally(() => setLoading(false))
  }, [])

  async function handleReset() {
    setResetting(true)
    setResetError(null)
    try {
      const res = await fetch('/api/admin/location-onboarding/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, confirm: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Zurücksetzen fehlgeschlagen')
      setState(null)
      setResetStep(0)
      setChatOpen(true)
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Zurücksetzen fehlgeschlagen')
    } finally {
      setResetting(false)
    }
  }

  void showToast

  if (!locationId) {
    return (
      <div className="p-4 sm:p-6">
        <Card padding="lg">
          <p className="text-sm text-gray-500">Deinem Konto ist aktuell kein Standort zugeordnet. Bitte wende dich an deine Geschäftsführung.</p>
        </Card>
      </div>
    )
  }

  const phasesDone = state?.completedPhases.length ?? 0

  return (
    <>
      <div className="p-4 sm:p-6 space-y-4">

        {/* Status-Card */}
        <Card padding="lg">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-navy/5 flex items-center justify-center flex-shrink-0">
                <MapPin size={18} className="text-navy" />
              </div>
              <div>
                <p className="font-bold text-navy">{location?.name ?? 'Dein Standort'}</p>
                {location?.city && <p className="text-xs text-gray-500">{location.city}</p>}
              </div>
            </div>
            {state?.completed ? (
              <Badge variant="success" className="gap-1"><CheckCircle2 size={12} className="inline" /> Vollständig eingerichtet</Badge>
            ) : (
              <Badge variant={phasesDone > 0 ? 'warning' : 'default'}>
                {phasesDone > 0 ? `${phasesDone}/${ONBOARDING_PHASES.length} Phasen` : 'Noch nicht gestartet'}
              </Badge>
            )}
          </div>

          {state && (
            <div className="space-y-1.5 mb-4 text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
              {state.einrichtungsart && <p><span className="font-semibold text-navy">Art:</span> {state.einrichtungsart}</p>}
              {state.organisationsstruktur && <p><span className="font-semibold text-navy">Struktur:</span> {state.organisationsstruktur}</p>}
              {state.personalstruktur && <p><span className="font-semibold text-navy">Personal:</span> {state.personalstruktur}</p>}
              {state.arbeitszeiten && <p><span className="font-semibold text-navy">Arbeitszeiten:</span> {state.arbeitszeiten}</p>}
              {state.dienstplanlogik && <p><span className="font-semibold text-navy">Dienstplanlogik:</span> {state.dienstplanlogik}</p>}
              {state.pausenlogik && <p><span className="font-semibold text-navy">Pausenlogik:</span> {state.pausenlogik}</p>}
              {state.wiederkehrendeAufgaben && <p><span className="font-semibold text-navy">Aufgaben:</span> {state.wiederkehrendeAufgaben}</p>}
              {state.individuelleRegeln.length > 0 && (
                <div>
                  <span className="font-semibold text-navy">Individuelle Regeln:</span>
                  <ul className="list-disc list-inside ml-1">
                    {state.individuelleRegeln.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {state.vertretungsregeln && <p><span className="font-semibold text-navy">Vertretungsregeln:</span> {state.vertretungsregeln}</p>}
              {state.urlaubslogik && <p><span className="font-semibold text-navy">Urlaubslogik:</span> {state.urlaubslogik}</p>}
              {state.zeiterfassung && <p><span className="font-semibold text-navy">Zeiterfassung:</span> {state.zeiterfassung}</p>}
              {state.besonderheiten && <p><span className="font-semibold text-navy">Besonderheiten:</span> {state.besonderheiten}</p>}
              {state.tagesablauf && <p><span className="font-semibold text-navy">Tagesablauf:</span> {state.tagesablauf}</p>}
            </div>
          )}

          {!loading && !state && (
            <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 mb-3">
              <Sparkles size={14} className="flex-shrink-0 mt-0.5 text-brand" />
              <span>Dein Standort ist noch nicht konfiguriert. Wähle eine Methode, um das Planungsmodell zu erstellen.</span>
            </div>
          )}

          {state && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Button onClick={() => { setActiveMethod('chat'); setChatOpen(true) }} variant={state.completed ? 'primary' : 'secondary'} className="gap-2">
                <MessageCircle size={16} />
                {state.completed ? 'Einstellungen per KI bearbeiten' : 'Im Gespräch weiter erzählen'}
              </Button>
              <Button onClick={() => { setResetError(null); setResetStep(1) }} variant="ghost" className="gap-2 text-red-600 hover:bg-red-50">
                <RotateCcw size={16} />
                Zurücksetzen
              </Button>
            </div>
          )}
          {state?.completed && (
            <p className="text-xs text-gray-500 mt-2">Schichten, Regeln oder Arbeitszeiten ge&auml;ndert? Einfach im Chat beschreiben &ndash; die KI passt nur die betroffenen Punkte an.</p>
          )}
        </Card>

        {/* Planungsmodell-Link — nur wenn Modell vorhanden */}
        {state && (
          <Link href="/admin/model" className="block">
            <Card padding="md" className="flex items-center gap-3 hover:border-brand/30 transition-colors cursor-pointer group">
              <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">📋</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-navy text-sm">Planungsmodell ansehen &amp; bearbeiten</p>
                <p className="text-xs text-gray-500">Schichten, harte &amp; weiche Regeln direkt editieren</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-brand transition-colors" />
            </Card>
          </Link>
        )}

        {/* Methoden-Auswahl — immer sichtbar (als Ersteinstieg oder Alternative) */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {state ? 'Alternative Einrichtungsmethoden' : 'Einrichtungsmethode wählen'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MethodTile
              icon={<MessageCircle size={22} className="text-brand" />}
              title="KI-Chat"
              subtitle="Geführtes Gespräch durch alle 13 Phasen"
              badge="Empfohlen"
              active={activeMethod === 'chat'}
              onClick={() => { setActiveMethod('chat'); setChatOpen(true) }}
            />
            <MethodTile
              icon={<FileText size={22} className="text-navy" />}
              title="Formular"
              subtitle="Schichten & Regeln direkt eingeben"
              active={activeMethod === 'form'}
              onClick={() => setActiveMethod(prev => prev === 'form' ? null : 'form')}
            />
            <MethodTile
              icon={<Upload size={22} className="text-navy" />}
              title="Plan hochladen"
              subtitle="KI erkennt Muster aus bestehendem Plan"
              active={activeMethod === 'upload'}
              onClick={() => setActiveMethod(prev => prev === 'upload' ? null : 'upload')}
            />
          </div>
        </div>

        {/* Expansions */}
        {activeMethod === 'form' && (
          <FormPanel onDone={() => {
            setActiveMethod(null)
            fetch('/api/onboarding')
              .then(r => r.json())
              .then(json => setState((json.locations?.[0] as LocState) ?? null))
          }} />
        )}
        {activeMethod === 'upload' && (
          <UploadPanel onDone={() => {
            setActiveMethod(null)
            fetch('/api/onboarding')
              .then(r => r.json())
              .then(json => setState((json.locations?.[0] as LocState) ?? null))
          }} />
        )}

      </div>

      {/* Chat */}
      {chatOpen && (
        <OnboardingChat
          open
          onClose={() => setChatOpen(false)}
          scope={locationId ?? ''}
          locationName={location?.name}
          locationId={locationId}
          onStateUpdate={s => setState(s as LocState)}
        />
      )}

      {/* Reset Modals */}
      <Modal open={resetStep === 1} onClose={() => setResetStep(0)} title="Onboarding wirklich zurücksetzen?" size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              Alle Onboarding-Antworten, Dienste/Schichten, Planungsregeln und Planungshinweise für{' '}
              <strong>{location?.name ?? 'diesen Standort'}</strong> werden unwiderruflich gelöscht.
              Mitarbeiter, Nutzerkonten und der Dienstplanverlauf bleiben erhalten.
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResetStep(0)}>Abbrechen</Button>
            <Button variant="danger" onClick={() => setResetStep(2)}>Weiter</Button>
          </div>
        </div>
      </Modal>

      <Modal open={resetStep === 2} onClose={() => setResetStep(0)} title="Letzte Bestätigung" size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>Dieser Vorgang kann nicht rückgängig gemacht werden. Bist du sicher?</span>
          </div>
          {resetError && <p className="text-sm text-red-600">{resetError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResetStep(0)} disabled={resetting}>Abbrechen</Button>
            <Button variant="danger" loading={resetting} onClick={handleReset}>Jetzt endgültig zurücksetzen</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

function MethodTile({
  icon, title, subtitle, badge, active, onClick,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  badge?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 rounded-2xl border transition-all ${
        active
          ? 'border-brand bg-brand/5 ring-1 ring-brand/30'
          : 'border-gray-200 hover:border-brand/50 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        {icon}
        {badge && (
          <span className="text-[10px] font-semibold bg-brand text-white px-1.5 py-0.5 rounded-md">{badge}</span>
        )}
      </div>
      <p className="font-semibold text-navy text-sm">{title}</p>
      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{subtitle}</p>
    </button>
  )
}
