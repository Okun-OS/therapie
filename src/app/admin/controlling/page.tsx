'use client'

import { Header } from '@/components/layout/Header'
import { useAuth } from '@/lib/auth-context'
import { ControllingDashboard } from '@/components/controlling/ControllingDashboard'

export default function AdminControlling() {
  const { user } = useAuth()
  const locationId = user?.locationId || 'loc1'

  return (
    <>
      <Header title="KI-Controlling-Dashboard" subtitle="Automatische Zusammenfassung, Warnungen und Handlungsempfehlungen für deinen Standort" />
      <div className="p-4 sm:p-6">
        <ControllingDashboard fetchUrl={`/api/controlling?locationId=${locationId}`} />
      </div>
    </>
  )
}
