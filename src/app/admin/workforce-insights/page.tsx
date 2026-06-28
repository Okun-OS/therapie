'use client'

import { Header } from '@/components/layout/Header'
import { useAuth } from '@/lib/auth-context'
import { WorkforceInsightsDashboard } from '@/components/workforce-insights/WorkforceInsightsDashboard'
import { AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export default function AdminWorkforceInsights() {
  const { user } = useAuth()
  const locationId = user?.locationId

  if (!locationId) {
    return (
      <>
        <Header title="Workforce Insights" subtitle="Kein Standort zugeordnet" />
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={AlertTriangle}
            title="Dein Account ist noch keinem Standort zugeordnet"
            description="Ein OKUN-Administrator muss deinen Account einmalig einem Standort zuordnen, bevor hier Kennzahlen angezeigt werden können. Bitte wende dich an die OKUN-Plattformverwaltung."
          />
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Workforce Insights" subtitle="Kennzahlen für deinen Standort" />
      <div className="p-4 sm:p-6">
        <WorkforceInsightsDashboard fetchUrl={`/api/workforce-insights?locationId=${locationId}`} />
      </div>
    </>
  )
}
