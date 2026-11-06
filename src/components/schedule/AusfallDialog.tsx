'use client'

// §101 „Dienst fällt aus" — der Ersatz für den früheren KI-Chat.
//
// Zwei Schritte, keine Zwischenfragen:
//   1. Grund angeben, Empfänger wählen, Ausfall melden
//   2. Sobald sich jemand meldet: Dienstanfrage schicken oder direkt besetzen

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/lib/toast-context'
import { AlertTriangle, Send, Check, Loader2, Users, UserCheck } from 'lucide-react'

interface Kollege { id: string; name: string; gruppe?: string | null }

export interface AusfallDaten {
  scheduleEntryId?: string
  locationId: string
  date: string
  startTime: string
  endTime: string
  shiftId?: string
  shiftName?: string
  originalEmployeeId?: string
  originalEmployeeName?: string
}

const GRUENDE = ['Krankheit', 'Kind krank', 'Kurzfristig verhindert', 'Fortbildung', 'Sonstiges']

export function AusfallDialog({
  daten,
  kollegen,
  onClose,
  onErledigt,
}: {
  daten: AusfallDaten | null
  kollegen: Kollege[]
  onClose: () => void
  onErledigt: () => void
}) {
  const { showToast } = useToast()
  const [grund, setGrund] = useState('Krankheit')
  const [empfaenger, setEmpfaenger] = useState<'alle' | 'auswahl' | 'niemand'>('alle')
  const [ausgewaehlt, setAusgewaehlt] = useState<string[]>([])
  const [sendet, setSendet] = useState(false)
  const [gemeldet, setGemeldet] = useState<{ id: string; gefragt: number } | null>(null)
  const [besetzt, setBesetzt] = useState<string | null>(null)

  useEffect(() => {
    if (!daten) { setGemeldet(null); setAusgewaehlt([]); setGrund('Krankheit'); setEmpfaenger('alle'); setBesetzt(null) }
  }, [daten])

  if (!daten) return null

  // Wer ausgefallen ist, kann sich nicht selbst vertreten
  const moegliche = kollegen.filter(k => k.id !== daten.originalEmployeeId)

  const melden = async () => {
    if (empfaenger === 'auswahl' && ausgewaehlt.length === 0) {
      showToast('Bitte mindestens eine Person auswählen', 'error'); return
    }
    setSendet(true)
    try {
      const res = await fetch('/api/substitutions/ausfall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...daten, grund, empfaenger, empfaengerIds: ausgewaehlt }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(d.error ?? 'Melden fehlgeschlagen', 'error'); return }
      setGemeldet({ id: d.anfrage.id, gefragt: d.gefragt })
      showToast(
        d.gefragt > 0
          ? `Ausfall gemeldet — ${d.benachrichtigt} von ${d.gefragt} benachrichtigt`
          : 'Ausfall gemeldet',
        'success',
      )
      onErledigt()
    } catch {
      showToast('Melden fehlgeschlagen', 'error')
    } finally { setSendet(false) }
  }

  const uebernehmenLassen = async (employeeId: string, aktion: 'anfragen' | 'besetzen') => {
    if (!gemeldet) return
    setSendet(true)
    try {
      const res = await fetch(`/api/substitutions/${gemeldet.id}/anfragen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, aktion }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(d.error ?? 'Fehlgeschlagen', 'error'); return }
      if (aktion === 'besetzen') {
        setBesetzt(employeeId)
        showToast('Dienst besetzt — er steht wieder im Plan', 'success')
        onErledigt()
      } else {
        showToast('Dienstanfrage verschickt', 'success')
      }
    } catch {
      showToast('Fehlgeschlagen', 'error')
    } finally { setSendet(false) }
  }

  const [j, m, t] = daten.date.split('-')

  return (
    <Modal open onClose={onClose} title={gemeldet ? 'Vertretung finden' : 'Dienst fällt aus'} size="md">
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl p-3">
          <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">{daten.shiftName ?? 'Dienst'} · {t}.{m}.{j}</p>
            <p className="text-xs">
              {daten.startTime}–{daten.endTime}
              {daten.originalEmployeeName ? ` · bisher ${daten.originalEmployeeName}` : ''}
            </p>
          </div>
        </div>

        {!gemeldet ? (
          <>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Grund</p>
              <div className="flex flex-wrap gap-1.5">
                {GRUENDE.map(g => (
                  <button
                    key={g}
                    onClick={() => setGrund(g)}
                    className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${
                      grund === g ? 'border-navy bg-navy text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >{g}</button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Wer soll Bescheid bekommen?</p>
              <div className="space-y-1.5">
                {([
                  ['alle', <Users key="a" size={14} />, 'Alle Mitarbeiter des Standorts', `${moegliche.length} Personen`],
                  ['auswahl', <UserCheck key="b" size={14} />, 'Nur ausgewählte Mitarbeiter', 'gezielt fragen'],
                  ['niemand', <AlertTriangle key="c" size={14} />, 'Niemand benachrichtigen', 'nur vermerken'],
                ] as const).map(([wert, icon, titel, zusatz]) => (
                  <button
                    key={wert}
                    onClick={() => setEmpfaenger(wert)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      empfaenger === wert ? 'border-navy bg-navy/5' : 'border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-gray-400">{icon}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-navy">{titel}</span>
                      <span className="block text-[11px] text-gray-400">{zusatz}</span>
                    </span>
                    {empfaenger === wert && <Check size={14} className="text-navy flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {empfaenger === 'auswahl' && (
              <div className="border border-gray-100 rounded-xl p-2 max-h-52 overflow-y-auto">
                {moegliche.length === 0 ? (
                  <p className="text-xs text-gray-400 p-2">Keine weiteren Mitarbeiter am Standort.</p>
                ) : moegliche.map(k => (
                  <label key={k.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ausgewaehlt.includes(k.id)}
                      onChange={e => setAusgewaehlt(prev =>
                        e.target.checked ? [...prev, k.id] : prev.filter(x => x !== k.id))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-navy">{k.name}</span>
                    {k.gruppe && <span className="text-[11px] text-gray-400">· {k.gruppe}</span>}
                  </label>
                ))}
              </div>
            )}

            <Button onClick={melden} disabled={sendet} className="w-full gap-1.5">
              {sendet ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Ausfall melden{empfaenger !== 'niemand' ? ' und benachrichtigen' : ''}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              {gemeldet.gefragt > 0
                ? `${gemeldet.gefragt} Mitarbeiter wurden benachrichtigt. Sobald sich jemand meldet, kannst du hier die Dienstanfrage schicken oder den Dienst direkt besetzen.`
                : 'Der Ausfall ist vermerkt. Du kannst den Dienst hier direkt besetzen.'}
            </p>
            <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {moegliche.map(k => (
                <div key={k.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-navy truncate">{k.name}</span>
                    {k.gruppe && <span className="block text-[11px] text-gray-400">{k.gruppe}</span>}
                  </span>
                  {besetzt === k.id ? (
                    <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                      <Check size={13} /> übernimmt
                    </span>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" disabled={sendet || !!besetzt}
                        onClick={() => uebernehmenLassen(k.id, 'anfragen')}>
                        Anfragen
                      </Button>
                      <Button size="sm" disabled={sendet || !!besetzt}
                        onClick={() => uebernehmenLassen(k.id, 'besetzen')}>
                        Besetzen
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <Button variant="secondary" onClick={onClose} className="w-full">Fertig</Button>
          </>
        )}
      </div>
    </Modal>
  )
}
