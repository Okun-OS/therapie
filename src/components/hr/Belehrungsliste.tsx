'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Loader2, Plus, X, Upload, Send, Bell, Archive, RotateCw, Trash2,
  FileText, CheckCircle2, AlertTriangle, Fingerprint,
} from 'lucide-react'

/**
 * §150 Belehrungen aus Sicht des Betriebs.
 *
 * DIE LISTE BEANTWORTET EINE FRAGE: WER FEHLT NOCH?
 * Das ist die Frage, die ein Ordner mit Unterschriftenlisten nicht beantwortet
 * — und der eigentliche Grund für dieses Modul. Deshalb steht an jeder Runde
 * eine Zahl und darunter, wer offen ist.
 *
 * WARUM „VERTEILEN" EINEN EIGENEN, SCHWEREN KNOPF HAT
 * Weil es der Punkt ohne Rückweg ist: Ab da ist der Inhalt festgeschrieben,
 * und jede Änderung würde die schon abgegebenen Bestätigungen entwerten.
 */

interface Beleg {
  id: string
  employeeId: string
  personName: string
  zugestelltAm: string
  angesehenAm: string | null
  bestaetigtAm: string | null
  geraet: string | null
  wortlaut: string | null
  pruefsumme: string | null
  guete: { stufe: string; text: string }
}

interface Belehrung {
  id: string
  titel: string
  beschreibung: string | null
  dateiId: string | null
  dateiname: string | null
  pruefsumme: string | null
  bestaetigungstext: string
  status: string
  fristBis: string | null
  wiederholung: string | null
  oeffnenNoetig: boolean
  verteiltAm: string | null
  erstelltVonName: string | null
  stand: { gesamt: number; bestaetigt: number; offen: number; knapp: number; anteil: number }
}

const FARBE: Record<string, string> = {
  entwurf: 'bg-gray-100 text-gray-600',
  verteilt: 'bg-teal-50 text-teal-700',
  geschlossen: 'bg-gray-100 text-gray-400',
}

const GUETE_FARBE: Record<string, string> = {
  belegt: 'text-teal-700',
  knapp: 'text-amber-700',
  fehlt: 'text-gray-400',
}

export function Belehrungsliste() {
  const [alle, setAlle] = useState<Belehrung[]>([])
  const [staende, setStaende] = useState<Record<string, string>>({})
  const [wiederholungen, setWiederholungen] = useState<Record<string, string>>({})
  const [standardtext, setStandardtext] = useState('')
  const [laden, setLaden] = useState(true)
  const [offen, setOffen] = useState<string | null>(null)
  const [belege, setBelege] = useState<Beleg[]>([])
  const [neu, setNeu] = useState<null | {
    titel: string; beschreibung: string; bestaetigungstext: string
    fristBis: string; wiederholung: string; oeffnenNoetig: boolean
  }>(null)
  const [datei, setDatei] = useState<File | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [fehlt, setFehlt] = useState<string[]>([])
  const [meldung, setMeldung] = useState<string | null>(null)
  const [arbeitet, setArbeitet] = useState(false)
  const dateiFeld = useRef<HTMLInputElement>(null)

  const holen = useCallback(async () => {
    const d = await fetch('/api/belehrungen').then(r => r.json()).catch(() => ({}))
    setAlle(d.belehrungen ?? [])
    setStaende(d.staende ?? {})
    setWiederholungen(d.wiederholungen ?? {})
    setStandardtext(d.standardtext ?? '')
    setLaden(false)
  }, [])

  useEffect(() => { holen() }, [holen])

  const oeffnen = useCallback(async (id: string) => {
    setOffen(id); setFehler(null); setFehlt([])
    const d = await fetch(`/api/belehrungen/${id}`).then(r => r.json()).catch(() => ({}))
    setBelege(d.belege ?? [])
    setFehlt(d.fehlt ?? [])
  }, [])

  async function anlegen() {
    if (!neu) return
    setArbeitet(true); setFehler(null); setMeldung(null)
    const form = new FormData()
    form.set('titel', neu.titel)
    form.set('beschreibung', neu.beschreibung)
    form.set('bestaetigungstext', neu.bestaetigungstext)
    if (neu.fristBis) form.set('fristBis', neu.fristBis)
    if (neu.wiederholung) form.set('wiederholung', neu.wiederholung)
    form.set('oeffnenNoetig', String(neu.oeffnenNoetig))
    if (datei) form.set('datei', datei)

    const res = await fetch('/api/belehrungen', { method: 'POST', body: form })
    const d = await res.json().catch(() => ({}))
    setArbeitet(false)
    if (!res.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
    setNeu(null); setDatei(null)
    if (dateiFeld.current) dateiFeld.current.value = ''
    await holen()
    if (d.belehrung?.id) oeffnen(d.belehrung.id)
  }

  async function aktion(id: string, was: string) {
    setArbeitet(true); setFehler(null); setFehlt([]); setMeldung(null)
    const res = await fetch(`/api/belehrungen/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktion: was }),
    })
    const d = await res.json().catch(() => ({}))
    setArbeitet(false)
    if (!res.ok) {
      setFehler(d.error ?? 'Das hat nicht geklappt.')
      setFehlt(d.fehlt ?? [])
      return
    }
    if (was === 'verteilen') setMeldung(`An ${d.verteilt} Personen verteilt.`)
    if (was === 'erinnern') {
      setMeldung(d.erinnert > 0
        ? `${d.erinnert} erinnert.` : (d.hinweis ?? 'Es ist niemand mehr offen.'))
    }
    if (was === 'wiederholen') setMeldung('Neue Runde als Entwurf angelegt.')
    await holen()
    if (was === 'wiederholen' && d.belehrung?.id) oeffnen(d.belehrung.id)
    else oeffnen(id)
  }

  async function loeschen(id: string) {
    const res = await fetch(`/api/belehrungen/${id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
    setOffen(null); holen()
  }

  if (laden) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-gray-300" />
      </div>
    )
  }

  const aktuell = alle.find(b => b.id === offen) ?? null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-500 max-w-xl">
          Einmal hochladen, an alle verteilen, per Klick bestätigen lassen. Der
          Beleg hält Name, Wortlaut und Fingerabdruck des Dokuments fest — kein
          Ausdrucken, kein Einsammeln.
        </p>
        <button
          onClick={() => setNeu({
            titel: '', beschreibung: '', bestaetigungstext: standardtext,
            fristBis: '', wiederholung: '', oeffnenNoetig: true,
          })}
          className="flex items-center gap-1.5 bg-navy text-white text-xs
                     font-semibold px-3.5 py-2 rounded-lg shrink-0">
          <Plus size={14} /> Belehrung anlegen
        </button>
      </div>

      {meldung && (
        <p className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3
                      text-sm text-teal-800">{meldung}</p>
      )}
      {fehler && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700 font-medium">{fehler}</p>
          {fehlt.length > 0 && (
            <ul className="mt-2 space-y-1">
              {fehlt.map((f, i) => (
                <li key={i} className="text-sm text-red-600 flex gap-2">
                  <span>•</span><span>{f}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {neu && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-navy">Neue Belehrung</h3>
            <button onClick={() => { setNeu(null); setDatei(null) }}
              className="text-gray-400" aria-label="Schließen"><X size={18} /></button>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500">Titel *</span>
            <input value={neu.titel}
              onChange={e => setNeu(n => n && ({ ...n, titel: e.target.value }))}
              placeholder="Hygienebelehrung September"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </label>

          <div>
            <span className="text-xs font-semibold text-gray-500">Dokument *</span>
            <input ref={dateiFeld} type="file" className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
              onChange={e => setDatei(e.target.files?.[0] ?? null)} />
            {datei ? (
              <div className="mt-1 flex items-center gap-2 text-sm bg-gray-50
                              border border-gray-200 rounded-lg px-3 py-2">
                <FileText size={14} className="text-gray-400" />
                <span className="flex-1 truncate">{datei.name}</span>
                <button onClick={() => setDatei(null)} className="text-gray-400"
                  aria-label="Entfernen"><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => dateiFeld.current?.click()}
                className="mt-1 w-full flex items-center justify-center gap-2 text-sm
                           font-medium text-gray-600 border border-dashed
                           border-gray-300 rounded-lg py-2.5">
                <Upload size={15} /> PDF hochladen
              </button>
            )}
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500">Hinweis dazu</span>
            <textarea rows={2} value={neu.beschreibung}
              onChange={e => setNeu(n => n && ({ ...n, beschreibung: e.target.value }))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500">
              Der Satz, den die Leute bestätigen *
            </span>
            <textarea rows={3} value={neu.bestaetigungstext}
              onChange={e => setNeu(n => n && ({ ...n, bestaetigungstext: e.target.value }))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <span className="text-xs text-gray-400">
              Genau dieser Wortlaut steht später in jedem Beleg. Nach dem
              Verteilen lässt er sich nicht mehr ändern.
            </span>
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Bis wann</span>
              <input type="date" value={neu.fristBis}
                onChange={e => setNeu(n => n && ({ ...n, fristBis: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Wiederholt sich</span>
              <select value={neu.wiederholung}
                onChange={e => setNeu(n => n && ({ ...n, wiederholung: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">einmalig</option>
                {Object.entries(wiederholungen).map(([k, t]) => (
                  <option key={k} value={k}>{t}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-start gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" checked={neu.oeffnenNoetig} className="mt-0.5"
              onChange={e => setNeu(n => n && ({ ...n, oeffnenNoetig: e.target.checked }))} />
            <span>
              Das Dokument muss geöffnet werden, bevor bestätigt werden kann
              <span className="block text-xs text-gray-400">
                Empfohlen. Ein Klick ohne geöffneten Inhalt ist als Nachweis
                wenig wert — und man sieht es später im Beleg.
              </span>
            </span>
          </label>

          <button onClick={anlegen} disabled={arbeitet || !neu.titel || !datei}
            className="bg-teal-600 text-white text-sm font-semibold px-5 py-2.5
                       rounded-xl flex items-center gap-2 disabled:opacity-50">
            {arbeitet && <Loader2 size={14} className="animate-spin" />}
            Als Entwurf anlegen
          </button>
        </div>
      )}

      <ul className="space-y-2.5">
        {alle.map(b => (
          <li key={b.id} className="bg-white border border-gray-200 rounded-2xl">
            <button onClick={() => (offen === b.id ? setOffen(null) : oeffnen(b.id))}
              className="w-full text-left p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-navy">{b.titel}</h3>
                    <span className={`text-[11px] font-semibold px-2 py-0.5
                                      rounded-full ${FARBE[b.status]}`}>
                      {staende[b.status] ?? b.status}
                    </span>
                    {b.wiederholung && (
                      <span className="text-[11px] text-gray-400">
                        {wiederholungen[b.wiederholung]}
                      </span>
                    )}
                  </div>
                  {b.status !== 'entwurf' && (
                    <p className="text-sm text-gray-500 mt-1">
                      {b.stand.bestaetigt} von {b.stand.gesamt} bestätigt
                      {b.stand.offen > 0 && ` · ${b.stand.offen} offen`}
                      {b.stand.knapp > 0 && ` · ${b.stand.knapp} dünn belegt`}
                    </p>
                  )}
                </div>
                {b.status !== 'entwurf' && (
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-navy tabular-nums">
                      {b.stand.anteil}%
                    </p>
                  </div>
                )}
              </div>
              {b.status !== 'entwurf' && b.stand.gesamt > 0 && (
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full"
                    style={{ width: `${b.stand.anteil}%` }} />
                </div>
              )}
            </button>

            {offen === b.id && aktuell && (
              <div className="border-t border-gray-100 p-4 space-y-4">
                {aktuell.beschreibung && (
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {aktuell.beschreibung}
                  </p>
                )}

                <div className="bg-gray-50 rounded-xl p-3.5 space-y-2">
                  <p className="text-sm text-gray-700 italic">
                    „{aktuell.bestaetigungstext}“
                  </p>
                  {aktuell.dateiId && (
                    <div className="flex flex-wrap items-center gap-3">
                      <a href={`/api/belehrungen/${aktuell.id}/dokument`}
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs
                                   font-semibold text-teal-700">
                        <FileText size={13} /> {aktuell.dateiname}
                      </a>
                      {aktuell.pruefsumme && (
                        <span className="inline-flex items-center gap-1.5 text-[11px]
                                         text-gray-400 font-mono"
                          title={aktuell.pruefsumme}>
                          <Fingerprint size={12} />
                          {aktuell.pruefsumme.slice(0, 8)}…{aktuell.pruefsumme.slice(-4)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {aktuell.status === 'entwurf' && (
                    <>
                      <button onClick={() => aktion(aktuell.id, 'verteilen')}
                        disabled={arbeitet}
                        className="flex items-center gap-1.5 text-xs font-semibold
                                   bg-teal-600 text-white px-4 py-2 rounded-lg
                                   disabled:opacity-50">
                        <Send size={13} /> An alle verteilen
                      </button>
                      <button onClick={() => loeschen(aktuell.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold
                                   text-gray-400 px-3 py-2 rounded-lg hover:text-red-600">
                        <Trash2 size={13} /> Löschen
                      </button>
                    </>
                  )}
                  {aktuell.status === 'verteilt' && (
                    <>
                      <button onClick={() => aktion(aktuell.id, 'erinnern')}
                        disabled={arbeitet}
                        className="flex items-center gap-1.5 text-xs font-semibold
                                   bg-amber-50 text-amber-800 px-4 py-2 rounded-lg
                                   disabled:opacity-50">
                        <Bell size={13} /> Offene erinnern
                      </button>
                      <button onClick={() => aktion(aktuell.id, 'schliessen')}
                        disabled={arbeitet}
                        className="flex items-center gap-1.5 text-xs font-semibold
                                   bg-gray-100 px-4 py-2 rounded-lg disabled:opacity-50">
                        <Archive size={13} /> Runde schließen
                      </button>
                    </>
                  )}
                  {aktuell.status !== 'entwurf' && (
                    <button onClick={() => aktion(aktuell.id, 'wiederholen')}
                      disabled={arbeitet}
                      className="flex items-center gap-1.5 text-xs font-semibold
                                 bg-gray-100 px-4 py-2 rounded-lg disabled:opacity-50">
                      <RotateCw size={13} /> Neue Runde
                    </button>
                  )}
                </div>

                {aktuell.status === 'entwurf' && (
                  <p className="text-xs text-gray-400">
                    Mit dem Verteilen wird der Inhalt festgeschrieben. Ließe er
                    sich danach austauschen, wäre jede Bestätigung wertlos.
                  </p>
                )}

                {belege.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase
                                   tracking-wide">
                      Wer hat bestätigt
                    </h4>
                    <ul className="mt-2 divide-y divide-gray-50">
                      {belege.map(x => (
                        <li key={x.id}
                          className="flex items-start justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-navy truncate">
                              {x.personName}
                            </p>
                            <p className={`text-xs ${GUETE_FARBE[x.guete.stufe]}`}>
                              {x.guete.text}
                              {x.geraet && x.bestaetigtAm ? ` · ${x.geraet}` : ''}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            {x.bestaetigtAm ? (
                              <span className="inline-flex items-center gap-1.5 text-xs
                                               text-gray-500 tabular-nums">
                                {x.guete.stufe === 'knapp'
                                  ? <AlertTriangle size={12} className="text-amber-600" />
                                  : <CheckCircle2 size={12} className="text-teal-600" />}
                                {new Date(x.bestaetigtAm).toLocaleString('de-DE', {
                                  day: '2-digit', month: '2-digit',
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">offen</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {alle.length === 0 && !neu && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
          <p className="text-sm text-gray-600">
            Noch keine Belehrung angelegt. Lade die Seiten hoch, die sonst
            ausgedruckt und herumgereicht werden — den Rest macht das System.
          </p>
        </div>
      )}
    </div>
  )
}
