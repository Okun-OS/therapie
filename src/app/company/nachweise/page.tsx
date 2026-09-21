'use client'

import { useState } from 'react'
import { ShieldAlert, Settings2, ListChecks } from 'lucide-react'
import { Fristenliste } from '@/components/hr/Fristenliste'
import { Nachweiskatalog } from '@/components/hr/Nachweiskatalog'

/**
 * §146 Nachweise und Fristen aus Sicht des Unternehmens.
 *
 * Zwei Sichten auf dieselbe Sache, bewusst auf einer Seite: der Stand (wer
 * braucht was) und der Katalog (was führen wir überhaupt). Wer im Stand eine
 * Lücke sieht, ist einen Klick von der Ursache entfernt — meistens fehlt ein
 * Eintrag im Katalog.
 */
export default function CompanyNachweise() {
  const [sicht, setSicht] = useState<'stand' | 'katalog'>('stand')

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy flex items-center gap-2">
          <ShieldAlert size={20} className="text-teal-600" /> Nachweise und Fristen
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Qualifikationen, Pflichtnachweise und Vertragsfristen — was der Betrieb
          führt und wo es klemmt.
        </p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          ['stand', 'Stand', <ListChecks key="a" size={13} />],
          ['katalog', 'Katalog', <Settings2 key="b" size={13} />],
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

      {sicht === 'stand' ? <Fristenliste /> : <Nachweiskatalog />}
    </div>
  )
}
