'use client'

import { Header } from '@/components/layout/Header'
import { WorkforceInsightsDashboard } from '@/components/workforce-insights/WorkforceInsightsDashboard'

export default function CompanyWorkforceInsights() {
  return (
    <>
      <Header title="Workforce Insights" subtitle="Kennzahlen über alle Standorte" />
      <div className="p-4 sm:p-6">
        <WorkforceInsightsDashboard fetchUrl="/api/workforce-insights?scope=organization" />
      </div>
    </>
  )
}
