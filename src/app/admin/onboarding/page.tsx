'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { OnboardingChat } from '@/components/onboarding/OnboardingChat'
import { ONBOARDING_PHASES } from '@/lib/onboarding-service'
import { useAuth } from '@/lib/auth-context'
import type { Location } from '@/lib/types'
import { MapPin, MessageCircle, CheckCircle2, Sparkles, RotateCcw, AlertTriangle } from 'lucide-react'

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

export default function AdminOnboarding() {
  const { user } = useAuth()
  const locationId = user?.locationId
  const [location, setLocation] = useState<Location | null>(null)
  const [state, setState] = useState<LocState | null>(null)
  const [loading, setLoading] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
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

  if (!locationId) {
    return (
      <>
        <Header title="KI-Onboarding" subtitle="Standort verstehen lernen – per Gespräch, nicht per Formular" />
        <div className="p-4 sm:p-6">
          <Card padding="lg">
            <p className="text-sm text-gray-500">Deinem Konto ist aktuell kein Standort zugeordnet. Bitte wende dich an deine Geschäftsführung.</p>
          </Card>
        </div>
      </>
    )
  }

  const phasesDone = state?.completedPhases.length ?? 0

  return (
    <>
      <Header title="KI-Onboarding" subtitle="Standort verstehen lernen – per Gespräch, nicht per Formular" />
      <div className="p-4 sm:p-6">
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
              <span>Dein Standort wurde noch nicht per KI-Onboarding konfiguriert. Solange das fehlt, plant die KI ausschließlich anhand der allgemeinen Unternehmensregeln.</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setChatOpen(true)} variant={state ? 'secondary' : 'primary'} className="gap-2">
              <MessageCircle size={16} />
              {state?.completed ? 'Angaben ändern (KI-Chat)' : state ? 'Im Gespräch weiter erzählen' : 'Mit KI einrichten'}
            </Button>
            {state && (
              <Button onClick={() => { setResetError(null); setResetStep(1) }} variant="ghost" className="gap-2 text-red-600 hover:bg-red-50">
                <RotateCcw size={16} />
                Onboarding zurücksetzen
              </Button>
            )}
          </div>
          {state?.completed && (
            <p className="text-xs text-gray-500 mt-2">Hat sich etwas geändert (neue Dienstzeiten, Schichten, Regeln)? Sag es einfach im Chat – die KI passt nur die betroffenen Punkte an.</p>
          )}
        </Card>
      </div>

      {chatOpen && (
        <OnboardingChat
          open
          onClose={() => setChatOpen(false)}
          scope={locationId}
          locationName={location?.name}
          onStateUpdate={s => setState(s as LocState)}
        />
      )}

      <Modal open={resetStep === 1} onClose={() => setResetStep(0)} title="Onboarding wirklich zurücksetzen?" size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              Alle Onboarding-Antworten, Dienste/Schichten, Planungsregeln und temporären Planungshinweise für{' '}
              <strong>{location?.name ?? 'diesen Standort'}</strong> werden unwiderruflich gelöscht. Mitarbeiter, Nutzerkonten
              und der bisherige Dienstplanverlauf bleiben erhalten. Anschließend wird das Onboarding neu gestartet.
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
            <span>Dieser Vorgang kann nicht rückgängig gemacht werden. Bist du sicher, dass du das Onboarding jetzt zurücksetzen willst?</span>
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
