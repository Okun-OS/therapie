'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, Plus, X, Mail, Paperclip, UserPlus, Trash2, CalendarClock, Send,
} from 'lucide-react'

/**
 * §148 Die Bewerber — die Pipeline und der einzelne Vorgang.
 *
 * WARUM DIE ABSAGE NICHT VERSTECKT IST
 * Weil sie der häufigste Schritt ist und weil eine Absage, die nie geschrieben
 * wird, für den Bewerber schlimmer ist als eine unfreundliche. Der Knopf steht
 * neben den anderen, und darüber lässt sich direkt schreiben.
 *
 * WARUM DIE ÜBERNAHME EIN FORMULAR ÖFFNET
 * Weil für einen Mitarbeiter Dinge gebraucht werden, die in keiner Bewerbung
 * stehen: Standort, Position, Wochenstunden. Sie hinterher nachzupflegen wäre
 * der sichere Weg zu Karteileichen.
 */

interface Datei { id: string; dateiname: string; groesse: number; mimeType: string }

interface Bewerbung {
  id: string
  stelleId: string | null
  stelleTitel: string | null
  locationId: string | null
  name: string
  email: string
  telefon: string | null
  nachricht: string | null
  quelle: string
  status: string
  statusAm: string
  gespraechAm: string | null
  gespraechOrt: string | null
  notiz: string | null
  employeeId: string | null
  loeschenAb: string | null
  createdAt: string
  dateien: Datei[]
}

interface Ereignis {
  id: string; art: string; text: string; vonName: string | null; createdAt: string
}

const SPALTEN = ['neu', 'gesichtet', 'gespraech', 'zusage', 'absage'] as const

const QUELLE_TEXT: Record<string, string> = {
  karriereseite: 'Karriereseite', eingepflegt: 'eingepflegt',
  empfehlung: 'Empfehlung', initiativ: 'Initiativ', boerse: 'Stellenbörse',
}

function datum(s: string | null): string {
  return s ? new Date(s).toLocaleDateString('de-DE') : '—'
}

export function Bewerberliste() {
  const [alle, setAlle] = useState<Bewerbung[]>([])
  const [staende, setStaende] = useState<Record<string, string>>({})
  const [laden, setLaden] = useState(true)
  const [offen, setOffen] = useState<string | null>(null)
  const [verlauf, setVerlauf] = useState<Ereignis[]>([])
  const [neu, setNeu] = useState<null | {
    name: string; email: string; telefon: string; nachricht: string
    stelleId: string; quelle: string
  }>(null)
  const [stellen, setStellen] = useState<{ id: string; titel: string }[]>([])
  const [standorte, setStandorte] = useState<{ id: string; name: string }[]>([])
  const [fehler, setFehler] = useState<string | null>(null)
  const [nachricht, setNachricht] = useState<null | { betreff: string; text: string }>(null)
  const [uebernahme, setUebernahme] = useState<null | {
    locationId: string; position: string; weeklyHours: string
  }>(null)
  const [arbeitet, setArbeitet] = useState(false)

  const holen = useCallback(async () => {
    const d = await fetch('/api/bewerbungen').then(r => r.json()).catch(() => ({}))
    setAlle(d.bewerbungen ?? [])
    setStaende(d.staende ?? {})
    setLaden(false)
  }, [])

  useEffect(() => {
    holen()
    fetch('/api/stellen').then(r => r.json())
      .then(d => setStellen((d.stellen ?? []).map(
        (s: { id: string; titel: string }) => ({ id: s.id, titel: s.titel }),
      )))
      .catch(() => undefined)
    fetch('/api/locations').then(r => r.json())
      .then(d => setStandorte((d.locations ?? []).map(
        (l: { id: string; name: string }) => ({ id: l.id, name: l.name }),
      )))
      .catch(() => undefined)
  }, [holen])

  const aktuell = alle.find(b => b.id === offen) ?? null

  const oeffnen = useCallback(async (id: string) => {
    setOffen(id); setFehler(null); setNachricht(null); setUebernahme(null)
    const d = await fetch(`/api/bewerbungen/${id}`).then(r => r.json()).catch(() => ({}))
    setVerlauf(d.verlauf ?? [])
  }, [])

  async function standSetzen(id: string, status: string) {
    setFehler(null)
    const res = await fetch('/api/bewerbungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
    await holen()
    if (offen === id) oeffnen(id)
  }

  async function anlegen() {
    if (!neu) return
    setArbeitet(true); setFehler(null)
    const res = await fetch('/api/bewerbungen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(neu),
    })
    const d = await res.json().catch(() => ({}))
    setArbeitet(false)
    if (!res.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
    setNeu(null); holen()
  }

  async function schicken(id: string) {
    if (!nachricht) return
    setArbeitet(true); setFehler(null)
    const res = await fetch(`/api/bewerbungen/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktion: 'nachricht', ...nachricht }),
    })
    const d = await res.json().catch(() => ({}))
    setArbeitet(false)
    if (!res.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
    setNachricht(null); oeffnen(id)
  }

  async function uebernehmen(id: string) {
    if (!uebernahme) return
    setArbeitet(true); setFehler(null)
    const res = await fetch(`/api/bewerbungen/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktion: 'uebernehmen', ...uebernahme }),
    })
    const d = await res.json().catch(() => ({}))
    setArbeitet(false)
    if (!res.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
    setUebernahme(null); await holen(); oeffnen(id)
  }

  async function loeschen(id: string) {
    const res = await fetch(`/api/bewerbungen/${id}`, { method: 'DELETE' })
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {alle.length === 0 ? 'Noch keine Bewerbung.'
            : `${alle.filter(b => !['absage', 'eingestellt'].includes(b.status)).length} `
              + `im Verfahren, ${alle.length} insgesamt`}
        </p>
        <button
          onClick={() => setNeu({
            name: '', email: '', telefon: '', nachricht: '',
            stelleId: '', quelle: 'eingepflegt',
          })}
          className="flex items-center gap-1.5 bg-navy text-white text-xs
                     font-semibold px-3.5 py-2 rounded-lg">
          <Plus size={14} /> Bewerber einpflegen
        </button>
      </div>

      {fehler && (
        <p className="bg-red-50 border border-red-200 rounded-xl px-4 py-3
                      text-sm text-red-700">{fehler}</p>
      )}

      {neu && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-navy">Bewerber einpflegen</h3>
            <button onClick={() => setNeu(null)} className="text-gray-400"
              aria-label="Schließen"><X size={18} /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Feld label="Name *" wert={neu.name}
              setzen={v => setNeu(n => n && ({ ...n, name: v }))} />
            <Feld label="E-Mail *" wert={neu.email}
              setzen={v => setNeu(n => n && ({ ...n, email: v }))} />
            <Feld label="Telefon" wert={neu.telefon}
              setzen={v => setNeu(n => n && ({ ...n, telefon: v }))} />
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Stelle</span>
              <select value={neu.stelleId}
                onChange={e => setNeu(n => n && ({ ...n, stelleId: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Initiativbewerbung</option>
                {stellen.map(s => <option key={s.id} value={s.id}>{s.titel}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Woher</span>
              <select value={neu.quelle}
                onChange={e => setNeu(n => n && ({ ...n, quelle: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['eingepflegt', 'empfehlung', 'initiativ', 'boerse'].map(q => (
                  <option key={q} value={q}>{QUELLE_TEXT[q]}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-gray-500">Notiz</span>
            <textarea rows={3} value={neu.nachricht}
              onChange={e => setNeu(n => n && ({ ...n, nachricht: e.target.value }))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </label>
          <button onClick={anlegen} disabled={arbeitet}
            className="bg-teal-600 text-white text-sm font-semibold px-5 py-2.5
                       rounded-xl flex items-center gap-2 disabled:opacity-60">
            {arbeitet && <Loader2 size={14} className="animate-spin" />} Anlegen
          </button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-5 sm:grid-cols-2">
        {SPALTEN.map(spalte => {
          const drin = alle.filter(b => b.status === spalte)
          return (
            <div key={spalte} className="min-w-0">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide
                             flex items-center gap-2">
                {staende[spalte] ?? spalte}
                <span className="text-gray-300">{drin.length}</span>
              </h3>
              <ul className="mt-2 space-y-2">
                {drin.map(b => (
                  <li key={b.id}>
                    <button
                      onClick={() => oeffnen(b.id)}
                      className={`w-full text-left bg-white border rounded-xl p-3
                                  ${offen === b.id ? 'border-teal-500' : 'border-gray-200'}`}>
                      <p className="font-semibold text-navy text-sm truncate">{b.name}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {b.stelleTitel ?? 'Initiativbewerbung'}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-400">
                        <span>{datum(b.createdAt)}</span>
                        {b.dateien.length > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Paperclip size={10} /> {b.dateien.length}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {alle.some(b => b.status === 'eingestellt') && (
        <p className="text-xs text-gray-400">
          {alle.filter(b => b.status === 'eingestellt').length} eingestellt —
          diese Bewerbungen bleiben bei der Personalakte.
        </p>
      )}

      {aktuell && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-navy text-lg">{aktuell.name}</h3>
              <p className="text-sm text-gray-500">
                {aktuell.stelleTitel ?? 'Initiativbewerbung'} ·{' '}
                {QUELLE_TEXT[aktuell.quelle] ?? aktuell.quelle} ·{' '}
                eingegangen {datum(aktuell.createdAt)}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <a href={`mailto:${aktuell.email}`} className="text-teal-700 underline">
                  {aktuell.email}
                </a>
                {aktuell.telefon && ` · ${aktuell.telefon}`}
              </p>
            </div>
            <button onClick={() => setOffen(null)} className="text-gray-400"
              aria-label="Schließen"><X size={18} /></button>
          </div>

          {aktuell.nachricht && (
            <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3.5
                          whitespace-pre-line leading-relaxed">{aktuell.nachricht}</p>
          )}

          {aktuell.dateien.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {aktuell.dateien.map(d => (
                <a key={d.id} href={`/api/bewerbungen/datei/${d.id}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium
                             border border-gray-200 rounded-lg px-3 py-2">
                  <Paperclip size={13} className="text-gray-400" />
                  {d.dateiname}
                  <span className="text-gray-400">
                    {(d.groesse / 1024).toFixed(0)} KB
                  </span>
                </a>
              ))}
            </div>
          )}

          {aktuell.loeschenAb && (
            <p className="text-xs text-gray-400">
              Wird am {datum(aktuell.loeschenAb)} gelöscht (§15 Abs.4 AGG).
            </p>
          )}

          {aktuell.status !== 'eingestellt' && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(staende)
                .filter(([k]) => k !== aktuell.status && k !== 'eingestellt')
                .map(([k, t]) => (
                  <button key={k} onClick={() => standSetzen(aktuell.id, k)}
                    className="text-xs font-semibold border border-gray-200
                               px-3 py-1.5 rounded-lg hover:border-teal-500">
                    {t}
                  </button>
                ))}
              <button
                onClick={() => setNachricht({
                  betreff: aktuell.stelleTitel
                    ? `Deine Bewerbung: ${aktuell.stelleTitel}`
                    : 'Deine Bewerbung',
                  text: `Hallo ${aktuell.name.split(' ')[0]},\n\n`,
                })}
                className="flex items-center gap-1.5 text-xs font-semibold
                           bg-gray-100 px-3 py-1.5 rounded-lg">
                <Mail size={13} /> Schreiben
              </button>
              <button
                onClick={() => setUebernahme({
                  locationId: aktuell.locationId ?? '',
                  position: aktuell.stelleTitel ?? '',
                  weeklyHours: '',
                })}
                className="flex items-center gap-1.5 text-xs font-semibold
                           bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg">
                <UserPlus size={13} /> Als Mitarbeiter übernehmen
              </button>
              <button onClick={() => loeschen(aktuell.id)}
                className="flex items-center gap-1.5 text-xs font-semibold
                           text-gray-400 px-3 py-1.5 rounded-lg hover:text-red-600">
                <Trash2 size={13} /> Daten löschen
              </button>
            </div>
          )}

          {nachricht && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <Feld label="Betreff" wert={nachricht.betreff}
                setzen={v => setNachricht(n => n && ({ ...n, betreff: v }))} />
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">Text</span>
                <textarea rows={7} value={nachricht.text}
                  onChange={e => setNachricht(n => n && ({ ...n, text: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </label>
              <div className="flex gap-2">
                <button onClick={() => schicken(aktuell.id)} disabled={arbeitet}
                  className="bg-teal-600 text-white text-sm font-semibold px-4 py-2
                             rounded-lg flex items-center gap-2 disabled:opacity-60">
                  {arbeitet ? <Loader2 size={14} className="animate-spin" />
                    : <Send size={14} />}
                  An {aktuell.email} schicken
                </button>
                <button onClick={() => setNachricht(null)}
                  className="text-sm text-gray-500 px-3">Abbrechen</button>
              </div>
            </div>
          )}

          {uebernahme && (
            <div className="border border-teal-200 bg-teal-50/40 rounded-xl p-4 space-y-3">
              <p className="text-sm text-gray-600">
                Es entsteht ein Mitarbeiterdatensatz samt Einladung ins Programm.
                Die Pflichtnachweise aus dem Katalog werden automatisch zugewiesen.
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-500">Standort *</span>
                  <select value={uebernahme.locationId}
                    onChange={e => setUebernahme(u => u && ({ ...u, locationId: e.target.value }))}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Bitte wählen</option>
                    {standorte.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <Feld label="Position *" wert={uebernahme.position}
                  setzen={v => setUebernahme(u => u && ({ ...u, position: v }))} />
                <Feld label="Wochenstunden *" wert={uebernahme.weeklyHours}
                  setzen={v => setUebernahme(u => u && ({ ...u, weeklyHours: v }))} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => uebernehmen(aktuell.id)} disabled={arbeitet}
                  className="bg-teal-600 text-white text-sm font-semibold px-4 py-2
                             rounded-lg flex items-center gap-2 disabled:opacity-60">
                  {arbeitet && <Loader2 size={14} className="animate-spin" />}
                  Übernehmen und einladen
                </button>
                <button onClick={() => setUebernahme(null)}
                  className="text-sm text-gray-500 px-3">Abbrechen</button>
              </div>
            </div>
          )}

          {verlauf.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide
                             flex items-center gap-1.5">
                <CalendarClock size={12} /> Verlauf
              </h4>
              <ul className="mt-2 space-y-1.5">
                {verlauf.map(e => (
                  <li key={e.id} className="text-xs text-gray-500 flex gap-2">
                    <span className="text-gray-300 shrink-0 tabular-nums">
                      {new Date(e.createdAt).toLocaleDateString('de-DE')}
                    </span>
                    <span>{e.text}{e.vonName ? ` — ${e.vonName}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Feld({ label, wert, setzen }: {
  label: string; wert: string; setzen: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <input value={wert} onChange={e => setzen(e.target.value)}
        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                   focus:border-teal-500 focus:outline-none" />
    </label>
  )
}
