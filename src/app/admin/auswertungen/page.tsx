'use client'

// §106 Auswertungen — eine Seite statt fünf Reitern.
//
// Workforce Score, Insights, Fairness, Personalrisiko und Controlling waren
// fünf eigene Menüpunkte auf denselben Daten desselben Standorts. Wer etwas
// suchte, musste raten, in welchem der fünf es steckt. Jetzt: eine Seite,
// oben umschalten.

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { EmptyState } from '@/components/ui/EmptyState'
import { AlertTriangle, TrendingUp, Scale, ShieldAlert, BarChart3, Zap } from 'lucide-react'
import { WorkforceInsightsDashboard } from '@/components/workforce-insights/WorkforceInsightsDashboard'
import { FairnessEngineDashboard } from '@/components/fairness/FairnessEngineDashboard'
import { PersonnelRiskDashboard } from '@/components/personnel-risk/PersonnelRiskDashboard'
import { ControllingDashboard } from '@/components/controlling/ControllingDashboard'

const REITER = [
  { id: 'insights',    label: 'Team-Analyse',    icon: TrendingUp,  beschreibung: 'Auslastung, Entwicklung, Auffälligkeiten' },
  { id: 'fairness',    label: 'Verteilung',      icon: Scale,       beschreibung: 'Wie gleichmäßig Dienste verteilt sind' },
  { id: 'risiko',      label: 'Personalrisiko',  icon: ShieldAlert, beschreibung: 'Frühwarnung bei Überlastung und Abwanderung' },
  { id: 'controlling', label: 'Kennzahlen',      icon: BarChart3,   beschreibung: 'Zahlen und Trends über die Zeit' },
] as const

type ReiterId = typeof REITER[number]['id']

export default function AdminAuswertungen() {
  const { user } = useAuth()
  const locationId = user?.locationId
  const [aktiv, setAktiv] = useState<ReiterId>('insights')

  if (!locationId) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          icon={AlertTriangle}
          title="Dein Zugang ist noch keinem Standort zugeordnet"
          description="Auswertungen beziehen sich immer auf einen Standort. Bitte wende dich an die Unternehmensleitung."
        />
      </div>
    )
  }

  const aktuell = REITER.find(r => r.id === aktiv)!

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">Auswertungen</h1>
        <p className="text-sm text-gray-500">{aktuell.beschreibung}</p>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-gray-100 pb-3">
        {REITER.map(r => {
          const Icon = r.icon
          const an = r.id === aktiv
          return (
            <button
              key={r.id}
              onClick={() => setAktiv(r.id)}
              className={`flex items-center gap-1.5 text-sm rounded-xl px-3 py-1.5 border transition-all ${
                an ? 'border-navy bg-navy text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <Icon size={14} />{r.label}
            </button>
          )
        })}
      </div>

      {aktiv === 'insights'    && <WorkforceInsightsDashboard fetchUrl={`/api/workforce-insights?locationId=${locationId}`} />}
      {aktiv === 'fairness'    && <FairnessEngineDashboard   fetchUrl={`/api/fairness-engine?locationId=${locationId}`} />}
      {aktiv === 'risiko'      && <PersonnelRiskDashboard    fetchUrl={`/api/personnel-risk?locationId=${locationId}`} />}
      {aktiv === 'controlling' && <ControllingDashboard      fetchUrl={`/api/controlling?locationId=${locationId}`} />}
    </div>
  )
}
