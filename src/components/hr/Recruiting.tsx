'use client'

import { useState, useEffect } from 'react'
import { Briefcase, Users2, Globe } from 'lucide-react'
import { Stellenliste } from './Stellenliste'
import { Bewerberliste } from './Bewerberliste'
import { Karriereeinstellungen } from './Karriereeinstellungen'

/**
 * §148 Recruiting an einem Ort: Stellen, Bewerber, Karriereseite.
 *
 * Bewusst drei Reiter und keine drei Menüpunkte. Es ist ein Ablauf: Man
 * schreibt aus, es kommen Bewerbungen, man stellt jemanden ein. Wer dafür
 * zwischen drei Seiten wechseln muss, verliert den Faden.
 *
 * Dieselbe Oberfläche für Standortleitung und Unternehmensebene. Was die
 * Leitung nicht darf — die öffentliche Seite einrichten —, entscheidet die
 * Schnittstelle, nicht ein anderes Bauteil.
 */
export function Recruiting() {
  const [sicht, setSicht] = useState<'stellen' | 'bewerber' | 'seite'>('stellen')
  const [slug, setSlug] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/karriere-einstellungen').then(r => r.json())
      .then(d => {
        if (d.einstellungen?.karriereAktiv) setSlug(d.einstellungen.karriereSlug)
      })
      .catch(() => undefined)
  }, [])

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy flex items-center gap-2">
          <Briefcase size={20} className="text-teal-600" /> Recruiting
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Stellen ausschreiben, Bewerbungen begleiten, Eingestellte direkt in die
          Personalakte übernehmen.
        </p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          ['stellen', 'Stellen', <Briefcase key="a" size={13} />],
          ['bewerber', 'Bewerber', <Users2 key="b" size={13} />],
          ['seite', 'Karriereseite', <Globe key="c" size={13} />],
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

      {sicht === 'stellen' ? <Stellenliste karriereSlug={slug} />
        : sicht === 'bewerber' ? <Bewerberliste />
          : <Karriereeinstellungen
            beimSpeichern={(s, aktiv) => setSlug(aktiv ? s : null)} />}
    </div>
  )
}
