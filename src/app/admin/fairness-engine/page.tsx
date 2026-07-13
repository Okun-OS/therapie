'use client'

import { useAuth } from '@/lib/auth-context'
import { FairnessEngineDashboard } from '@/components/fairness/FairnessEngineDashboard'
import { AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export default function AdminFairnessEngine() {
  const { user } = useAuth()
  const locationId = user?.locationId

  if (!locationId) {
    return (
      <>
        
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={AlertTriangle}
            title="Dein Account ist noch keinem Standort zugeordnet"
            description="Ein OKUN-Administrator muss deinen Account einmalig einem Standort zuordnen, bevor hier das Fairness-Dashboard angezeigt werden kann. Bitte wende dich an die OKUN-Plattformverwaltung."
          />
        </div>
      </>
    )
  }

  return (
    <>
      
      <div className="p-4 sm:p-6">
        <FairnessEngineDashboard fetchUrl={`/api/fairness-engine?locationId=${locationId}`} />
      </div>
    </>
  )
}
