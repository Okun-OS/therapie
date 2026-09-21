'use client'

import { ShieldAlert } from 'lucide-react'
import { Fristenliste } from '@/components/hr/Fristenliste'

/**
 * §146 Nachweise und Fristen aus Sicht der Standortleitung.
 *
 * Sie sieht, wer was braucht — aber nur die Arten, die für sie freigegeben
 * sind. Der Katalog selbst gehört der Unternehmensebene: Welche Pflichten ein
 * Betrieb führt, ist eine Entscheidung über Recht und Haftung und gilt für
 * alle Standorte.
 */
export default function AdminNachweise() {
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy flex items-center gap-2">
          <ShieldAlert size={20} className="text-teal-600" /> Nachweise und Fristen
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Wer welche Schulung, Belehrung oder Untersuchung braucht — und bis wann.
          Was abgelaufen ist, steht oben.
        </p>
      </div>
      <Fristenliste />
    </div>
  )
}
