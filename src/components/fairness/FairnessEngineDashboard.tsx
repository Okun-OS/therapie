'use client'

import { useEffect, useState } from 'react'
import { Info, History, ShieldAlert } from 'lucide-react'
import { FairnessReport } from '@/components/schedule/FairnessReport'
import type { ShiftFairnessData } from '@/lib/types'

export function FairnessEngineDashboard({ fetchUrl }: { fetchUrl: string }) {
  const [data, setData] = useState<ShiftFairnessData[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(fetchUrl)
      .then(res => res.json())
      .then(json => setData(json.data))
      .finally(() => setLoading(false))
  }, [fetchUrl])

  if (loading) return <div className="text-center py-12 text-sm text-gray-400">Wird geladen...</div>
  if (!data) return <p className="text-sm text-gray-400 text-center py-12">Keine Daten verfügbar</p>

  const flagged = data.filter(d => d.issues.length > 0)

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
        <History size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Gedächtnis der Fairness Engine</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Die Engine merkt sich die letzten 4 Wochen an Dienstplänen (inkl. Wochenenden) und berücksichtigt diese Historie automatisch bei jeder neuen KI-Planung – u. a. bei der Verteilung von Wochenend- und Freitag-Frühdiensten.
          </p>
        </div>
      </div>

      {flagged.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
          <ShieldAlert size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">{flagged.length} Mitarbeiter mit aktiven Fairness-Warnungen</p>
            <p className="text-xs text-red-600 mt-0.5">
              Unfaire Verteilungen werden aktiv gemeldet, sobald ein Grenzwert (z. B. Wochenenddienste, Freitag-Frühdienst) überschritten wird.
            </p>
          </div>
        </div>
      )}

      <FairnessReport data={data} />

      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex gap-3">
        <Info size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500">
          Grenzwerte für Sondertage (Freitag-Spät, Montag-Früh, Freitag-Früh, Wochenende) werden pro Standort in den Planungsregeln des Dienstplans festgelegt.
        </p>
      </div>
    </div>
  )
}
