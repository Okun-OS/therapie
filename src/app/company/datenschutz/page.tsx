'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, Lock, Trash2, FileDown, AlertTriangle, Check, Search } from 'lucide-react'

/**
 * §128 Datenschutz: Auskunft geben und löschen.
 *
 * Der wichtigste Teil dieser Seite ist nicht der Löschknopf, sondern die
 * Vorschau darüber. Sie zeigt vor jeder Löschung, was verschwindet und was
 * bleiben MUSS — Lohnunterlagen sechs Jahre, Belege zehn, Arbeitszeiten zwei.
 * Wer das nicht sieht, löscht irgendwann etwas, das er nicht löschen darf, und
 * merkt es erst bei der Betriebsprüfung.
 */

interface Mitarbeiter {
  id: string
  name: string
  active: boolean
  locationId?: string | null
}

interface Befund {
  id: string
  bezeichnung: string
  beschreibung: string
  behandlung: 'loeschen' | 'anonymisieren' | 'sperren'
  anzahl: number
  fristJahre: number
  grundlage?: string
  begruendung: string
  aufbewahrungBis: string | null
  frei: boolean
}

interface Vorgang {
  id: string
  employeeId: string
  personName: string
  art: string
  angestossenVonName: string | null
  createdAt: string
}

interface Pruefung {
  employeeId: string
  name: string
  ausgetretenAm: string | null
  gesperrtSeit: string | null
  befunde: Befund[]
  hindernisse: string[]
  restlosAb: string | null
  summe: { geloescht: number; anonymisiert: number; gesperrt: number }
  vorgaenge: { id: string; art: string; angestossenVonName: string | null; createdAt: string }[]
}

const datum = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('.') : ''

export default function Datenschutz() {
  const [leute, setLeute] = useState<Mitarbeiter[]>([])
  const [suche, setSuche] = useState('')
  const [gewaehlt, setGewaehlt] = useState<Mitarbeiter | null>(null)
  const [pruefung, setPruefung] = useState<Pruefung | null>(null)
  const [laedt, setLaedt] = useState(false)
  const [arbeitet, setArbeitet] = useState(false)
  const [fehler, setFehler] = useState('')
  const [erfolg, setErfolg] = useState('')
  const [sicherheitsfrage, setSicherheitsfrage] = useState(false)
  const [tippfeld, setTippfeld] = useState('')
  const [verlauf, setVerlauf] = useState<Vorgang[]>([])

  const verlaufLaden = useCallback(() => {
    fetch('/api/dsgvo/loeschung')
      .then(r => r.json())
      .then(d => setVerlauf(d.vorgaenge ?? []))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    fetch('/api/employees')
      .then(r => r.json())
      .then(d => setLeute(d.employees ?? []))
      .catch(() => setFehler('Mitarbeiter konnten nicht geladen werden'))
    verlaufLaden()
  }, [verlaufLaden])

  const pruefen = useCallback(async (m: Mitarbeiter) => {
    setGewaehlt(m); setPruefung(null); setFehler(''); setErfolg('')
    setSicherheitsfrage(false); setTippfeld('')
    setLaedt(true)
    try {
      const res = await fetch(`/api/dsgvo/loeschung?employeeId=${m.id}`)
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFehler(d.error ?? 'Vorschau fehlgeschlagen'); return }
      setPruefung(d)
    } catch { setFehler('Vorschau fehlgeschlagen') }
    finally { setLaedt(false) }
  }, [])

  async function loeschen() {
    if (!gewaehlt) return
    setArbeitet(true); setFehler(''); setErfolg('')
    try {
      const res = await fetch('/api/dsgvo/loeschung', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: gewaehlt.id, bestaetigt: true }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFehler(d.error ?? 'Löschung fehlgeschlagen'); return }
      setErfolg(
        d.bericht?.person === 'geloescht'
          ? 'Alle Daten wurden entfernt. Es bestanden keine Aufbewahrungspflichten mehr.'
          : 'Gelöscht. Was aufbewahrt werden muss, ist jetzt gesperrt — der Löschbericht sagt, was und wie lange.',
      )
      setSicherheitsfrage(false); setTippfeld('')
      await pruefen(gewaehlt)
      verlaufLaden()
    } catch { setFehler('Löschung fehlgeschlagen') }
    finally { setArbeitet(false) }
  }

  const gefiltert = leute
    .filter(m => m.name.toLowerCase().includes(suche.toLowerCase()))
    .slice(0, 60)

  const bereit = pruefung && pruefung.hindernisse.length === 0
  // §128 Groß-/Kleinschreibung und doppelte Leerzeichen sollen niemanden
  // aufhalten — die Sicherung soll vor Versehen schützen, nicht vor Tippfehlern.
  const normiert = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase()
  const richtigGetippt = gewaehlt ? normiert(tippfeld) === normiert(gewaehlt.name) : false

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy flex items-center gap-2">
          <Shield size={20} className="text-teal-600" /> Datenschutz
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Auskunft geben, was über eine Person gespeichert ist, und ihre Daten nach dem
          Austritt löschen. Was das Steuer- und Sozialrecht aufzubewahren verlangt, wird
          dabei nicht gelöscht, sondern gesperrt — die Vorschau zeigt vorher, was bleibt.
        </p>
      </div>

      {fehler && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">{fehler}</p>
        </div>
      )}
      {erfolg && (
        <div className="flex items-start gap-2 rounded-2xl border border-teal-200 bg-teal-50 p-3">
          <Check size={16} className="text-teal-600 shrink-0 mt-0.5" />
          <p className="text-xs text-teal-900">{erfolg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* ── Personen ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-3 space-y-2 h-fit">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              value={suche}
              onChange={e => setSuche(e.target.value)}
              placeholder="Person suchen"
              className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-2.5 py-1.5" />
          </div>
          <div className="max-h-[60vh] overflow-y-auto space-y-0.5">
            {gefiltert.map(m => (
              <button
                key={m.id}
                onClick={() => pruefen(m)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-sm ${
                  gewaehlt?.id === m.id ? 'bg-teal-50 text-teal-900 font-semibold' : 'hover:bg-gray-50'
                }`}>
                {m.name}
                {!m.active && <span className="text-[10px] text-gray-400 ml-1.5">inaktiv</span>}
              </button>
            ))}
            {gefiltert.length === 0 && (
              <p className="text-xs text-gray-400 px-2.5 py-3">Niemand gefunden.</p>
            )}
          </div>
        </div>

        {/* ── Befund ──────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {!gewaehlt && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <p className="text-sm text-gray-400">
                Wählen Sie links eine Person, um zu sehen, welche Daten über sie gespeichert sind.
              </p>
            </div>
          )}

          {laedt && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-teal-500 rounded-full animate-spin" />
            </div>
          )}

          {gewaehlt && pruefung && !laedt && (
            <>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy">{pruefung.name}</p>
                    <p className="text-xs text-gray-400">
                      {pruefung.ausgetretenAm
                        ? `ausgetreten am ${datum(pruefung.ausgetretenAm)}`
                        : 'kein Austrittsdatum hinterlegt'}
                      {pruefung.gesperrtSeit && ` · gesperrt seit ${datum(pruefung.gesperrtSeit)}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`/api/dsgvo/auskunft?employeeId=${pruefung.employeeId}&format=pdf`}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-gray-600 border border-gray-200 hover:bg-gray-50">
                      <FileDown size={13} /> Auskunft (PDF)
                    </a>
                    <a
                      href={`/api/dsgvo/auskunft?employeeId=${pruefung.employeeId}`}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-gray-600 border border-gray-200 hover:bg-gray-50">
                      <FileDown size={13} /> Daten (JSON)
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                  <span>{pruefung.summe.geloescht} werden gelöscht</span>
                  <span className="text-gray-300">·</span>
                  <span>{pruefung.summe.anonymisiert} werden anonymisiert</span>
                  <span className="text-gray-300">·</span>
                  <span className="font-semibold text-navy">
                    {pruefung.summe.gesperrt} bleiben gesperrt
                  </span>
                  {pruefung.restlosAb && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>restlos löschbar ab {datum(pruefung.restlosAb)}</span>
                    </>
                  )}
                </div>
              </div>

              {pruefung.hindernisse.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                  {pruefung.hindernisse.map((h, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-900">{h}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
                {pruefung.befunde.map(b => (
                  <div key={b.id} className="p-4 space-y-1">
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-navy">{b.bezeichnung}</p>
                        <p className="text-xs text-gray-400">{b.beschreibung}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-navy">
                          {b.anzahl} {b.anzahl === 1 ? 'Eintrag' : 'Einträge'}
                        </p>
                        <p className={`text-[11px] font-semibold ${
                          b.behandlung === 'sperren' && !b.frei ? 'text-amber-700' : 'text-gray-400'
                        }`}>
                          {b.behandlung === 'anonymisieren' ? 'wird anonymisiert'
                            : b.frei ? 'wird gelöscht' : 'bleibt gesperrt'}
                        </p>
                      </div>
                    </div>
                    {b.behandlung === 'sperren' && !b.frei && (
                      <div className="flex items-start gap-2 pt-1">
                        <Lock size={12} className="text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-gray-500">
                          {b.begruendung}
                          {b.aufbewahrungBis && ` Löschbar nach dem ${datum(b.aufbewahrungBis)}.`}
                          {b.grundlage && ` (${b.grundlage})`}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* ── Löschen ───────────────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                <p className="text-sm font-semibold text-navy">Daten löschen</p>
                <p className="text-xs text-gray-500">
                  Die Löschung lässt sich nicht rückgängig machen. Was gelöscht wird, ist oben
                  aufgeführt; was bleiben muss, bleibt gesperrt und wird von selbst entfernt,
                  sobald die Frist abgelaufen ist. Ein Löschbericht wird erzeugt und aufbewahrt.
                </p>

                {!sicherheitsfrage ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => setSicherheitsfrage(true)}
                      disabled={!bereit}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed">
                      <Trash2 size={13} /> Löschung vorbereiten
                    </button>
                    {/*
                      §132 Ein Knopf, der nichts tut, ist schlimmer als keiner:
                      man drückt ihn, nichts geschieht, und man weiß nicht warum.
                      Hier steht der Grund direkt darunter.
                    */}
                    {!bereit && pruefung.hindernisse.length > 0 && (
                      <p className="text-xs text-amber-700">
                        Noch nicht möglich: {pruefung.hindernisse.join(' ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs text-gray-600">
                      Tippen Sie zur Bestätigung den vollständigen Namen ein:
                      {' '}<span className="font-semibold text-navy">{gewaehlt.name}</span>
                    </label>
                    <input
                      value={tippfeld}
                      onChange={e => setTippfeld(e.target.value)}
                      placeholder={gewaehlt.name}
                      className="w-full sm:w-80 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
                    <div className="flex gap-2">
                      <button
                        onClick={loeschen}
                        disabled={!richtigGetippt || arbeitet}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed">
                        <Trash2 size={13} /> {arbeitet ? 'Läuft …' : 'Jetzt löschen'}
                      </button>
                      <button
                        onClick={() => { setSicherheitsfrage(false); setTippfeld('') }}
                        className="text-xs font-semibold px-3 py-2 rounded-xl text-gray-600 border border-gray-200 hover:bg-gray-50">
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {pruefung.vorgaenge.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                  <p className="text-sm font-semibold text-navy">Bisherige Löschungen</p>
                  {pruefung.vorgaenge.map(v => (
                    <div key={v.id} className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{datum(v.createdAt)}</span>
                      <span>{v.art === 'aufraeumen' ? 'Fristablauf' : 'Löschung'}</span>
                      <span className="text-gray-400">{v.angestossenVonName ?? ''}</span>
                    </div>
                  ))}
                  <a
                    href={`/api/dsgvo/loeschung?employeeId=${pruefung.employeeId}&format=pdf`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-gray-600 border border-gray-200 hover:bg-gray-50">
                    <FileDown size={13} /> Löschbericht (PDF)
                  </a>
                </div>
              )}
            </>
          )}

          {/*
            Der Blick des Datenschutzbeauftragten: Wurde überhaupt gelöscht?
            Diese Liste bleibt auch dann bestehen, wenn es die Person längst
            nicht mehr gibt — sonst ließe sich die vollständige Löschung, also
            genau der Idealfall, hinterher nicht mehr nachweisen.
          */}
          {verlauf.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
              <p className="text-sm font-semibold text-navy">Alle Löschungen im Unternehmen</p>
              <p className="text-xs text-gray-400">
                Nachweis gegenüber der Aufsichtsbehörde (Art.5 Abs.2 DSGVO). Bleibt
                erhalten, auch wenn zur Person selbst nichts mehr gespeichert ist.
              </p>
              <div className="divide-y divide-gray-100">
                {verlauf.slice(0, 25).map(v => (
                  <div key={v.id} className="flex items-center gap-3 py-2 text-xs flex-wrap">
                    <span className="text-gray-400 w-20 shrink-0">{datum(v.createdAt)}</span>
                    <span className="font-semibold text-navy flex-1 min-w-0">{v.personName}</span>
                    <span className="text-gray-500">
                      {v.art === 'aufraeumen' ? 'Fristablauf' : 'Löschung'}
                    </span>
                    <span className="text-gray-400">{v.angestossenVonName ?? ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
