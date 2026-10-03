'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Loader2, Upload, Paperclip, CheckCircle2, MessageSquare, X, Send, Clock,
  AlertTriangle,
} from 'lucide-react'

/**
 * §149 Was von mir gebraucht wird — die Sicht des Mitarbeiters.
 *
 * WARUM HOCHLADEN UND EINREICHEN EIN KNOPF SIND
 * Weil zwei Knöpfe eine Falle wären: Man lädt hoch, geht weg, und beim Betrieb
 * kommt nie etwas an. Wer eine Datei schickt, reicht ein — das ist die einzige
 * Lesart, die zu dem passt, was ein Mensch dabei denkt.
 *
 * WARUM DAS GESPRÄCH AM VORGANG HÄNGT UND NICHT IM CHAT
 * Weil die Rückfrage („Das Zeugnis ist älter als drei Monate") dorthin gehört,
 * wo der Nachweis liegt. Im Chat wäre sie nach zwei Tagen weggescrollt — und
 * in einem halben Jahr fände niemand mehr, warum etwas zweimal eingereicht
 * wurde.
 */

interface Beitrag {
  id: string
  seite: string
  absenderName: string
  text: string
  dateiId: string | null
  dateiname: string | null
  createdAt: string
}

interface Anforderung {
  id: string
  titel: string
  hinweis: string | null
  fristBis: string | null
  status: string
  stand: string
  standText: string
  hinweisText: string
  ueberfaellig: boolean
  tageBis: number | null
  angefordertVonName: string | null
  createdAt: string
}

const FARBE: Record<string, string> = {
  offen: 'bg-amber-50 text-amber-700',
  rueckfrage: 'bg-red-50 text-red-700',
  eingereicht: 'bg-blue-50 text-blue-700',
  erledigt: 'bg-teal-50 text-teal-700',
  zurueckgezogen: 'bg-gray-100 text-gray-400',
}

export function MeineAnforderungen() {
  const [alle, setAlle] = useState<Anforderung[]>([])
  const [laden, setLaden] = useState(true)
  const [offen, setOffen] = useState<string | null>(null)
  const [beitraege, setBeitraege] = useState<Beitrag[]>([])
  const [text, setText] = useState('')
  const [datei, setDatei] = useState<File | null>(null)
  const [sendet, setSendet] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const dateiFeld = useRef<HTMLInputElement>(null)

  const holen = useCallback(async () => {
    const d = await fetch('/api/anforderungen').then(r => r.json()).catch(() => ({}))
    setAlle(d.anforderungen ?? [])
    setLaden(false)
  }, [])

  useEffect(() => { holen() }, [holen])

  const oeffnen = useCallback(async (id: string) => {
    setOffen(id); setFehler(null); setText(''); setDatei(null)
    const d = await fetch(`/api/anforderungen/${id}`).then(r => r.json()).catch(() => ({}))
    setBeitraege(d.beitraege ?? [])
  }, [])

  async function senden(id: string) {
    if (!text.trim() && !datei) return
    setSendet(true); setFehler(null)
    const form = new FormData()
    form.set('text', text)
    if (datei) form.set('datei', datei)
    const res = await fetch(`/api/anforderungen/${id}`, { method: 'POST', body: form })
    const d = await res.json().catch(() => ({}))
    setSendet(false)
    if (!res.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
    setText(''); setDatei(null)
    if (dateiFeld.current) dateiFeld.current.value = ''
    await holen()
    oeffnen(id)
  }

  if (laden) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-gray-300" />
      </div>
    )
  }

  const zuTun = alle.filter(a => ['offen', 'rueckfrage'].includes(a.stand))
  const wartet = alle.filter(a => a.stand === 'eingereicht')
  const fertig = alle.filter(a => ['erledigt', 'zurueckgezogen'].includes(a.stand))
  const aktuell = alle.find(a => a.id === offen) ?? null

  return (
    <div className="space-y-5">
      {alle.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <CheckCircle2 size={26} className="text-teal-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">
            Es wird gerade nichts von dir gebraucht.
          </p>
        </div>
      )}

      {([
        ['Das wird von dir gebraucht', zuTun],
        ['Eingereicht — wird geprüft', wartet],
        ['Erledigt', fertig],
      ] as const).filter(([, liste]) => liste.length > 0).map(([titel, liste]) => (
        <section key={titel}>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">
            {titel}
          </h2>
          <ul className="mt-2 space-y-2">
            {liste.map(a => (
              <li key={a.id}>
                <button
                  onClick={() => (offen === a.id ? setOffen(null) : oeffnen(a.id))}
                  className={`w-full text-left bg-white border rounded-2xl p-4
                              ${offen === a.id ? 'border-teal-500' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-navy">{a.titel}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{a.hinweisText}</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full
                                      shrink-0 ${FARBE[a.stand]}`}>
                      {a.standText}
                    </span>
                  </div>
                  {a.fristBis && ['offen', 'rueckfrage'].includes(a.stand) && (
                    <p className={`flex items-center gap-1.5 text-xs mt-2
                                   ${a.ueberfaellig ? 'text-red-600 font-semibold'
                      : 'text-gray-400'}`}>
                      {a.ueberfaellig ? <AlertTriangle size={12} /> : <Clock size={12} />}
                      {a.ueberfaellig
                        ? `seit ${Math.abs(a.tageBis ?? 0)} Tagen überfällig`
                        : `bis ${new Date(a.fristBis).toLocaleDateString('de-DE')}`}
                    </p>
                  )}
                </button>

                {offen === a.id && aktuell && (
                  <div className="bg-white border border-teal-500 border-t-0
                                  rounded-b-2xl -mt-2 pt-2 px-4 pb-4 space-y-3">
                    {aktuell.hinweis && (
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3
                                    whitespace-pre-line">{aktuell.hinweis}</p>
                    )}

                    <ul className="space-y-2.5">
                      {beitraege.map(b => (
                        <li key={b.id}
                          className={`text-sm rounded-xl px-3.5 py-2.5 max-w-[92%]
                                      ${b.seite === 'mitarbeiter'
                            ? 'bg-teal-50 ml-auto'
                            : b.seite === 'system'
                              ? 'bg-gray-50 text-gray-500 text-xs mx-auto text-center'
                              : 'bg-gray-100'}`}>
                          {b.seite !== 'system' && (
                            <span className="block text-[11px] font-semibold
                                             text-gray-400 mb-0.5">
                              {b.absenderName}
                            </span>
                          )}
                          <span className="whitespace-pre-line">{b.text}</span>
                          {b.dateiId && (
                            <a href={`/api/files/${b.dateiId}`}
                              target="_blank" rel="noreferrer"
                              className="flex items-center gap-1.5 text-xs font-medium
                                         text-teal-700 mt-1.5">
                              <Paperclip size={12} /> {b.dateiname}
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>

                    {['offen', 'rueckfrage', 'eingereicht'].includes(aktuell.stand) && (
                      <div className="space-y-2.5 pt-1">
                        <input ref={dateiFeld} type="file" className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
                          onChange={e => setDatei(e.target.files?.[0] ?? null)} />
                        {datei ? (
                          <div className="flex items-center gap-2 text-sm bg-gray-50
                                          border border-gray-200 rounded-xl px-3.5 py-2.5">
                            <Paperclip size={14} className="text-gray-400" />
                            <span className="flex-1 truncate">{datei.name}</span>
                            <button onClick={() => setDatei(null)}
                              className="text-gray-400" aria-label="Entfernen">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => dateiFeld.current?.click()}
                            className="w-full flex items-center justify-center gap-2
                                       text-sm font-semibold text-teal-700 bg-teal-50
                                       rounded-xl py-3">
                            <Upload size={15} /> Foto oder PDF hochladen
                          </button>
                        )}
                        <textarea
                          rows={2} value={text} onChange={e => setText(e.target.value)}
                          placeholder="Dazu schreiben (nicht nötig)"
                          className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5
                                     text-sm focus:border-teal-500 focus:outline-none" />
                        {fehler && <p className="text-sm text-red-600">{fehler}</p>}
                        <button
                          onClick={() => senden(aktuell.id)}
                          disabled={sendet || (!text.trim() && !datei)}
                          className="w-full bg-navy text-white text-sm font-semibold
                                     py-3 rounded-xl flex items-center justify-center
                                     gap-2 disabled:opacity-40">
                          {sendet ? <Loader2 size={15} className="animate-spin" />
                            : datei ? <Send size={15} /> : <MessageSquare size={15} />}
                          {datei ? 'Einreichen' : 'Senden'}
                        </button>
                        <p className="text-xs text-gray-400 text-center">
                          Ein Foto der Bescheinigung genügt — es muss lesbar sein.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
