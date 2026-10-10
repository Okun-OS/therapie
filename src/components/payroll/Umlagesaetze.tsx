'use client'

import { useState, useEffect, useCallback } from 'react'
import { Percent, AlertTriangle, Check, Trash2, Users, BookOpen, CalendarClock } from 'lucide-react'

/**
 * §162/§175 Die Umlagesätze der Krankenkassen pflegen.
 *
 * WARUM DIESE MASKE ZUERST GEBAUT WURDE
 * Weil ohne sie bei JEDEM Lohnlauf eine Warnung steht, die niemand abstellen
 * kann: U1 und U2 stehen nicht im Gesetz, sondern in der Satzung jeder
 * einzelnen Krankenkasse. Das Programm rät sie nicht — eine erfundene Umlage
 * fällt niemandem auf, eine fehlende schon.
 *
 * §175 WAS SICH GEÄNDERT HAT: DER BETRIEB WÄHLT, ER TIPPT NICHT
 * Anfangs musste hier jeder Satz von Hand eingetragen werden — auch der,
 * der in der Satzung der TK für jeden Arbeitgeber gleich ist. Dreißig Kunden
 * tippen dieselbe Zahl, und einer vertippt sich. Jetzt steht die Satzung im
 * Katalog, und der Betrieb wählt nur noch seine Erstattungsstufe:
 * „80 % Erstattung → 3,20 % Umlage".
 *
 * Die Handeingabe bleibt für Kassen, die (noch) nicht im Katalog stehen.
 */

interface Stufe {
  erstattung: number
  satz: number
  u2: number | null
  geprueft: boolean
}

interface KatalogKasse {
  kasse: string
  stufen: Stufe[]
  kommenderWechsel: string | null
}

interface Satz {
  id: string
  kasse: string
  u1Satz: number | null
  u1Erstattung: number | null
  u2Satz: number | null
  quelle: 'eigen' | 'katalog' | 'keine'
  geprueft: boolean
  gueltigAb: string
  staende: number
  alleStaende: {
    id: string
    gueltigAb: string
    u1Satz: number | null
    u2Satz: number | null
    u1Erstattung: number | null
    gilt: boolean
  }[]
}

interface Groesse {
  zahl: number
  u1Pflichtig: boolean
  hinweis: string
}

const proz = (a: number | null) =>
  a == null ? '—' : `${(a * 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`

const datum = (t: string) =>
  new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })

const LEER = { kasse: '', stufe: '', u1Satz: '', u1Erstattung: '', u2Satz: '' }

export function Umlagesaetze() {
  const [saetze, setSaetze] = useState<Satz[]>([])
  const [kassen, setKassen] = useState<{ kasse: string; hinterlegt: boolean; imKatalog: boolean }[]>([])
  const [katalog, setKatalog] = useState<KatalogKasse[]>([])
  const [groesse, setGroesse] = useState<Groesse | null>(null)
  const [insolvenz, setInsolvenz] = useState<{ satz: number; geprueft: boolean } | null>(null)
  const [neu, setNeu] = useState(LEER)
  const [fehler, setFehler] = useState('')
  const [hinweise, setHinweise] = useState<string[]>([])
  const [laeuft, setLaeuft] = useState(false)

  const laden = useCallback(async () => {
    const res = await fetch('/api/payroll/umlagen')
    const d = await res.json().catch(() => ({}))
    setSaetze(d.saetze ?? [])
    setKassen(d.kassen ?? [])
    setKatalog(d.katalog ?? [])
    setGroesse(d.betriebsgroesse ?? null)
    setInsolvenz(d.insolvenzgeld ?? null)
  }, [])

  useEffect(() => { laden() }, [laden])

  /** Der Katalogeintrag zur gerade getippten Kasse — falls es ihn gibt. */
  const gewaehlteKasse = katalog.find(
    k => k.kasse.toLowerCase() === neu.kasse.trim().toLowerCase())

  async function speichern() {
    setFehler(''); setHinweise([])
    const kasse = neu.kasse.trim()
    if (!kasse) { setFehler('Bitte die Krankenkasse angeben.'); return }
    if (gewaehlteKasse && !neu.stufe) {
      setFehler('Bitte die Erstattungsstufe wählen — sie entscheidet über den Satz.')
      return
    }
    setLaeuft(true)
    try {
      const zahl = (s: string) => s.trim() === '' ? null : Number(s.replace(',', '.'))
      // Steht die Kasse im Katalog, wird nur die Stufe geschickt. Der Satz
      // kommt aus der Satzung und nicht aus einem Eingabefeld.
      const koerper = gewaehlteKasse
        ? { kasse, u1Erstattung: Number(neu.stufe) * 100 }
        : {
          kasse,
          u1Satz: zahl(neu.u1Satz),
          u1Erstattung: zahl(neu.u1Erstattung),
          u2Satz: zahl(neu.u2Satz),
        }
      const res = await fetch('/api/payroll/umlagen', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(koerper),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFehler(d.error ?? 'Konnte nicht gespeichert werden.'); return }
      setHinweise(d.hinweise ?? [])
      setNeu(LEER)
      await laden()
    } catch { setFehler('Konnte nicht gespeichert werden.') }
    finally { setLaeuft(false) }
  }

  async function loeschen(id: string) {
    setFehler(''); setHinweise([])
    const res = await fetch(`/api/payroll/umlagen?id=${id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setFehler(d.error ?? 'Konnte nicht gelöscht werden.'); return }
    setHinweise(d.hinweis ? [d.hinweis] : [])
    await laden()
  }

  const fehlend = kassen.filter(k => !k.hinterlegt)

  return (
    <div data-test="umlagen" className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-navy">Umlagesätze der Krankenkassen</p>
        <p className="text-xs text-gray-500 mt-0.5">
          U1 (Entgeltfortzahlung) und U2 (Mutterschaft) stehen nicht im Gesetz,
          sondern in der Satzung jeder einzelnen Kasse. Bei der U1 wählt der
          Betrieb eine <strong>Erstattungsstufe</strong> — je höher die
          Erstattung, desto höher die Umlage. Was hier fehlt, wird nicht
          geraten: Dann fällt keine Umlage an, und der Lohnlauf sagt es.
        </p>
      </div>

      {groesse && (
        <div className="flex items-start gap-2 rounded-xl bg-gray-50 border border-gray-200 p-2.5">
          <Users size={14} className="text-gray-500 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600">{groesse.hinweis}</p>
        </div>
      )}

      {fehlend.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">
            Für {fehlend.length === 1 ? 'diese Kasse' : 'diese Kassen'} ist noch
            nichts hinterlegt: <strong>{fehlend.map(k => k.kasse).join(', ')}</strong>.
            Solange das so ist, rechnet der Lohnlauf für die betroffenen
            Beschäftigten keine U1 und keine U2.
          </p>
        </div>
      )}

      {/* ── Eintragen ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-[1.6fr_1.8fr_auto] gap-2">
          <input
            list="umlage-kassen"
            data-test="umlage-kasse"
            value={neu.kasse}
            onChange={e => setNeu(n => ({ ...n, kasse: e.target.value, stufe: '' }))}
            placeholder="Krankenkasse"
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
          <datalist id="umlage-kassen">
            {Array.from(new Set([
              ...kassen.map(k => k.kasse),
              ...katalog.map(k => k.kasse),
            ])).sort((a, b) => a.localeCompare(b, 'de'))
              .map(k => <option key={k} value={k} />)}
          </datalist>

          {gewaehlteKasse ? (
            <select
              data-test="umlage-stufe"
              value={neu.stufe}
              onChange={e => setNeu(n => ({ ...n, stufe: e.target.value }))}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
              <option value="">Erstattungsstufe wählen …</option>
              {gewaehlteKasse.stufen.map(s => (
                <option key={s.erstattung} value={s.erstattung}>
                  {proz(s.erstattung)} Erstattung → U1 {proz(s.satz)}
                  {s.u2 != null && ` · U2 ${proz(s.u2)}`}
                </option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <input
                value={neu.u1Satz}
                onChange={e => setNeu(n => ({ ...n, u1Satz: e.target.value }))}
                placeholder="U1 %" inputMode="decimal"
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
              <input
                value={neu.u1Erstattung}
                onChange={e => setNeu(n => ({ ...n, u1Erstattung: e.target.value }))}
                placeholder="Erstattung %" inputMode="decimal"
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
              <input
                value={neu.u2Satz}
                onChange={e => setNeu(n => ({ ...n, u2Satz: e.target.value }))}
                placeholder="U2 %" inputMode="decimal"
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
            </div>
          )}

          <button
            onClick={speichern}
            disabled={laeuft}
            data-test="umlage-speichern"
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand px-3 py-2 rounded-lg disabled:opacity-40">
            <Check size={14} /> Speichern
          </button>
        </div>

        {gewaehlteKasse ? (
          <div className="flex items-start gap-2 text-[11px] text-gray-500" data-test="umlage-katalog-hinweis">
            <BookOpen size={12} className="shrink-0 mt-0.5 text-gray-400" />
            <span>
              Die Sätze von <strong>{gewaehlteKasse.kasse}</strong> sind
              hinterlegt — Sie wählen nur die Stufe, die Ihr Betrieb bei dieser
              Kasse vereinbart hat.
              {gewaehlteKasse.stufen.some(s => !s.geprueft) && (
                <> Diese Zahlen sind <strong>übernommen und noch nicht gegen
                die Satzung geprüft</strong>.</>
              )}
              {gewaehlteKasse.kommenderWechsel && (
                <> Zum {datum(gewaehlteKasse.kommenderWechsel)} ändert diese
                Kasse ihre Sätze — ab diesem Monat rechnet der Lohnlauf
                automatisch mit den neuen.</>
              )}
            </span>
          </div>
        ) : (
          <p className="text-[11px] text-gray-400">
            Diese Kasse steht nicht im Katalog — bitte die Sätze aus ihrer
            Satzung eintragen. Prozentzahlen, nicht Anteile:
            {' '}<strong>2,1</strong> für 2,1 %.
          </p>
        )}
      </div>

      {fehler && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900" data-test="umlage-fehler">{fehler}</p>
        </div>
      )}
      {hinweise.map((h, i) => (
        <p key={i} className="text-xs text-teal-700">{h}</p>
      ))}

      {/* ── Was hinterlegt ist ────────────────────────────────────────── */}
      {saetze.length > 0 ? (
        <div data-test="umlagen-liste" className="space-y-1">
          {saetze.map(s => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-2.5">
              <Percent size={14} className="text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-navy font-medium">{s.kasse}</span>
                {s.quelle === 'eigen' && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">
                    selbst eingetragen
                  </span>
                )}
                {s.quelle === 'katalog' && !s.geprueft && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                    übernommen, ungeprüft
                  </span>
                )}
                {s.staende > 1 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-gray-400">
                    <CalendarClock size={10} /> gilt seit {datum(s.gueltigAb)}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
                U1 {proz(s.u1Satz)}
                {s.u1Erstattung != null && ` · Erstattung ${proz(s.u1Erstattung)}`}
              </span>
              <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
                U2 {proz(s.u2Satz)}
              </span>
              <button onClick={() => loeschen(s.id)}
                aria-label={`${s.kasse} entfernen`}
                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-700 hover:bg-amber-50">
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {/*
            §175 Mehrere Stände einer Kasse — jeder einzeln wegräumbar.

            Die Falle, die beim Bauen aufgefallen ist: Wer im September einen
            Satz einträgt, den Vertipper bemerkt und ihn mit Stichtag
            1. Januar neu einträgt, hat danach zwei Stände. Der falsche vom
            September ist der jüngere und gilt weiter. Gerechnet wird richtig,
            nur mit dem falschen Satz — und ohne diese Liste sähe man es nie.
          */}
          {saetze.filter(s => s.staende > 1).map(s => (
            <div key={`${s.id}-staende`} data-test={`umlage-staende-${s.kasse}`}
              className="ml-6 rounded-xl bg-gray-50 border border-gray-200 p-2.5 space-y-1">
              <p className="text-[11px] text-gray-500">
                Für <strong>{s.kasse}</strong> sind {s.staende} Stände
                hinterlegt. Es gilt immer der jüngste, der nicht in der Zukunft
                liegt — ein alter Vertipper mit späterem Stichtag würde also
                weiter rechnen. Was nicht mehr stimmt, gehört hier weg.
              </p>
              {s.alleStaende.map(st => (
                <div key={st.id} className="flex items-center gap-2 text-[11px]">
                  <span className={`tabular-nums ${st.gilt ? 'font-semibold text-navy' : 'text-gray-400'}`}>
                    ab {datum(st.gueltigAb)}
                  </span>
                  <span className={`tabular-nums ${st.gilt ? 'text-gray-600' : 'text-gray-400'}`}>
                    U1 {proz(st.u1Satz)} · U2 {proz(st.u2Satz)}
                    {st.u1Erstattung != null && ` · Erstattung ${proz(st.u1Erstattung)}`}
                  </span>
                  {st.gilt && (
                    <span className="text-[10px] uppercase tracking-wide text-teal-700 bg-teal-50 rounded px-1.5 py-0.5">
                      gilt diesen Monat
                    </span>
                  )}
                  <button onClick={() => loeschen(st.id)}
                    aria-label={`Stand ab ${st.gueltigAb} entfernen`}
                    data-test={`umlage-stand-weg-${st.gueltigAb}`}
                    className="ml-auto p-1 rounded text-gray-400 hover:text-amber-700 hover:bg-amber-50">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Noch keine Kasse hinterlegt.</p>
      )}

      {katalog.length > 0 && (
        <p className="text-[11px] text-gray-400">
          Im Katalog stehen {katalog.length} Kassen mit ihren Stufen. Fehlt
          Ihre, tragen Sie die Sätze aus der Satzung selbst ein — der eigene
          Eintrag geht dem Katalog immer vor.
        </p>
      )}

      {insolvenz && (
        <p className="text-[11px] text-gray-400">
          Die Insolvenzgeldumlage ist bundeseinheitlich und steht nicht zur
          Wahl: derzeit {proz(insolvenz.satz)} (§358 SGB III).
          {!insolvenz.geprueft && ' Dieser Satz ist noch nicht gegen die Rechtsverordnung abgeglichen.'}
        </p>
      )}
    </div>
  )
}
