'use client'

import { PersonnelRiskDashboard } from '@/components/personnel-risk/PersonnelRiskDashboard'

export default function CompanyPersonnelRisk() {
  return (
    <>
      
      <div className="p-4 sm:p-6">
        <PersonnelRiskDashboard fetchUrl="/api/personnel-risk?scope=organization" />
      </div>
    </>
  )
}
