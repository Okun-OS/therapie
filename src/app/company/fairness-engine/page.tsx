'use client'

import { FairnessEngineDashboard } from '@/components/fairness/FairnessEngineDashboard'

export default function CompanyFairnessEngine() {
  return (
    <>
      
      <div className="p-4 sm:p-6">
        <FairnessEngineDashboard fetchUrl="/api/fairness-engine?scope=organization" />
      </div>
    </>
  )
}
