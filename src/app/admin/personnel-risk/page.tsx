'use client'

import { Header } from '@/components/layout/Header'
import { useAuth } from '@/lib/auth-context'
import { PersonnelRiskDashboard } from '@/components/personnel-risk/PersonnelRiskDashboard'
import { AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export default function AdminPersonnelRisk() {
  const { user } = useAuth()
  const locationId = user?.locationId

  if (!locationId) {
    return (
      <>
        <Header title="Personalrisiko-Analyse" subtitle="Kein Standort zugeordnet" />
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={AlertTriangle}
            title="Dein Account ist noch keinem Standort zugeordnet"
            description="Ein OKUN-Administrator muss deinen Account einmalig einem Standort zuordnen, bevor hier die Personalrisiko-Analyse angezeigt werden kann. Bitte wende dich an die OKUN-Plattformverwaltung."
          />
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Personalrisiko-Analyse" subtitle="Burnout-, Fluktuations- und Unterbesetzungsrisiko für deinen Standort" />
      <div className="p-4 sm:p-6">
        <PersonnelRiskDashboard fetchUrl={`/api/personnel-risk?locationId=${locationId}`} />
      </div>
    </>
  )
}
