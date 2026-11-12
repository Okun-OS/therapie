'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Umlagesaetze } from '@/components/payroll/Umlagesaetze'
import { BavVertraege } from '@/components/payroll/BavVertraege'
import { Pfaendungen } from '@/components/payroll/Pfaendungen'
import { Kurzarbeit } from '@/components/payroll/Kurzarbeit'

/**
 * §162 Was nicht in jede Abrechnung gehört.
 *
 * WARUM DAS EINE EIGENE SEITE IST UND NICHT IN DER LOHNABRECHNUNG STEHT
 * Zwei Gründe, und der zweite wiegt schwerer.
 *
 * Der erste: Es sind Stammdaten, keine Monatsarbeit. Ein bAV-Vertrag wird
 * einmal angelegt und läuft dann Jahre; die Umlagesätze einer Kasse ändern
 * sich einmal im Jahr. Sie in die Monatsansicht zu mischen hieße, sie jeden
 * Monat zu sehen und nie anzufassen.
 *
 * Der zweite: DIE ROLLE. `/company/payroll` ist dieselbe Seite wie
 * `/admin/payroll` — die Standortleitung sieht sie. Eine Pfändung darf sie
 * nicht sehen (§155). Diese Seite liegt deshalb allein unter `/company` und
 * nirgendwo sonst; die Schnittstellen dahinter prüfen die Rolle noch einmal
 * selbst, denn eine Seite, die man nicht verlinkt, ist keine Sicherung.
 */

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

export default function Lohnverwaltung() {
  const heute = new Date()
  const [jahr, setJahr] = useState(heute.getFullYear())
  const [monat, setMonat] = useState(heute.getMonth() + 1)
  const [mitarbeiter, setMitarbeiter] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/employees')
      .then(r => r.json())
      .then(d => setMitarbeiter(
        (d.employees ?? []).map((e: { id: string; name: string }) => ({
          id: e.id, name: e.name,
        }))))
      .catch(() => setMitarbeiter([]))
  }, [])

  function verschieben(richtung: number) {
    const m = monat + richtung
    if (m < 1) { setMonat(12); setJahr(j => j - 1) }
    else if (m > 12) { setMonat(1); setJahr(j => j + 1) }
    else setMonat(m)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-navy">Pfändung, bAV & Umlagen</h1>
        <p className="text-sm text-gray-500 mt-1">
          Was nicht in jede Abrechnung gehört, aber in jede Rechnung einfließt.
          Eingetragen wird hier, gerechnet beim nächsten Abrechnungslauf unter{' '}
          <Link href="/company/payroll" className="text-brand font-medium">
            Lohnabrechnung
          </Link>.
        </p>
      </div>

      {/* Nur die Kurzarbeit hängt an einem Monat — die übrigen drei sind
          Stammdaten. Der Monatswechsel steht deshalb direkt bei ihr. */}
      <Umlagesaetze />

      <BavVertraege mitarbeiter={mitarbeiter} />

      <Pfaendungen mitarbeiter={mitarbeiter} />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button onClick={() => verschieben(-1)}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-navy tabular-nums">
            {MONATE[monat - 1]} {jahr}
          </span>
          <button onClick={() => verschieben(1)}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
            <ChevronRight size={16} />
          </button>
          <span className="text-xs text-gray-400">gilt für die Kurzarbeit unten</span>
        </div>
        <Kurzarbeit jahr={jahr} monat={monat} mitarbeiter={mitarbeiter} />
      </div>
    </div>
  )
}
