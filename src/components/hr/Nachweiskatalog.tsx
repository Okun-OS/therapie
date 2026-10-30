'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, X, Loader2, FileCheck2, Power, Users2, Lock, ChevronDown,
} from 'lucide-react'

/**
 * §146 Der Katalog — was dieser Betrieb überhaupt führt.
 *
 * WARUM VORLAGEN UND TROTZDEM FREI
 * Beides. Wer eine Vorlage anklickt, hat in einer Minute einen brauchbaren
 * Stand und ändert danach alles, was nicht passt. Ein Betrieb, der nur ein
 * Führungszeugnis führt, legt genau einen Eintrag an.
 *
 * WAS BEIM ÜBERNEHMEN EINER VORLAGE NICHT PASSIERT
 * Vorhandenes wird nicht überschrieben. Wer seinen Abstand von zwei auf drei
 * Jahre gesetzt hat, soll ihn nicht durch einen zweiten Klick auf die Vorlage
 * wieder verlieren.
 *
 * WARUM MAN NICHTS LÖSCHT, SONDERN ABSCHALTET
 * An einer Art hängen die Einträge der Menschen, und darin stecken Dokumente
 * und Daten. Sie wegzuwerfen, weil jemand aufräumt, wäre ein stiller
 * Datenverlust.
 */

interface Art {
  id: string
  name: string
  gattung: string
  giltFuer: string
  giltFuerWerte: string[]
  faelligkeit: string
  abstandMonate: number | null
  vorwarnTage: number
  nachweisNoetig: boolean
  sichtbarkeit: string
  folge: string
  grundlage: string | null
  aktiv: boolean
}

interface Vorlage {
  schluessel: string
  name: string
  beschreibung: string
  eintraege: unknown[]
}

const LEER = {
  name: '', gattung: 'nachweis', giltFuer: 'alle', giltFuerWerte: [] as string[],
  faelligkeit: 'wiederkehrend', abstandMonate: 24, vorwarnTage: 56,
  nachweisNoetig: true, sichtbarkeit: 'leitung', folge: 'warnen', grundlage: '',
}

const GILT_TEXT: Record<string, string> = {
  alle: 'für alle',
  positionen: 'für bestimmte Positionen',
  qualifikationen: 'für bestimmte Qualifikationen',
  einzeln: 'einzeln zuweisen',
}

const FAELLIG_TEXT: Record<string, string> = {
  einmalig: 'einmalig, läuft nicht ab',
  einstellung: 'zur Einstellung',
  wiederkehrend: 'wiederkehrend',
  einstellung_und_wiederkehrend: 'zur Einstellung und wiederkehrend',
}

export function Nachweiskatalog() {
  const [arten, setArten] = useState<Art[]>([])
  const [vorlagen, setVorlagen] = useState<Vorlage[]>([])
  const [laedt, setLaedt] = useState(true)
  const [maske, setMaske] = useState(false)
  const [form, setForm] = useState({ ...LEER })
  const [bearbeitet, setBearbeitet] = useState<string | null>(null)
  const [arbeitet, setArbeitet] = useState(false)
  const [fehler, setFehler] = useState('')
  const [hinweis, setHinweis] = useState('')

  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/nachweisarten')
      const d = await r.json().catch(() => ({}))
      setArten(d.arten ?? [])
      setVorlagen(d.vorlagen ?? [])
    } catch { setFehler('Konnte nicht geladen werden') }
    finally { setLaedt(false) }
  }, [])

  useEffect(() => { laden() }, [laden])

  async function vorlageUebernehmen(schluessel: string) {
    setArbeitet(true); setFehler(''); setHinweis('')
    try {
      const r = await fetch('/api/nachweisarten', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vorlage: schluessel }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
      setHinweis(
        d.angelegt === 0
          ? 'Alles daraus war schon da — nichts geändert.'
          : `${d.angelegt} ${d.angelegt === 1 ? 'Eintrag' : 'Einträge'} angelegt`
            + (d.uebersprungen > 0
              ? `, ${d.uebersprungen} waren schon da und blieben unverändert.`
              : '.'),
      )
      await laden()
    } catch { setFehler('Keine Verbindung.') }
    finally { setArbeitet(false) }
  }

  async function speichern() {
    setArbeitet(true); setFehler('')
    try {
      const r = await fetch('/api/nachweisarten', {
        method: bearbeitet ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bearbeitet ? { id: bearbeitet, ...form } : form),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
      setMaske(false); setBearbeitet(null); setForm({ ...LEER })
      await laden()
    } catch { setFehler('Keine Verbindung.') }
    finally { setArbeitet(false) }
  }

  async function abschalten(art: Art) {
    setArbeitet(true); setFehler(''); setHinweis('')
    try {
      const r = await fetch('/api/nachweisarten', {
        method: art.aktiv ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(art.aktiv ? { id: art.id } : { id: art.id, aktiv: true }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
      if (d.hinweis) setHinweis(d.hinweis)
      await laden()
    } catch { setFehler('Keine Verbindung.') }
    finally { setArbeitet(false) }
  }

  function bearbeiten(a: Art) {
    setBearbeitet(a.id)
    setForm({
      name: a.name, gattung: a.gattung, giltFuer: a.giltFuer,
      giltFuerWerte: a.giltFuerWerte, faelligkeit: a.faelligkeit,
      abstandMonate: a.abstandMonate ?? 24, vorwarnTage: a.vorwarnTage,
      nachweisNoetig: a.nachweisNoetig, sichtbarkeit: a.sichtbarkeit,
      folge: a.folge, grundlage: a.grundlage ?? '',
    })
    setMaske(true)
  }

  if (laedt) {
    return <div className="flex justify-center py-10">
      <Loader2 size={20} className="animate-spin text-gray-300" />
    </div>
  }

  const wiederkehrend = form.faelligkeit === 'wiederkehrend'
    || form.faelligkeit === 'einstellung_und_wiederkehrend'
  const beschraenkt = form.giltFuer === 'positionen' || form.giltFuer === 'qualifikationen'

  return (
    <div className="space-y-4">
      {hinweis && (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-3">
          <p className="text-xs text-teal-900">{hinweis}</p>
        </div>
      )}
      {fehler && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-900">{fehler}</p>
        </div>
      )}

      {/* Vorlagen — vor allem für den leeren Katalog */}
      {vorlagen.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-navy">Vorlage übernehmen</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              Ein sinnvoller Anfang, kein Korsett — danach lässt sich jeder Eintrag
              ändern oder abschalten. Was schon im Katalog steht, bleibt unberührt.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {vorlagen.map(v => (
              <button
                key={v.schluessel}
                onClick={() => vorlageUebernehmen(v.schluessel)}
                disabled={arbeitet}
                className="text-left rounded-xl border border-gray-200 p-3
                           hover:border-teal-200 hover:bg-teal-50/40 disabled:opacity-50">
                <p className="text-sm font-semibold text-navy">{v.name}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                  {v.beschreibung}
                </p>
                <p className="text-[11px] text-teal-700 font-semibold mt-1.5">
                  {v.eintraege.length} Einträge
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-navy">
          Katalog {arten.length > 0 && <span className="text-gray-400 font-normal">
            · {arten.filter(a => a.aktiv).length} aktiv</span>}
        </p>
        <button
          onClick={() => { setBearbeitet(null); setForm({ ...LEER }); setMaske(true) }}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2
                     rounded-xl text-white bg-brand">
          <Plus size={13} /> Eintrag
        </button>
      </div>

      {arten.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <p className="text-sm text-gray-500">Der Katalog ist noch leer.</p>
          <p className="text-xs text-gray-400 mt-1">
            Nimm eine Vorlage oben oder lege einen Eintrag von Hand an.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50
                        overflow-hidden">
          {arten.map(a => (
            <div key={a.id} className={`px-4 py-3 ${a.aktiv ? '' : 'opacity-50'}`}>
              <div className="flex items-start gap-3">
                <FileCheck2 size={16} className={`shrink-0 mt-0.5 ${
                  a.gattung === 'vertrag' ? 'text-gray-400' : 'text-teal-600'}`} />
                <button onClick={() => bearbeiten(a)} className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-semibold text-navy">{a.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {FAELLIG_TEXT[a.faelligkeit]}
                    {a.abstandMonate ? ` alle ${a.abstandMonate} Monate` : ''}
                    {' · '}{GILT_TEXT[a.giltFuer]}
                    {a.giltFuerWerte.length > 0 && ` (${a.giltFuerWerte.join(', ')})`}
                    {' · '}Warnung {a.vorwarnTage} Tage vorher
                  </p>
                  {a.grundlage && (
                    <p className="text-[11px] text-gray-300 mt-0.5 truncate">{a.grundlage}</p>
                  )}
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  {a.folge === 'sperren' && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg
                                     bg-red-100 text-red-800">sperrt</span>
                  )}
                  {a.sichtbarkeit === 'unternehmen' && (
                    <span title="Nur Unternehmensebene">
                      <Lock size={13} className="text-gray-400" />
                    </span>
                  )}
                  <button
                    onClick={() => abschalten(a)}
                    disabled={arbeitet}
                    title={a.aktiv ? 'Abschalten' : 'Wieder einschalten'}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50">
                    <Power size={13} className={a.aktiv ? 'text-gray-400' : 'text-teal-600'} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Maske ────────────────────────────────────────────────────────── */}
      {maske && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center
                        justify-center p-0 sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5
                          space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-navy">
                {bearbeitet ? 'Eintrag ändern' : 'Neuer Eintrag'}
              </p>
              <button onClick={() => { setMaske(false); setBearbeitet(null) }}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <Feld titel="Name">
              <input
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="z. B. Erste Hilfe"
                className="w-full h-11 text-base border border-gray-200 rounded-xl px-3" />
            </Feld>

            <div className="grid grid-cols-2 gap-3">
              <Feld titel="Art">
                <Auswahl value={form.gattung} onChange={v => setForm({ ...form, gattung: v })}
                  optionen={[['nachweis', 'Nachweis'], ['vertrag', 'Vertragsfrist']]} />
              </Feld>
              <Feld titel="Gilt für">
                <Auswahl value={form.giltFuer} onChange={v => setForm({ ...form, giltFuer: v })}
                  optionen={Object.entries(GILT_TEXT)} />
              </Feld>
            </div>

            {beschraenkt && (
              <Feld titel={form.giltFuer === 'positionen' ? 'Positionen' : 'Qualifikationen'}>
                <input
                  value={form.giltFuerWerte.join(', ')}
                  onChange={e => setForm({
                    ...form,
                    giltFuerWerte: e.target.value.split(',').map(x => x.trim()).filter(Boolean),
                  })}
                  placeholder="mit Komma trennen"
                  className="w-full h-11 text-base border border-gray-200 rounded-xl px-3" />
              </Feld>
            )}

            <Feld titel="Fälligkeit">
              <Auswahl value={form.faelligkeit}
                onChange={v => setForm({ ...form, faelligkeit: v })}
                optionen={Object.entries(FAELLIG_TEXT)} />
            </Feld>

            <div className="grid grid-cols-2 gap-3">
              {wiederkehrend && (
                <Feld titel="Alle … Monate">
                  <input
                    type="number" min={1} value={form.abstandMonate}
                    onChange={e => setForm({ ...form, abstandMonate: Number(e.target.value) })}
                    className="w-full h-11 text-base border border-gray-200 rounded-xl px-3" />
                </Feld>
              )}
              <Feld titel="Warnung … Tage vorher">
                <input
                  type="number" min={0} value={form.vorwarnTage}
                  onChange={e => setForm({ ...form, vorwarnTage: Number(e.target.value) })}
                  className="w-full h-11 text-base border border-gray-200 rounded-xl px-3" />
              </Feld>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Feld titel="Wer sieht es">
                <Auswahl value={form.sichtbarkeit}
                  onChange={v => setForm({ ...form, sichtbarkeit: v })}
                  optionen={[
                    ['leitung', 'Auch die Standortleitung'],
                    ['unternehmen', 'Nur die Unternehmensebene'],
                  ]} />
              </Feld>
              <Feld titel="Wenn es fehlt">
                <Auswahl value={form.folge} onChange={v => setForm({ ...form, folge: v })}
                  optionen={[
                    ['warnen', 'Nur warnen'],
                    ['sperren', 'Kein Einsatz möglich'],
                  ]} />
              </Feld>
            </div>

            <Feld titel="Grundlage (freiwillig)">
              <input
                value={form.grundlage}
                onChange={e => setForm({ ...form, grundlage: e.target.value })}
                placeholder="z. B. §43 IfSG"
                className="w-full h-11 text-base border border-gray-200 rounded-xl px-3" />
              <p className="text-[11px] text-gray-400 mt-1">
                Wer den Abstand später ändert, soll sehen, woran er rüttelt.
              </p>
            </Feld>

            <label className="flex items-center gap-2 text-sm text-navy">
              <input
                type="checkbox" checked={form.nachweisNoetig}
                onChange={e => setForm({ ...form, nachweisNoetig: e.target.checked })} />
              Ein Dokument muss hinterlegt werden
            </label>

            {fehler && <p className="text-xs text-amber-700">{fehler}</p>}

            <button
              onClick={speichern}
              disabled={arbeitet || form.name.trim().length < 2}
              className="w-full h-12 rounded-2xl bg-brand text-navy font-semibold text-sm
                         flex items-center justify-center gap-2 disabled:opacity-50">
              {arbeitet ? <Loader2 size={16} className="animate-spin" /> : <Users2 size={16} />}
              {bearbeitet ? 'Änderung speichern' : 'Anlegen'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Feld({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
        {titel}
      </label>
      {children}
    </div>
  )
}

function Auswahl({ value, onChange, optionen }: {
  value: string
  onChange: (v: string) => void
  optionen: [string, string][]
}) {
  return (
    <div className="relative">
      <select
        value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-11 text-base border border-gray-200 rounded-xl px-3
                   appearance-none bg-white pr-8">
        {optionen.map(([w, t]) => <option key={w} value={w}>{t}</option>)}
      </select>
      <ChevronDown size={14}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}
