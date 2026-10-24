'use client'

import { useState, useEffect, useCallback } from 'react'
import { TimerReset, Plus, Trash2, AlertTriangle, FileText, CalendarClock } from 'lucide-react'

/**
 * §162 Kurzarbeit: Anzeige, Monatswerte, Abrechnungsliste.
 *
 * DREI SACHEN, DIE DIE MASKE VON SICH AUS SAGT
 *
 *   Die AUSSCHLUSSFRIST. §109 Abs. 1 SGB III gibt drei Monate nach Ablauf des
 *   Abrechnungsmonats — danach ist der Anspruch erloschen, nicht gestundet.
 *   Sie steht deshalb oben und nicht im Kleingedruckten.
 *
 *   Das SOLLENTGELT ist nicht das Gehalt. Es ist, was OHNE den Arbeitsausfall
 *   verdient worden wäre, vermindert um Entgelt für Mehrarbeit — aus der
 *   Zeiterfassung lässt es sich nicht ableiten, weil die gerade den Ausfall
 *   zeigt. Deshalb wird es eingetragen und nicht vorgeschlagen.
 *
 *   Die AGENTUR RECHNET NACH IHRER TABELLE. Wer den Wert ablesen kann, trägt
 *   ihn ein; dann gilt er, und das Programm nennt die eigene Abweichung.
 */

interface Anzeige {
  id: string
  bezeichnung: string
  grund: string
  angezeigtAm: string
  aktenzeichen: string | null
  von: string
  bis: string | null
  aktiv: boolean
}

interface Monatswert {
  id: string
  employeeId: string
  personName: string | null
  sollStunden: number
  istStunden: number
  sollEntgelt: number
  istEntgelt: number
  kugAusTabelle: number | null
  kug: number
  fiktivEntgelt: number
  svAgFiktiv: number
  leistungssatz: number
  hinweis: string | null
}

interface Liste {
  zeilen: {
    name: string; personalnummer: string | null
    sollEntgelt: number; istEntgelt: number; ausfallProzent: number
    leistungssatz: number; kug: number; svAgFiktiv: number
  }[]
  summeKug: number
  summeSvAgFiktiv: number
  frist: string
  tageBisFrist: number
  fristAbgelaufen: boolean
  schwelle: { betroffen: number; gesamt: number; erreicht: boolean }
}

const eur = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const datum = (d: string) => d.split('-').reverse().join('.')

const LEER_ANZEIGE = {
  bezeichnung: '', grund: 'wirtschaftlich',
  angezeigtAm: new Date().toISOString().slice(0, 10),
  aktenzeichen: '', von: new Date().toISOString().slice(0, 10),
}
const LEER_MONAT = {
  kurzarbeitId: '', employeeId: '',
  sollStunden: '', istStunden: '', sollEntgelt: '', istEntgelt: '', kugAusTabelle: '',
}

export function Kurzarbeit({ jahr, monat, mitarbeiter }: {
  jahr: number
  monat: number
  mitarbeiter: { id: string; name: string }[]
}) {
  const [anzeigen, setAnzeigen] = useState<Anzeige[]>([])
  const [monate, setMonate] = useState<Monatswert[]>([])
  const [frist, setFrist] = useState<{ frist: string; tage: number; abgelaufen: boolean } | null>(null)
  const [liste, setListe] = useState<Liste | null>(null)
  const [neueAnzeige, setNeueAnzeige] = useState(LEER_ANZEIGE)
  const [neuerMonat, setNeuerMonat] = useState(LEER_MONAT)
  const [zeigeAnzeigeForm, setZeigeAnzeigeForm] = useState(false)
  const [fehler, setFehler] = useState('')
  const [hinweise, setHinweise] = useState<string[]>([])
  const [laeuft, setLaeuft] = useState(false)

  const laden = useCallback(async () => {
    const res = await fetch(`/api/payroll/kurzarbeit?jahr=${jahr}&monat=${monat}`)
    const d = await res.json().catch(() => ({}))
    setAnzeigen(d.anzeigen ?? [])
    setMonate(d.monate ?? [])
    setFrist(d.frist
      ? { frist: d.frist, tage: d.tageBisFrist ?? 0, abgelaufen: d.fristAbgelaufen === true }
      : null)
    setListe(null)
  }, [jahr, monat])

  useEffect(() => { laden() }, [laden])

  async function anzeigeAnlegen() {
    setFehler(''); setHinweise([])
    setLaeuft(true)
    try {
      const res = await fetch('/api/payroll/kurzarbeit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(neueAnzeige),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFehler(d.error ?? 'Konnte nicht gespeichert werden.'); return }
      setHinweise(d.hinweise ?? [])
      setNeueAnzeige(LEER_ANZEIGE)
      setZeigeAnzeigeForm(false)
      await laden()
    } catch { setFehler('Konnte nicht gespeichert werden.') }
    finally { setLaeuft(false) }
  }

  async function monatAnlegen() {
    setFehler(''); setHinweise([])
    if (!neuerMonat.kurzarbeitId) {
      setFehler('Ohne Anzeige über Arbeitsausfall besteht kein Anspruch (§99 SGB III).')
      return
    }
    setLaeuft(true)
    try {
      const zahl = (s: string) => s.trim() === '' ? undefined : Number(s.replace(',', '.'))
      const res = await fetch('/api/payroll/kurzarbeit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          was: 'monat', jahr, monat,
          kurzarbeitId: neuerMonat.kurzarbeitId,
          employeeId: neuerMonat.employeeId,
          sollStunden: zahl(neuerMonat.sollStunden) ?? 0,
          istStunden: zahl(neuerMonat.istStunden) ?? 0,
          sollEntgelt: zahl(neuerMonat.sollEntgelt),
          istEntgelt: zahl(neuerMonat.istEntgelt) ?? 0,
          kugAusTabelle: neuerMonat.kugAusTabelle.trim() === ''
            ? undefined : zahl(neuerMonat.kugAusTabelle),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFehler(d.error ?? 'Konnte nicht gespeichert werden.'); return }
      setHinweise(d.hinweise ?? [])
      setNeuerMonat({ ...LEER_MONAT, kurzarbeitId: neuerMonat.kurzarbeitId })
      await laden()
    } catch { setFehler('Konnte nicht gespeichert werden.') }
    finally { setLaeuft(false) }
  }

  async function monatLoeschen(id: string) {
    setFehler(''); setHinweise([])
    const res = await fetch(`/api/payroll/kurzarbeit?monatId=${id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setFehler(d.error ?? 'Konnte nicht gelöscht werden.'); return }
    await laden()
  }

  async function listeHolen() {
    setFehler('')
    const res = await fetch(`/api/payroll/kurzarbeit?liste=1&jahr=${jahr}&monat=${monat}`)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setFehler(d.error ?? 'Die Liste konnte nicht erstellt werden.'); return }
    setListe(d)
  }

  return (
    <div data-test="kurzarbeit" className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-navy">Kurzarbeit</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Das Kurzarbeitergeld ist nicht 60 % der Brutto-, sondern der
          pauschalierten Nettodifferenz. Abgerechnet wird das Istentgelt, nicht
          das vertragliche — sonst zahlt der Betrieb zweimal.
        </p>
      </div>

      {frist && (
        <div className={`flex items-start gap-2 rounded-xl p-2.5 border ${
          frist.abgelaufen
            ? 'bg-amber-50 border-amber-200'
            : frist.tage <= 30 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'
        }`}>
          <CalendarClock size={14} className={`shrink-0 mt-0.5 ${
            frist.abgelaufen || frist.tage <= 30 ? 'text-amber-600' : 'text-gray-500'}`} />
          <p className={`text-xs ${
            frist.abgelaufen || frist.tage <= 30 ? 'text-amber-900' : 'text-gray-600'}`}>
            {frist.abgelaufen
              ? `Die Ausschlussfrist für ${monat}/${jahr} ist am ${datum(frist.frist)} abgelaufen. `
                + 'Der Anspruch ist erloschen (§109 Abs. 1 SGB III) — nicht gestundet.'
              : `Der Leistungsantrag für ${monat}/${jahr} muss bis zum ${datum(frist.frist)} `
                + `gestellt sein — noch ${frist.tage} Tage (§109 Abs. 1 SGB III, Ausschlussfrist).`}
          </p>
        </div>
      )}

      {/* ── Anzeige über Arbeitsausfall ─────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-navy flex-1">
            Anzeige über Arbeitsausfall (§99 SGB III)
          </p>
          <button onClick={() => setZeigeAnzeigeForm(v => !v)}
            className="text-xs font-semibold text-brand">
            {zeigeAnzeigeForm ? 'Abbrechen' : '+ Neue Anzeige'}
          </button>
        </div>

        {zeigeAnzeigeForm && (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_1fr] gap-2">
              <input value={neueAnzeige.bezeichnung}
                onChange={e => setNeueAnzeige(a => ({ ...a, bezeichnung: e.target.value }))}
                placeholder="Betriebsteil, z. B. Wohnbereich 2"
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
              <select value={neueAnzeige.grund}
                onChange={e => setNeueAnzeige(a => ({ ...a, grund: e.target.value }))}
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5">
                <option value="wirtschaftlich">wirtschaftliche Ursache</option>
                <option value="unabwendbar">unabwendbares Ereignis</option>
              </select>
              <input value={neueAnzeige.aktenzeichen}
                onChange={e => setNeueAnzeige(a => ({ ...a, aktenzeichen: e.target.value }))}
                placeholder="Kug-Aktenzeichen"
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">
                  Bei der Agentur eingegangen am
                </label>
                <input type="date" value={neueAnzeige.angezeigtAm}
                  onChange={e => setNeueAnzeige(a => ({ ...a, angezeigtAm: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">
                  Kurzarbeit ab
                </label>
                <input type="date" value={neueAnzeige.von}
                  onChange={e => setNeueAnzeige(a => ({ ...a, von: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
              </div>
              <div className="flex items-end">
                <button onClick={anzeigeAnlegen} disabled={laeuft}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand px-3 py-2 rounded-lg disabled:opacity-40">
                  <Plus size={14} /> Anlegen
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-400">
              Kurzarbeitergeld gibt es frühestens ab dem Kalendermonat, in dem
              die Anzeige bei der Agentur eingegangen ist (§99 Abs. 2 SGB III) —
              deshalb zählt dieses Datum und nicht das der Eingabe.
            </p>
          </div>
        )}

        {anzeigen.length > 0 ? (
          <div data-test="kug-anzeigen" className="space-y-1">
            {anzeigen.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-xs">
                <TimerReset size={13} className="text-gray-400 shrink-0" />
                <span className="text-navy font-medium">{a.bezeichnung}</span>
                <span className="text-gray-500">
                  angezeigt {datum(a.angezeigtAm)}
                  {a.aktenzeichen ? ` · ${a.aktenzeichen}` : ' · ohne Aktenzeichen'}
                </span>
                {!a.aktiv && <span className="text-gray-400">beendet</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">Keine Anzeige erfasst.</p>
        )}
      </div>

      {/* ── Monatswerte ─────────────────────────────────────────────────── */}
      {anzeigen.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1.4fr] gap-2">
            <select value={neuerMonat.kurzarbeitId}
              onChange={e => setNeuerMonat(m => ({ ...m, kurzarbeitId: e.target.value }))}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5">
              <option value="">— Anzeige —</option>
              {anzeigen.map(a => <option key={a.id} value={a.id}>{a.bezeichnung}</option>)}
            </select>
            <select value={neuerMonat.employeeId}
              onChange={e => setNeuerMonat(m => ({ ...m, employeeId: e.target.value }))}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5">
              <option value="">— Mitarbeiter —</option>
              {mitarbeiter.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] gap-2">
            <input value={neuerMonat.sollStunden}
              onChange={e => setNeuerMonat(m => ({ ...m, sollStunden: e.target.value }))}
              placeholder="Soll-Std." inputMode="decimal"
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
            <input value={neuerMonat.istStunden}
              onChange={e => setNeuerMonat(m => ({ ...m, istStunden: e.target.value }))}
              placeholder="Ist-Std." inputMode="decimal"
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
            <input value={neuerMonat.sollEntgelt}
              onChange={e => setNeuerMonat(m => ({ ...m, sollEntgelt: e.target.value }))}
              placeholder="Sollentgelt €" inputMode="decimal"
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
            <input value={neuerMonat.istEntgelt}
              onChange={e => setNeuerMonat(m => ({ ...m, istEntgelt: e.target.value }))}
              placeholder="Istentgelt €" inputMode="decimal"
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
            <input value={neuerMonat.kugAusTabelle}
              onChange={e => setNeuerMonat(m => ({ ...m, kugAusTabelle: e.target.value }))}
              placeholder="Kug lt. Tabelle" inputMode="decimal"
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
            <button onClick={monatAnlegen} disabled={laeuft}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand px-3 py-2 rounded-lg disabled:opacity-40">
              <Plus size={14} /> Erfassen
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            Das <strong>Sollentgelt</strong> ist das Entgelt OHNE den
            Arbeitsausfall und ohne Mehrarbeit (§106 Abs. 1 SGB III) — es lässt
            sich aus der Zeiterfassung nicht ableiten. Das Feld ganz rechts ist
            für den Wert aus der amtlichen Tabelle der Agentur: Wer ihn
            einträgt, überschreibt damit die eigene Rechnung.
          </p>
        </div>
      )}

      {fehler && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">{fehler}</p>
        </div>
      )}
      {hinweise.map((h, i) => (
        <div key={i} className="flex items-start gap-2 rounded-xl bg-sky-50 border border-sky-200 p-2.5">
          <AlertTriangle size={14} className="text-sky-600 shrink-0 mt-0.5" />
          <p className="text-xs text-sky-900">{h}</p>
        </div>
      ))}

      {monate.length > 0 && (
        <div className="space-y-1">
          {monate.map(m => (
            <div key={m.id} className="flex items-center gap-2 rounded-xl border border-gray-200 p-2.5">
              <TimerReset size={14} className="text-gray-400 shrink-0" />
              <span className="text-sm text-navy font-medium">{m.personName}</span>
              <span className="text-xs text-gray-500 tabular-nums">
                Soll {eur(m.sollEntgelt)} · Ist {eur(m.istEntgelt)}
              </span>
              <div className="flex-1" />
              <span className="text-xs text-gray-500 tabular-nums">
                {m.kug > 0 ? `${(m.leistungssatz * 100).toFixed(0)} %` : '—'}
              </span>
              <span className="text-sm font-semibold text-navy tabular-nums">
                {m.kug > 0 ? eur(m.kug) : 'noch nicht gerechnet'}
              </span>
              <button onClick={() => monatLoeschen(m.id)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-700 hover:bg-amber-50">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button onClick={listeHolen}
            className="flex items-center gap-1.5 text-xs font-semibold text-navy border border-gray-200 px-3 py-2 rounded-lg mt-1">
            <FileText size={14} /> Abrechnungsliste für die Agentur
          </button>
        </div>
      )}

      {liste && (
        <div className="rounded-xl border border-gray-200 p-3 space-y-2">
          <p className="text-xs font-semibold text-navy">
            Abrechnungsliste {monat}/{jahr}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="pb-1 pr-3 font-semibold">Person</th>
                  <th className="pb-1 pr-3 font-semibold">PersNr.</th>
                  <th className="pb-1 pr-3 font-semibold text-right">Soll</th>
                  <th className="pb-1 pr-3 font-semibold text-right">Ist</th>
                  <th className="pb-1 pr-3 font-semibold text-right">Ausfall</th>
                  <th className="pb-1 pr-3 font-semibold text-right">Kug</th>
                  <th className="pb-1 font-semibold text-right">SV (AG)</th>
                </tr>
              </thead>
              <tbody className="text-navy">
                {liste.zeilen.map(z => (
                  <tr key={z.name} className="border-t border-gray-100">
                    <td className="py-1 pr-3">{z.name}</td>
                    <td className="py-1 pr-3 text-gray-500">{z.personalnummer ?? '—'}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{eur(z.sollEntgelt)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{eur(z.istEntgelt)}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">
                      {z.ausfallProzent.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %
                    </td>
                    <td className="py-1 pr-3 text-right tabular-nums font-semibold">{eur(z.kug)}</td>
                    <td className="py-1 text-right tabular-nums">{eur(z.svAgFiktiv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-600">
            Zusammen <strong>{eur(liste.summeKug)}</strong> Kurzarbeitergeld ·{' '}
            {eur(liste.summeSvAgFiktiv)} Beiträge auf das fiktive Entgelt, die
            der Arbeitgeber allein trägt.
          </p>
          <p className="text-[11px] text-gray-400">
            Betriebsschwelle (§96 Abs. 1 Nr. 4 SGB III):{' '}
            {liste.schwelle.betroffen} von {liste.schwelle.gesamt} Beschäftigten
            mit mehr als 10 % Entgeltausfall —{' '}
            {liste.schwelle.erreicht ? 'die Schwelle ist erreicht' : 'die Schwelle ist NICHT erreicht'}.
          </p>
        </div>
      )}
    </div>
  )
}
