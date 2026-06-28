'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { OnboardingChat } from '@/components/onboarding/OnboardingChat'
import { ONBOARDING_PHASES } from '@/lib/onboarding-service'
import type { Location } from '@/lib/types'
import { Building2, MapPin, MessageCircle, CheckCircle2, Sparkles } from 'lucide-react'

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

export default function CompanyOnboarding() {
  const [org, setOrg] = useState<OrgState | null>(null)
  const [locs, setLocs] = useState<Record<string, LocState>>({})
  const [loading, setLoading] = useState(true)
  const [chatScope, setChatScope] = useState<string | null>(null)
  const [LOCATIONS, setLOCATIONS] = useState<Location[]>([])

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

  return (
    <>
      <Header title="KI-Onboarding" subtitle="Standort verstehen lernen – per Gespräch, nicht per Formular" />
      <div className="p-4 sm:p-6 space-y-5">

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

          <Button onClick={() => setChatScope('organization')} className="gap-2">
            <MessageCircle size={16} />
            {org?.completed ? 'Angaben ändern (KI-Chat)' : org ? 'Im Gespräch fortsetzen' : 'Unternehmens-Onboarding per KI-Chat starten'}
          </Button>
          {org?.completed && (
            <p className="text-xs text-gray-500 mt-2">Hat sich etwas geändert? Sag es einfach im Chat – die KI aktualisiert nur die betroffenen Angaben.</p>
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
