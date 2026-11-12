'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, FileText, CheckCircle2, ShieldCheck, Clock, AlertTriangle,
} from 'lucide-react'

/**
 * §150 Belehrungen aus Sicht des Menschen.
 *
 * WARUM DER KNOPF ERST NACH DEM ÖFFNEN LEBT
 * Weil eine Bestätigung ohne den Inhalt für beide Seiten wertlos ist: Der
 * Betrieb hat keinen Nachweis, und der Mensch hat unterschrieben, was er nicht
 * kennt. Das Öffnen merkt sich der Server beim Ausliefern der Datei — nicht
 * diese Seite, die alles behaupten könnte.
 *
 * WARUM DER BESTÄTIGTE SATZ DANACH STEHEN BLEIBT
 * Weil er der Nachweis ist. Wer in einem halben Jahr wissen will, was er
 * eigentlich bestätigt hat, findet hier den Wortlaut von damals — nicht den
 * von heute.
 */

interface Belehrung {
  id: string
  titel: string
  beschreibung: string | null
  dateiname: string | null
  bestaetigungstext: string
  status: string
  fristBis: string | null
  oeffnenNoetig: boolean
  angesehenAm: string | null
  bestaetigtAm: string | null
}

export function MeineBelehrungen() {
  const [alle, setAlle] = useState<Belehrung[]>([])
  const [laden, setLaden] = useState(true)
  const [geoeffnet, setGeoeffnet] = useState<Set<string>>(new Set())
  const [arbeitet, setArbeitet] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  const holen = useCallback(async () => {
    const d = await fetch('/api/belehrungen').then(r => r.json()).catch(() => ({}))
    setAlle(d.belehrungen ?? [])
    setLaden(false)
  }, [])

  useEffect(() => { holen() }, [holen])

  async function bestaetigen(id: string) {
    setArbeitet(id); setFehler(null)
    const res = await fetch(`/api/belehrungen/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktion: 'bestaetigen' }),
    })
    const d = await res.json().catch(() => ({}))
    setArbeitet(null)
    if (!res.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
    holen()
  }

  if (laden) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-gray-300" />
      </div>
    )
  }
  if (alle.length === 0) return null

  const offen = alle.filter(b => !b.bestaetigtAm && b.status === 'verteilt')
  const erledigt = alle.filter(b => b.bestaetigtAm)

  return (
    <div className="space-y-5">
      {offen.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">
            Belehrungen zum Bestätigen
          </h2>
          <ul className="mt-2 space-y-2">
            {offen.map(b => {
              const kannKlicken = !b.oeffnenNoetig || b.angesehenAm
                || geoeffnet.has(b.id)
              const ueberfaellig = b.fristBis
                && new Date(b.fristBis).getTime() < Date.now()
              return (
                <li key={b.id}
                  className="bg-white rounded-2xl border border-amber-200 p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-navy">{b.titel}</p>
                    {b.beschreibung && (
                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">
                        {b.beschreibung}
                      </p>
                    )}
                    {b.fristBis && (
                      <p className={`flex items-center gap-1.5 text-xs mt-1.5
                                     ${ueberfaellig ? 'text-red-600 font-semibold'
                        : 'text-gray-400'}`}>
                        {ueberfaellig ? <AlertTriangle size={12} /> : <Clock size={12} />}
                        bis {new Date(b.fristBis).toLocaleDateString('de-DE')}
                      </p>
                    )}
                  </div>

                  <a
                    href={`/api/belehrungen/${b.id}/dokument`}
                    target="_blank" rel="noreferrer"
                    onClick={() => setGeoeffnet(s => new Set(s).add(b.id))}
                    className="flex items-center justify-center gap-2 w-full
                               bg-navy text-white text-sm font-semibold py-3
                               rounded-xl">
                    <FileText size={15} />
                    {b.angesehenAm || geoeffnet.has(b.id)
                      ? 'Noch einmal lesen' : 'Belehrung lesen'}
                  </a>

                  <div className="bg-gray-50 rounded-xl p-3.5">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {b.bestaetigungstext}
                    </p>
                  </div>

                  <button
                    onClick={() => bestaetigen(b.id)}
                    disabled={!kannKlicken || arbeitet === b.id}
                    className="w-full flex items-center justify-center gap-2
                               bg-teal-600 text-white text-sm font-semibold py-3.5
                               rounded-xl disabled:opacity-40">
                    {arbeitet === b.id ? <Loader2 size={16} className="animate-spin" />
                      : <ShieldCheck size={16} />}
                    Bestätigen
                  </button>
                  {!kannKlicken && (
                    <p className="text-xs text-gray-400 text-center">
                      Bitte öffne zuerst das Dokument. Eine Bestätigung ohne den
                      Inhalt wäre für beide Seiten wertlos.
                    </p>
                  )}
                  {fehler && arbeitet === null && (
                    <p className="text-xs text-red-600 text-center">{fehler}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {erledigt.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">
            Bestätigt
          </h2>
          <ul className="mt-2 space-y-2">
            {erledigt.map(b => (
              <li key={b.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-teal-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-semibold text-navy">{b.titel}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      bestätigt am{' '}
                      {new Date(b.bestaetigtAm!).toLocaleString('de-DE')}
                    </p>
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed italic">
                      „{b.bestaetigungstext}“
                    </p>
                    <a href={`/api/belehrungen/${b.id}/dokument`}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold
                                 text-teal-700 mt-2">
                      <FileText size={12} /> Dokument ansehen
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
