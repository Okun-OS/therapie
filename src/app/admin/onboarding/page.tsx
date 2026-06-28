'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { OnboardingChat } from '@/components/onboarding/OnboardingChat'
import { ONBOARDING_PHASES } from '@/lib/onboarding-service'
import { useAuth } from '@/lib/auth-context'
import type { Location } from '@/lib/types'
import { MapPin, MessageCircle, CheckCircle2, Sparkles } from 'lucide-react'

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

          <Button onClick={() => setChatOpen(true)} variant={state ? 'secondary' : 'primary'} className="gap-2">
            <MessageCircle size={16} />
            {state?.completed ? 'Angaben ändern (KI-Chat)' : state ? 'Im Gespräch weiter erzählen' : 'Mit KI einrichten'}
          </Button>
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
    </>
  )
}
