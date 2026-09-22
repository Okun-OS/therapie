'use client'

import { useState } from 'react'
import { ShieldAlert, ListChecks, HeartPulse, Inbox } from 'lucide-react'
import { Fristenliste } from '@/components/hr/Fristenliste'
import { BemListe } from '@/components/hr/BemListe'
import { Anforderungsliste } from '@/components/hr/Anforderungsliste'

/**
 * §146 Nachweise und Fristen aus Sicht der Standortleitung.
 *
 * Sie sieht, wer was braucht — aber nur die Arten, die für sie freigegeben
 * sind. Der Katalog selbst gehört der Unternehmensebene: Welche Pflichten ein
 * Betrieb führt, ist eine Entscheidung über Recht und Haftung und gilt für
 * alle Standorte.
 */
export default function AdminNachweise() {
  const [sicht, setSicht] = useState<'stand' | 'anfordern' | 'bem'>('stand')

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
      {/* §147 BEM steht hier nur dann, wenn das Unternehmen es freigegeben hat —
          die Liste selbst sagt es, ohne etwas preiszugeben. */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          ['stand', 'Nachweise', <ListChecks key="a" size={13} />],
          ['anfordern', 'Angefordert', <Inbox key="c" size={13} />],
          ['bem', 'BEM', <HeartPulse key="b" size={13} />],
        ] as const).map(([wert, text, sym]) => (
          <button
            key={wert}
            onClick={() => setSicht(wert)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2
                        rounded-lg ${sicht === wert ? 'bg-white text-navy shadow-sm'
              : 'text-gray-500'}`}>
            {sym} {text}
          </button>
        ))}
      </div>

      {sicht === 'stand' ? <Fristenliste />
        : sicht === 'anfordern' ? <Anforderungsliste />
          : <BemListe />}
    </div>
  )
}
