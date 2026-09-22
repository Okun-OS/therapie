'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, Plus, X, Paperclip, Check, HelpCircle, Bell, Undo2, Send,
  AlertTriangle, Users2,
} from 'lucide-react'

/**
 * §149 Was der Betrieb angefordert hat — und was zurückkam.
 *
 * DIE LISTE BEANTWORTET EINE FRAGE: WO LIEGT DER BALL?
 * Deshalb sind die Rückfragen und das Offene oben, das Eingereichte darunter
 * und das Erledigte am Ende. Eine nach Datum sortierte Liste sähe ordentlicher
 * aus und sagte nichts.
 *
 * WARUM „ABNEHMEN" DIE FRIST ERFÜLLT
 * Weil sonst zwei Wahrheiten entstünden: eine abgenommene Bescheinigung und
 * eine Frist, die weiter auf Rot steht. Das passiert im Server, nicht hier —
 * hier steht nur, dass es passiert ist.
 */

interface Beitrag {
  id: string; seite: string; absenderName: string; text: string
  dateiId: string | null; dateiname: string | null; createdAt: string
}

interface Anforderung {
  id: string
  employeeId: string
  personName: string | null
  titel: string
  hinweis: string | null
  fristBis: string | null
  stand: string
  standText: string
  hinweisText: string
  ueberfaellig: boolean
  tageBis: number | null
  angefordertVonName: string | null
  erledigtVon: string | null
  createdAt: string
}

interface Person { id: string; name: string }

const FARBE: Record<string, string> = {
  offen: 'bg-amber-50 text-amber-700',
  rueckfrage: 'bg-red-50 text-red-700',
  eingereicht: 'bg-blue-50 text-blue-700',
  erledigt: 'bg-teal-50 text-teal-700',
  zurueckgezogen: 'bg-gray-100 text-gray-400',
}

export function Anforderungsliste() {
  const [alle, setAlle] = useState<Anforderung[]>([])
  const [personen, setPersonen] = useState<Person[]>([])
  const [laden, setLaden] = useState(true)
  const [offen, setOffen] = useState<string | null>(null)
  const [beitraege, setBeitraege] = useState<Beitrag[]>([])
  const [neu, setNeu] = useState<null | {
    titel: string; hinweis: string; fristBis: string; ids: string[]
  }>(null)
  const [antwort, setAntwort] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [arbeitet, setArbeitet] = useState(false)
  const [zeigeErledigt, setZeigeErledigt] = useState(false)

  const holen = useCallback(async () => {
    const d = await fetch('/api/anforderungen').then(r => r.json()).catch(() => ({}))
    setAlle(d.anforderungen ?? [])
    setLaden(false)
  }, [])

  useEffect(() => {
    holen()
    fetch('/api/employees').then(r => r.json())
      .then(d => setPersonen((d.employees ?? [])
        .filter((e: { active?: boolean }) => e.active !== false)
        .map((e: Person) => ({ id: e.id, name: e.name }))))
      .catch(() => undefined)
  }, [holen])

  const oeffnen = useCallback(async (id: string) => {
    setOffen(id); setFehler(null); setAntwort('')
    const d = await fetch(`/api/anforderungen/${id}`).then(r => r.json()).catch(() => ({}))
    setBeitraege(d.beitraege ?? [])
  }, [])

  async function anfordern() {
    if (!neu) return
    setArbeitet(true); setFehler(null); setMeldung(null)
    const res = await fetch('/api/anforderungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titel: neu.titel, hinweis: neu.hinweis,
        fristBis: neu.fristBis || null, employeeIds: neu.ids,
      }),
    })
    const d = await res.json().catch(() => ({}))
    setArbeitet(false)
    if (!res.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
    setNeu(null)
    setMeldung(
      `${d.angelegt} angefordert`
      + (d.uebersprungen > 0
        ? `, ${d.uebersprungen} übersprungen — dort lief schon eine offene Anforderung.`
        : '.'),
    )
    holen()
  }

  async function standSetzen(id: string, status: string, notiz?: string) {
    setArbeitet(true); setFehler(null)
    const res = await fetch(`/api/anforderungen/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notiz }),
    })
    const d = await res.json().catch(() => ({}))
    setArbeitet(false)
    if (!res.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
    // §151 Immer eine Rückmeldung, nicht nur wenn eine Frist dranhing.
    //
    // Vorher stand hier nur die Meldung für den Fall mit Frist. Bei allen
    // anderen verschwand der Eintrag nach dem Klick wortlos aus der Liste —
    // er rutschte unter „erledigt", das zugeklappt ist. Aus Sicht des
    // Anwenders passierte damit nichts, und der Zweifel führt zum zweiten
    // Klick auf einen Knopf, den es nicht mehr gibt.
    setMeldung(
      status === 'erledigt'
        ? (d.fristErfuellt
          ? 'Abgenommen — die Frist ist damit erfüllt.'
          : 'Abgenommen. Der Vorgang steht jetzt unter „erledigt".')
        : status === 'rueckfrage' ? 'Rückfrage verschickt.'
          : status === 'zurueckgezogen' ? 'Zurückgezogen.'
            : 'Gespeichert.',
    )
    setAntwort('')
    await holen()
    oeffnen(id)
  }

  async function schreiben(id: string) {
    if (!antwort.trim()) return
    setArbeitet(true); setFehler(null)
    const res = await fetch(`/api/anforderungen/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: antwort }),
    })
    const d = await res.json().catch(() => ({}))
    setArbeitet(false)
    if (!res.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
    setAntwort('')
    oeffnen(id)
  }

  async function erinnern(id: string) {
    setFehler(null); setMeldung(null)
    const res = await fetch('/api/anforderungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktion: 'erinnern', id }),
    })
    const d = await res.json().catch(() => ({}))
    setMeldung(d.erinnert > 0 ? 'Erinnerung verschickt.' : (d.hinweis ?? 'Nichts zu tun.'))
    holen()
  }

  if (laden) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-gray-300" />
      </div>
    )
  }

  const zuPruefen = alle.filter(a => a.stand === 'eingereicht')
  const laufend = alle.filter(a => ['offen', 'rueckfrage'].includes(a.stand))
  const fertig = alle.filter(a => ['erledigt', 'zurueckgezogen'].includes(a.stand))
  const aktuell = alle.find(a => a.id === offen) ?? null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {zuPruefen.length > 0
            ? `${zuPruefen.length} liegt zur Prüfung${zuPruefen.length === 1 ? '' : 'en'} bereit`
            : laufend.length > 0 ? `${laufend.length} offen`
              : 'Nichts offen.'}
        </p>
        <button
          onClick={() => setNeu({ titel: '', hinweis: '', fristBis: '', ids: [] })}
          className="flex items-center gap-1.5 bg-navy text-white text-xs
                     font-semibold px-3.5 py-2 rounded-lg">
          <Plus size={14} /> Nachweis anfordern
        </button>
      </div>

      {meldung && (
        <p className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3
                      text-sm text-teal-800">{meldung}</p>
      )}
      {fehler && (
        <p className="bg-red-50 border border-red-200 rounded-xl px-4 py-3
                      text-sm text-red-700">{fehler}</p>
      )}

      {neu && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-navy">Nachweis anfordern</h3>
            <button onClick={() => setNeu(null)} className="text-gray-400"
              aria-label="Schließen"><X size={18} /></button>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-gray-500">Was wird gebraucht? *</span>
            <input value={neu.titel}
              onChange={e => setNeu(n => n && ({ ...n, titel: e.target.value }))}
              placeholder="Erweitertes Führungszeugnis"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-500">Hinweis dazu</span>
            <textarea rows={3} value={neu.hinweis}
              onChange={e => setNeu(n => n && ({ ...n, hinweis: e.target.value }))}
              placeholder="Was genau gebraucht wird, wo man es bekommt, worauf zu achten ist."
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="block sm:w-56">
            <span className="text-xs font-semibold text-gray-500">Bis wann</span>
            <input type="date" value={neu.fristBis}
              onChange={e => setNeu(n => n && ({ ...n, fristBis: e.target.value }))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </label>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">
                Von wem? ({neu.ids.length} ausgewählt)
              </span>
              <button
                onClick={() => setNeu(n => n && ({
                  ...n,
                  ids: n.ids.length === personen.length ? [] : personen.map(p => p.id),
                }))}
                className="flex items-center gap-1.5 text-xs font-semibold text-teal-700">
                <Users2 size={13} />
                {neu.ids.length === personen.length ? 'Auswahl aufheben' : 'Alle Mitarbeiter'}
              </button>
            </div>
            <div className="mt-1.5 max-h-56 overflow-y-auto border border-gray-200
                            rounded-lg divide-y divide-gray-50">
              {personen.map(p => (
                <label key={p.id}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={neu.ids.includes(p.id)}
                    onChange={e => setNeu(n => n && ({
                      ...n,
                      ids: e.target.checked
                        ? [...n.ids, p.id] : n.ids.filter(x => x !== p.id),
                    }))} />
                  {p.name}
                </label>
              ))}
            </div>
          </div>

          <button onClick={anfordern} disabled={arbeitet || !neu.titel || !neu.ids.length}
            className="bg-teal-600 text-white text-sm font-semibold px-5 py-2.5
                       rounded-xl flex items-center gap-2 disabled:opacity-50">
            {arbeitet && <Loader2 size={14} className="animate-spin" />}
            Anfordern{neu.ids.length > 1 ? ` (${neu.ids.length} Personen)` : ''}
          </button>
        </div>
      )}

      {([
        ['Liegt zur Prüfung vor', zuPruefen],
        ['Läuft', laufend],
        ...(zeigeErledigt ? [['Erledigt', fertig] as const] : []),
      ] as const).filter(([, l]) => l.length > 0).map(([titel, liste]) => (
        <section key={titel}>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
            {titel}
          </h3>
          <ul className="mt-2 space-y-2">
            {liste.map(a => (
              <li key={a.id} className="bg-white border border-gray-200 rounded-2xl">
                <button onClick={() => (offen === a.id ? setOffen(null) : oeffnen(a.id))}
                  className="w-full text-left p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-navy truncate">
                        {a.personName ?? '—'}
                      </p>
                      <p className="text-sm text-gray-600">{a.titel}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{a.hinweisText}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-[11px] font-semibold px-2 py-0.5
                                        rounded-full ${FARBE[a.stand]}`}>
                        {a.standText}
                      </span>
                      {a.ueberfaellig && (
                        <span className="flex items-center gap-1 text-[11px]
                                         text-red-600 font-semibold">
                          <AlertTriangle size={11} />
                          {Math.abs(a.tageBis ?? 0)} Tage über
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {offen === a.id && aktuell && (
                  <div className="border-t border-gray-100 p-4 space-y-3">
                    <ul className="space-y-2.5">
                      {beitraege.map(b => (
                        <li key={b.id}
                          className={`text-sm rounded-xl px-3.5 py-2.5 max-w-[92%]
                                      ${b.seite === 'betrieb' ? 'bg-teal-50 ml-auto'
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
                              <Paperclip size={12} /> {b.dateiname} ansehen
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>

                    {['offen', 'eingereicht', 'rueckfrage'].includes(aktuell.stand) && (
                      <>
                        <textarea
                          rows={2} value={antwort}
                          onChange={e => setAntwort(e.target.value)}
                          placeholder="Antwort oder Rückfrage schreiben"
                          className="w-full border border-gray-200 rounded-xl px-3.5
                                     py-2.5 text-sm focus:border-teal-500
                                     focus:outline-none" />
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => standSetzen(aktuell.id, 'erledigt', antwort)}
                            disabled={arbeitet}
                            className="flex items-center gap-1.5 text-xs font-semibold
                                       bg-teal-600 text-white px-3.5 py-2 rounded-lg
                                       disabled:opacity-50">
                            <Check size={13} /> Abnehmen
                          </button>
                          {aktuell.stand === 'eingereicht' && (
                            <button
                              onClick={() => standSetzen(aktuell.id, 'rueckfrage', antwort)}
                              disabled={arbeitet}
                              className="flex items-center gap-1.5 text-xs font-semibold
                                         bg-amber-50 text-amber-800 px-3.5 py-2
                                         rounded-lg disabled:opacity-50">
                              <HelpCircle size={13} /> Nachfragen
                            </button>
                          )}
                          <button onClick={() => schreiben(aktuell.id)}
                            disabled={arbeitet || !antwort.trim()}
                            className="flex items-center gap-1.5 text-xs font-semibold
                                       bg-gray-100 px-3.5 py-2 rounded-lg
                                       disabled:opacity-40">
                            <Send size={13} /> Nur schreiben
                          </button>
                          {aktuell.stand === 'offen' && (
                            <button onClick={() => erinnern(aktuell.id)}
                              className="flex items-center gap-1.5 text-xs font-semibold
                                         text-gray-600 px-3.5 py-2 rounded-lg">
                              <Bell size={13} /> Erinnern
                            </button>
                          )}
                          <button
                            onClick={() => standSetzen(aktuell.id, 'zurueckgezogen', antwort)}
                            disabled={arbeitet}
                            className="flex items-center gap-1.5 text-xs font-semibold
                                       text-gray-400 px-3.5 py-2 rounded-lg
                                       hover:text-gray-700">
                            <Undo2 size={13} /> Zurückziehen
                          </button>
                        </div>
                        <p className="text-xs text-gray-400">
                          Abnehmen trägt die Frist als erfüllt ein — danach rechnet
                          das System das nächste Ablaufdatum selbst.
                        </p>
                      </>
                    )}
                    {aktuell.stand === 'erledigt' && aktuell.erledigtVon && (
                      <p className="text-xs text-gray-400">
                        Abgenommen von {aktuell.erledigtVon}.
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {fertig.length > 0 && (
        <button onClick={() => setZeigeErledigt(v => !v)}
          className="text-xs font-semibold text-gray-500">
          {zeigeErledigt ? 'Erledigte ausblenden' : `${fertig.length} erledigte anzeigen`}
        </button>
      )}
    </div>
  )
}
