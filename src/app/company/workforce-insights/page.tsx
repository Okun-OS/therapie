'use client'

import { WorkforceInsightsDashboard } from '@/components/workforce-insights/WorkforceInsightsDashboard'

export default function CompanyWorkforceInsights() {
  return (
    <>
      
      <div className="p-4 sm:p-6">
        <WorkforceInsightsDashboard fetchUrl="/api/workforce-insights?scope=organization" />
      </div>
    </>
  )
}
