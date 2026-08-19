'use client'

// §106 Urlaub und Wünsche — eine Seite statt drei Reitern.
//
// Urlaubsanträge, Jahresplanung und Dienstwünsche waren drei Menüpunkte, die
// dieselbe Frage aus drei Richtungen beantworten: wer will wann frei. Jetzt
// liegen sie nebeneinander, oben umschaltbar.

import { useState } from 'react'
import { Palmtree, CalendarRange, Star } from 'lucide-react'
import { Urlaubsantraege } from '@/components/urlaub/Urlaubsantraege'
import { Jahresplanung } from '@/components/urlaub/Jahresplanung'
import { Dienstwuensche } from '@/components/urlaub/Dienstwuensche'

const REITER = [
  { id: 'antraege', label: 'Anträge',       icon: Palmtree,      beschreibung: 'Urlaubsanträge genehmigen oder ablehnen' },
  { id: 'jahr',     label: 'Jahresplanung', icon: CalendarRange, beschreibung: 'Urlaub über das Jahr verteilen' },
  { id: 'wuensche', label: 'Dienstwünsche', icon: Star,          beschreibung: 'Schichtwünsche und sonstige Anfragen' },
] as const

type ReiterId = typeof REITER[number]['id']

export default function AdminUrlaub() {
  const [aktiv, setAktiv] = useState<ReiterId>('antraege')
  const aktuell = REITER.find(r => r.id === aktiv)!

  return (
    <div>
      <div className="p-4 sm:p-6 pb-0">
        <h1 className="text-2xl font-bold text-navy">Urlaub &amp; Wünsche</h1>
        <p className="text-sm text-gray-500">{aktuell.beschreibung}</p>
        <div className="flex flex-wrap gap-1.5 border-b border-gray-100 py-3">
          {REITER.map(r => {
            const Icon = r.icon
            const an = r.id === aktiv
            return (
              <button
                key={r.id}
                onClick={() => setAktiv(r.id)}
                className={`flex items-center gap-1.5 text-sm rounded-xl px-3 py-1.5 border transition-all ${
                  an ? 'border-navy bg-navy text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <Icon size={14} />{r.label}
              </button>
            )
          })}
        </div>
      </div>

      {aktiv === 'antraege' && <Urlaubsantraege />}
      {aktiv === 'jahr'     && <Jahresplanung />}
      {aktiv === 'wuensche' && <Dienstwuensche />}
    </div>
  )
}
