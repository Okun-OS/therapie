'use client'

import { Header } from '@/components/layout/Header'
import { useAuth } from '@/lib/auth-context'
import { PersonnelRiskDashboard } from '@/components/personnel-risk/PersonnelRiskDashboard'

export default function AdminPersonnelRisk() {
  const { user } = useAuth()
  const locationId = user?.locationId || 'loc1'

  return (
    <>
      <Header title="Personalrisiko-Analyse" subtitle="Burnout-, Fluktuations- und Unterbesetzungsrisiko für deinen Standort" />
      <div className="p-4 sm:p-6">
        <PersonnelRiskDashboard fetchUrl={`/api/personnel-risk?locationId=${locationId}`} />
      </div>
    </>
  )
}
