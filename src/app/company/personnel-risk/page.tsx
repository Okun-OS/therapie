'use client'

import { Header } from '@/components/layout/Header'
import { PersonnelRiskDashboard } from '@/components/personnel-risk/PersonnelRiskDashboard'

export default function CompanyPersonnelRisk() {
  return (
    <>
      <Header title="Personalrisiko-Analyse" subtitle="Burnout-, Fluktuations- und Unterbesetzungsrisiko über alle Standorte" />
      <div className="p-4 sm:p-6">
        <PersonnelRiskDashboard fetchUrl="/api/personnel-risk?scope=organization" />
      </div>
    </>
  )
}
