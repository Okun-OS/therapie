'use client'

import { Header } from '@/components/layout/Header'
import { useAuth } from '@/lib/auth-context'
import { WorkforceInsightsDashboard } from '@/components/workforce-insights/WorkforceInsightsDashboard'

export default function AdminWorkforceInsights() {
  const { user } = useAuth()
  const locationId = user?.locationId || 'loc1'

  return (
    <>
      <Header title="Workforce Insights" subtitle="Kennzahlen für deinen Standort" />
      <div className="p-4 sm:p-6">
        <WorkforceInsightsDashboard fetchUrl={`/api/workforce-insights?locationId=${locationId}`} />
      </div>
    </>
  )
}
