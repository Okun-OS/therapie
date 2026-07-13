'use client'

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
      
      <div className="p-4 sm:p-6">
        <PersonnelRiskDashboard fetchUrl={`/api/personnel-risk?locationId=${locationId}`} />
      </div>
    </>
  )
}
