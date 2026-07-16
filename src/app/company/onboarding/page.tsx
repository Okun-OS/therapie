'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { OnboardingChat } from '@/components/onboarding/OnboardingChat'
import { ONBOARDING_PHASES } from '@/lib/onboarding-service'
import { useToast } from '@/lib/toast-context'
import type { Location } from '@/lib/types'
import {
  Building2,
  MapPin,
  MessageCircle,
  CheckCircle2,
  Sparkles,
  FileText,
  Upload,
  Plus,
  Trash2,
} from 'lucide-react'
import type { WochentagKuerzel } from '@/lib/company-model-types'

interface OrgState {
  traegerName: string | null
  rollenmodell: string | null
  unternehmensweiteRegeln: string | null
  completed: boolean
}

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

function FormPanel({ onDone }: { onDone: () => void }) {
  const { showToast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [branche, setBranche] = useState('')
  const [betriebsTyp, setBetriebsTyp] = useState<string>('mon_fri')
  const [bundesland, setBundesland] = useState('')
  const [arbeitstage, setArbeitstage] = useState<WochentagKuerzel[]>(['Mo', 'Di', 'Mi', 'Do', 'Fr'])
  const [schichten, setSchichten] = useState<FormSchicht[]>([
    { name: '', von: '06:00', bis: '14:00', minBesetzung: 1 },
  ])
  const [regelnText, setRegelnText] = useState('')

  function toggleTag(tag: WochentagKuerzel) {
    setArbeitstage(prev =>
      prev.includes(tag) ? prev.filter(d => d !== tag) : [...prev, tag],
    )
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
    if (!orgName.trim()) { showToast('Bitte Organisationsname eingeben', 'error'); return }
    if (schichten.length === 0) { showToast('Mindestens eine Schicht erforderlich', 'error'); return }

    setSubmitting(true)
    try {
      const regeln = regelnText
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map(text => ({ text }))

      const res = await fetch('/api/company-model/from-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organisationName: orgName,
          branche,
          betriebsTyp,
          bundesland: bundesland || undefined,
          schichten,
          regeln,
          arbeitstage,
        }),
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
    <Card padding="lg" className="mt-4">
      <p className="font-semibold text-navy mb-4">Schnelle Eingabe — Planungsmodell erstellen</p>
      <div className="space-y-4">
        <Input
          label="Organisationsname"
          value={orgName}
          onChange={e => setOrgName(e.target.value)}
          placeholder="z.B. Pflegeheim Sonnenhof"
        />
        <Input
          label="Branche"
          value={branche}
          onChange={e => setBranche(e.target.value)}
          placeholder="z.B. Pflege, Kita, Handel"
        />
        <Select
          label="Betriebstyp"
          value={betriebsTyp}
          onChange={e => setBetriebsTyp(e.target.value)}
        >
          {Object.entries(BETRIEBSTYP_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
        <Input
          label="Bundesland (optional)"
          value={bundesland}
          onChange={e => setBundesland(e.target.value)}
          placeholder="z.B. Bayern"
        />

        <div>
          <p className="block text-sm font-semibold text-navy mb-1.5">Arbeitstage</p>
          <div className="flex flex-wrap gap-2">
            {ALL_WOCHENTAGE.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1 rounded-lg text-sm font-medium border transition-all ${
                  arbeitstage.includes(tag)
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-brand'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="block text-sm font-semibold text-navy">Schichten</p>
            <Button variant="secondary" size="sm" onClick={addSchicht} className="gap-1">
              <Plus size={14} /> Hinzufügen
            </Button>
          </div>
          <div className="space-y-3">
            {schichten.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
                <Input
                  placeholder="Name (z.B. Frühschicht)"
                  value={s.name}
                  onChange={e => updateSchicht(i, 'name', e.target.value)}
                />
                <Input
                  type="time"
                  value={s.von}
                  onChange={e => updateSchicht(i, 'von', e.target.value)}
                  containerClassName="w-28"
                />
                <Input
                  type="time"
                  value={s.bis}
                  onChange={e => updateSchicht(i, 'bis', e.target.value)}
                  containerClassName="w-28"
                />
                <Input
                  type="number"
                  min={1}
                  value={s.minBesetzung}
                  onChange={e => updateSchicht(i, 'minBesetzung', parseInt(e.target.value) || 1)}
                  containerClassName="w-20"
                  placeholder="Min"
                />
                <button
                  type="button"
                  onClick={() => removeSchicht(i)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="Schicht entfernen"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {schichten.length === 0 && (
              <p className="text-xs text-gray-400">Noch keine Schichten. Klicke &quot;Hinzufügen&quot;.</p>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">Name / Von / Bis / Mindestbesetzung</p>
        </div>

        <Textarea
          label="Planungsregeln (eine pro Zeile)"
          rows={4}
          value={regelnText}
          onChange={e => setRegelnText(e.target.value)}
          placeholder={'z.B. Mitarbeiter im Nachtdienst bekommen am Folgetag frei\nWochenend-Dienste gleichmäßig verteilen'}
        />

        <Button onClick={handleSubmit} disabled={submitting} className="w-full">
          {submitting ? 'Wird gespeichert...' : 'Planungsmodell erstellen'}
        </Button>
      </div>
    </Card>
  )
}

function UploadPanel({ onDone }: { onDone: () => void }) {
  const { showToast } = useToast()
  const [planText, setPlanText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setPlanText(ev.target?.result as string ?? '')
    reader.readAsText(file)
  }

  async function handleSubmit() {
    if (!planText.trim()) { showToast('Kein Dienstplan-Text vorhanden', 'error'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/company-model/from-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planText }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Fehler beim Verarbeiten')
      }
      const data = await res.json() as { erkanntesMuster?: string }
      showToast(
        data.erkanntesMuster
          ? `Planungsmodell erstellt: ${data.erkanntesMuster}`
          : 'Planungsmodell aus Dienstplan extrahiert',
        'success',
      )
      onDone()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card padding="lg" className="mt-4">
      <p className="font-semibold text-navy mb-2">Aus Beispielplänen lernen</p>
      <p className="text-sm text-gray-500 mb-4">
        Lade einen oder mehrere Beispieldienstpläne hoch (als Textdatei) oder füge den Dienstplan-Text direkt ein.
        Die KI erkennt automatisch Schichten, Regeln und Arbeitsmuster.
      </p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5">Datei hochladen (.txt, .csv)</label>
          <input
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            onChange={handleFile}
            className="block text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand/10 file:text-brand hover:file:bg-brand/20 transition-all"
          />
        </div>
        <Textarea
          label="Dienstplan-Text (oder hier einfügen)"
          rows={8}
          value={planText}
          onChange={e => setPlanText(e.target.value)}
          placeholder={'Mo  08.07.  Fr  09.07.  Sa  10.07.\nMeier       F       F       -\nSchmidt     S       -       F\nMüller      -       S       S\n\nF = Frühschicht 06:00-14:00\nS = Spätschicht 14:00-22:00'}
        />
        <Button onClick={handleSubmit} disabled={submitting || !planText.trim()} className="w-full">
          {submitting ? 'KI analysiert Dienstplan...' : 'Planungsmodell extrahieren'}
        </Button>
      </div>
    </Card>
  )
}

type OnboardingMethod = 'chat' | 'form' | 'upload' | null

export default function CompanyOnboarding() {
  const [org, setOrg] = useState<OrgState | null>(null)
  const [locs, setLocs] = useState<Record<string, LocState>>({})
  const [loading, setLoading] = useState(true)
  const [chatScope, setChatScope] = useState<string | null>(null)
  const [LOCATIONS, setLOCATIONS] = useState<Location[]>([])
  const [selectedMethod, setSelectedMethod] = useState<OnboardingMethod>(null)

  function reload() {
    fetch('/api/onboarding')
      .then(r => r.json())
      .then(json => {
        setOrg(json.organization)
        const byLocation: Record<string, LocState> = {}
        for (const l of json.locations as LocState[]) byLocation[l.locationId] = l
        setLocs(byLocation)
      })
  }

  useEffect(() => {
    fetch('/api/locations').then(r => r.json()).then(d => setLOCATIONS(d.locations))
  }, [])

  useEffect(() => {
    fetch('/api/onboarding')
      .then(r => r.json())
      .then(json => {
        setOrg(json.organization)
        const byLocation: Record<string, LocState> = {}
        for (const l of json.locations as LocState[]) byLocation[l.locationId] = l
        setLocs(byLocation)
      })
      .finally(() => setLoading(false))
  }, [])

  const activeLocation = chatScope && chatScope !== 'organization' ? LOCATIONS.find(l => l.id === chatScope) : undefined
  const hasCompletedOnboarding = org?.completed

  return (
    <>
      <div className="p-4 sm:p-6 space-y-5">

        {/* Method selector — shown when no onboarding completed yet */}
        {!loading && !hasCompletedOnboarding && (
          <div>
            <p className="text-sm font-semibold text-navy mb-3 px-1">Wie möchten Sie das Planungsmodell einrichten?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setSelectedMethod(selectedMethod === 'chat' ? null : 'chat')}
                className={`text-left p-4 rounded-2xl border-2 transition-all ${
                  selectedMethod === 'chat'
                    ? 'border-brand bg-brand/5'
                    : 'border-gray-200 hover:border-brand/50 bg-white'
                }`}
              >
                <MessageCircle size={22} className="text-brand mb-2" />
                <p className="font-semibold text-navy text-sm">KI-Chat</p>
                <p className="text-xs text-gray-500 mt-0.5">Geführtes Gespräch</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod(selectedMethod === 'form' ? null : 'form')}
                className={`text-left p-4 rounded-2xl border-2 transition-all ${
                  selectedMethod === 'form'
                    ? 'border-brand bg-brand/5'
                    : 'border-gray-200 hover:border-brand/50 bg-white'
                }`}
              >
                <FileText size={22} className="text-brand mb-2" />
                <p className="font-semibold text-navy text-sm">Formular</p>
                <p className="text-xs text-gray-500 mt-0.5">Schnelle Eingabe</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod(selectedMethod === 'upload' ? null : 'upload')}
                className={`text-left p-4 rounded-2xl border-2 transition-all ${
                  selectedMethod === 'upload'
                    ? 'border-brand bg-brand/5'
                    : 'border-gray-200 hover:border-brand/50 bg-white'
                }`}
              >
                <Upload size={22} className="text-brand mb-2" />
                <p className="font-semibold text-navy text-sm">Plan hochladen</p>
                <p className="text-xs text-gray-500 mt-0.5">Aus Beispielplänen lernen</p>
              </button>
            </div>

            {selectedMethod === 'form' && (
              <FormPanel onDone={() => { setSelectedMethod(null); reload() }} />
            )}
            {selectedMethod === 'upload' && (
              <UploadPanel onDone={() => { setSelectedMethod(null); reload() }} />
            )}
            {selectedMethod === 'chat' && (
              <div className="mt-4">
                <p className="text-sm text-gray-500 px-1 mb-3">Wählen Sie unten einen Bereich aus, um den KI-Chat zu starten.</p>
              </div>
            )}
          </div>
        )}

        {/* Unternehmen (Ebene 1) */}
        <Card padding="lg">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-navy flex items-center justify-center flex-shrink-0">
                <Building2 size={20} className="text-brand" />
              </div>
              <div>
                <p className="font-bold text-navy">Unternehmens-Onboarding</p>
                <p className="text-xs text-gray-500">Gilt für alle Standorte gemeinsam</p>
              </div>
            </div>
            {org?.completed ? (
              <Badge variant="success" className="gap-1"><CheckCircle2 size={12} className="inline" /> Abgeschlossen</Badge>
            ) : (
              <Badge variant="warning">{org ? 'Läuft' : 'Noch nicht gestartet'}</Badge>
            )}
          </div>

          {org && (org.traegerName || org.rollenmodell || org.unternehmensweiteRegeln) && (
            <div className="space-y-1.5 mb-4 text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
              {org.traegerName && <p><span className="font-semibold text-navy">Unternehmen:</span> {org.traegerName}</p>}
              {org.rollenmodell && <p><span className="font-semibold text-navy">Rollenmodell:</span> {org.rollenmodell}</p>}
              {org.unternehmensweiteRegeln && <p><span className="font-semibold text-navy">Unternehmensweite Regeln:</span> {org.unternehmensweiteRegeln}</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setChatScope('organization')} className="gap-2">
              <MessageCircle size={16} />
              {org?.completed ? 'Angaben ändern (KI-Chat)' : org ? 'Im Gespräch fortsetzen' : 'Unternehmens-Onboarding per KI-Chat starten'}
            </Button>
            {org?.completed && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedMethod(selectedMethod === 'form' ? null : 'form')}
                  className="gap-1"
                >
                  <FileText size={14} /> Formular
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedMethod(selectedMethod === 'upload' ? null : 'upload')}
                  className="gap-1"
                >
                  <Upload size={14} /> Aus Plan lernen
                </Button>
              </>
            )}
          </div>
          {org?.completed && (
            <p className="text-xs text-gray-500 mt-2">Hat sich etwas geändert? Sag es einfach im Chat – die KI aktualisiert nur die betroffenen Angaben.</p>
          )}
          {org?.completed && selectedMethod === 'form' && (
            <FormPanel onDone={() => { setSelectedMethod(null); reload() }} />
          )}
          {org?.completed && selectedMethod === 'upload' && (
            <UploadPanel onDone={() => { setSelectedMethod(null); reload() }} />
          )}
        </Card>

        {/* Standorte (Ebene 2) */}
        <div>
          <p className="text-sm font-semibold text-navy mb-2 px-1">Standorte</p>
          <div className="space-y-3">
            {LOCATIONS.map(loc => {
              const state = locs[loc.id]
              const phasesDone = state?.completedPhases.length ?? 0
              return (
                <Card key={loc.id} padding="lg">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-navy/5 flex items-center justify-center flex-shrink-0">
                        <MapPin size={18} className="text-navy" />
                      </div>
                      <div>
                        <p className="font-bold text-navy">{loc.name}</p>
                        <p className="text-xs text-gray-500">{loc.city}</p>
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
                      {state.wiederkehrendeAufgaben && <p><span className="font-semibold text-navy">Wiederkehrende Aufgaben:</span> {state.wiederkehrendeAufgaben}</p>}
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
                      {state.besonderheiten && <p><span className="font-semibold text-navy">Sonstige Besonderheiten:</span> {state.besonderheiten}</p>}
                    </div>
                  )}

                  {!loading && !state && (
                    <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 mb-3">
                      <Sparkles size={14} className="flex-shrink-0 mt-0.5 text-brand" />
                      <span>Dieser Standort wurde noch nicht per KI-Onboarding konfiguriert. Solange das fehlt, plant die KI ausschließlich anhand der allgemeinen Regeln.</span>
                    </div>
                  )}

                  <Button onClick={() => setChatScope(loc.id)} variant={state ? 'secondary' : 'primary'} className="gap-2">
                    <MessageCircle size={16} />
                    {state?.completed ? 'Angaben ändern (KI-Chat)' : state ? 'Im Gespräch weiter erzählen' : 'Mit KI einrichten'}
                  </Button>
                  {state?.completed && (
                    <p className="text-xs text-gray-500 mt-2">Hat sich etwas geändert (neue Dienstzeiten, Schichten, Regeln)? Sag es einfach im Chat – die KI passt nur die betroffenen Punkte an.</p>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      </div>

      {chatScope && (
        <OnboardingChat
          open
          onClose={() => setChatScope(null)}
          scope={chatScope}
          locationName={activeLocation?.name}
          locationId={chatScope !== 'organization' ? chatScope : undefined}
          onStateUpdate={state => {
            if (chatScope === 'organization') {
              setOrg(state as OrgState)
            } else {
              setLocs(prev => ({ ...prev, [chatScope]: state as LocState }))
            }
          }}
        />
      )}
    </>
  )
}
