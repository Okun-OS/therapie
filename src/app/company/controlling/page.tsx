'use client'

import { Header } from '@/components/layout/Header'
import { ControllingDashboard } from '@/components/controlling/ControllingDashboard'

export default function CompanyControlling() {
  return (
    <>
      <Header title="KI-Controlling-Dashboard" subtitle="Automatische Zusammenfassung, Warnungen und Handlungsempfehlungen über alle Standorte" />
      <div className="p-4 sm:p-6">
        <ControllingDashboard fetchUrl="/api/controlling?scope=organization" />
      </div>
    </>
  )
}
