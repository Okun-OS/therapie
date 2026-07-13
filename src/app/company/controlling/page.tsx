'use client'

import { ControllingDashboard } from '@/components/controlling/ControllingDashboard'

export default function CompanyControlling() {
  return (
    <>
      
      <div className="p-4 sm:p-6">
        <ControllingDashboard fetchUrl="/api/controlling?scope=organization" />
      </div>
    </>
  )
}
