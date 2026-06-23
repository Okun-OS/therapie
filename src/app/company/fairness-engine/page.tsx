'use client'

import { Header } from '@/components/layout/Header'
import { FairnessEngineDashboard } from '@/components/fairness/FairnessEngineDashboard'

export default function CompanyFairnessEngine() {
  return (
    <>
      <Header title="Fairness Engine" subtitle="Transparenz-Dashboard über alle Standorte" />
      <div className="p-4 sm:p-6">
        <FairnessEngineDashboard fetchUrl="/api/fairness-engine?scope=organization" />
      </div>
    </>
  )
}
