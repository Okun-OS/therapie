'use client'

import { useEffect, useState } from 'react'
import { Lock, Plane } from 'lucide-react'
import { useToast } from '@/lib/toast-context'

/**
 * §201 Was die Leitung an ihren Gruppen im Alltag einstellt — und nur das.
 *
 * Bis §201 stand das in „Regeln & Wartung", mitten zwischen Dingen, die ein
 * Standort nicht mehr selbst einrichtet (Dienste, Etagen, Mindestbesetzung,
 * eigene Regeln). Die sind mit der Seite gegangen; diese beiden nicht, denn
 * sie sind keine Einrichtung, sondern Tagesgeschäft: Eine Gruppe fährt weg,
 * eine andere hat Eingewöhnung. Das weiß nur der Betrieb, und es ändert sich
 * jede Woche.
 *
 * Übernommen unverändert, mit ihren Begründungen:
 *
 * §166 Die Abgabesperre. Eine Gruppe in der Eingewöhnung gibt niemanden ab:
 * Die Kinder lernen gerade ein Gesicht, und wer es ihnen wegnimmt, fängt von
 * vorne an. Immer mit Datum — eine Sperre ohne Ablauf steht in zwei Jahren
 * noch da, und dann fragt sich jemand, warum nie jemand aus dieser Gruppe hilft.
 *
 * §182 „Diese Gruppe ist unterwegs" — vor der Planung, nicht danach. Beide
 * Daten gehören zusammen: Ein Zeitraum ohne Ende nähme die Gruppe dauerhaft
 * aus der Planung. Solange nur eins gesetzt ist, wird nichts gespeichert.
 */

interface Gruppe {
  id: string
  name: string
  type: string
  parentId: string | null
  abgabeGesperrtBis?: string | null
  unterwegsVon?: string | null
  unterwegsBis?: string | null
  unterwegsGrund?: string | null
}

export function GruppenImAlltag({ locationId }: { locationId: string }) {
  const { showToast } = useToast()
  const [einheiten, setEinheiten] = useState<Gruppe[]>([])
  const [geladen, setGeladen] = useState(false)

  useEffect(() => {
    fetch(`/api/planning-units?locationId=${locationId}`)
      .then(r => r.json())
      .then(d => setEinheiten(d.units ?? []))
      .catch(() => setEinheiten([]))
      .finally(() => setGeladen(true))
  }, [locationId])

  const speichern = async (daten: Record<string, unknown>, erfolg: string) => {
    try {
      const res = await fetch('/api/planning-units', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(daten),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        showToast(d.error ?? 'Speichern fehlgeschlagen', 'error')
        return
      }
      showToast(erfolg, 'success')
    } catch {
      showToast('Speichern fehlgeschlagen', 'error')
    }
  }

  const sperre = (id: string, bis: string) => {
    setEinheiten(prev => prev.map(u => u.id === id ? { ...u, abgabeGesperrtBis: bis || null } : u))
    speichern({ id, abgabeGesperrtBis: bis || null }, bis ? 'Eingewöhnung gespeichert' : 'Eingewöhnung entfernt')
  }

  const unterwegs = (id: string, feld: 'unterwegsVon' | 'unterwegsBis' | 'unterwegsGrund', wert: string) => {
    const naechste = einheiten.map(u => u.id === id ? { ...u, [feld]: wert || null } : u)
    setEinheiten(naechste)
    const u = naechste.find(x => x.id === id)
    if (!u || Boolean(u.unterwegsVon) !== Boolean(u.unterwegsBis)) return
    speichern({
      id,
      unterwegsVon: u.unterwegsVon ?? null,
      unterwegsBis: u.unterwegsBis ?? null,
      unterwegsGrund: u.unterwegsGrund ?? null,
    }, u.unterwegsVon ? 'Zeitraum gespeichert' : 'Zeitraum entfernt')
  }

  const gruppen = einheiten.filter(u => u.type !== 'etage')
  const etage = (id: string | null) => einheiten.find(u => u.id === id)?.name

  if (!geladen) return <p className="text-sm text-gray-400">Wird geladen…</p>
  if (gruppen.length === 0) {
    return <p className="text-sm text-gray-500">Für diesen Standort sind keine Gruppen angelegt.</p>
  }

  return (
    <div data-test="gruppen-im-alltag" className="space-y-3">
      <p className="text-xs text-gray-500 leading-relaxed">
        <Lock size={11} className="inline text-amber-600" /> <strong>Eingewöhnung:</strong> Die
        Gruppe gibt bis zu diesem Tag niemanden an andere Gruppen ab.{' '}
        <Plane size={11} className="inline text-brand" /> <strong>Unterwegs:</strong> Fahrt,
        Projektwoche, Schließzeit — die Gruppe braucht dann keine Besetzung, und ihre Kräfte
        bleiben bei ihr. Beide Daten setzen.
      </p>
      <div className="rounded-xl border border-gray-100 divide-y divide-gray-100">
        {gruppen.map(u => (
          <div key={u.id} className="px-3 py-2.5 space-y-2">
            <p className="text-sm font-semibold text-navy">
              {u.name}{etage(u.parentId) && <span className="text-xs font-normal text-gray-400"> · {etage(u.parentId)}</span>}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <Lock size={12} className={u.abgabeGesperrtBis ? 'text-amber-600' : 'text-gray-300'} />
                Eingewöhnung bis
                <input
                  type="date"
                  value={u.abgabeGesperrtBis ?? ''}
                  onChange={e => sperre(u.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-1.5 py-1"
                />
              </label>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Plane size={12} className={u.unterwegsVon && u.unterwegsBis ? 'text-brand' : 'text-gray-300'} />
                Unterwegs
                <input type="date" value={u.unterwegsVon ?? ''}
                  onChange={e => unterwegs(u.id, 'unterwegsVon', e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-1.5 py-1" />
                bis
                <input type="date" value={u.unterwegsBis ?? ''}
                  onChange={e => unterwegs(u.id, 'unterwegsBis', e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-1.5 py-1" />
                <input type="text" value={u.unterwegsGrund ?? ''} placeholder="Grund"
                  onChange={e => unterwegs(u.id, 'unterwegsGrund', e.target.value)}
                  className="w-28 text-xs border border-gray-200 rounded-lg px-1.5 py-1" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
