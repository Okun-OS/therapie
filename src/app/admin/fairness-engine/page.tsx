'use client'

import { Header } from '@/components/layout/Header'
import { useAuth } from '@/lib/auth-context'
import { FairnessEngineDashboard } from '@/components/fairness/FairnessEngineDashboard'

export default function AdminFairnessEngine() {
  const { user } = useAuth()
  const locationId = user?.locationId || 'loc1'

  return (
    <>
      <Header title="Fairness Engine" subtitle="Transparenz-Dashboard für deinen Standort" />
      <div className="p-4 sm:p-6">
        <FairnessEngineDashboard fetchUrl={`/api/fairness-engine?locationId=${locationId}`} />
      </div>
    </>
  )
}
