'use client'

import { Header } from '@/components/layout/Header'
import { useAuth } from '@/lib/auth-context'
import { ControllingDashboard } from '@/components/controlling/ControllingDashboard'
import { AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export default function AdminControlling() {
  const { user } = useAuth()
  const locationId = user?.locationId

  if (!locationId) {
    return (
      <>
        <Header title="KI-Controlling-Dashboard" subtitle="Kein Standort zugeordnet" />
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={AlertTriangle}
            title="Dein Account ist noch keinem Standort zugeordnet"
            description="Ein OKUN-Administrator muss deinen Account einmalig einem Standort zuordnen, bevor hier das Controlling-Dashboard angezeigt werden kann. Bitte wende dich an die OKUN-Plattformverwaltung."
          />
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="KI-Controlling-Dashboard" subtitle="Automatische Zusammenfassung, Warnungen und Handlungsempfehlungen für deinen Standort" />
      <div className="p-4 sm:p-6">
        <ControllingDashboard fetchUrl={`/api/controlling?locationId=${locationId}`} />
      </div>
    </>
  )
}
