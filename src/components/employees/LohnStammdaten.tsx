'use client'

// §102 Lohn-Stammdaten eines Mitarbeiters.
//
// Diese Angaben braucht jede Lohnabrechnung. Bisher standen sie nirgends und
// hätten bei jedem Abrechnungslauf neu eingetippt werden müssen. Sie gehören
// einmalig an die Person — erfasst beim Anlegen auf Unternehmensebene.

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/lib/toast-context'
import { Loader2, Check, Euro, ChevronDown, ChevronUp } from 'lucide-react'

interface Profil {
  personalnummer?: string | null
  eintrittsdatum?: string | null
  austrittsdatum?: string | null
  befristetBis?: string | null
  probezeitBis?: string | null
  strasse?: string | null
  plz?: string | null
  ort?: string | null
  steuerId?: string | null
  steuerklasse?: number | null
  kinderfreibetraege?: number | null
  hatKinder?: boolean | null
  kinderUnter25?: number | null
  konfession?: string | null
  bundesland?: string | null
  sozialversicherungsnummer?: string | null
  versicherungsart?: string | null
  krankenkasse?: string | null
  zusatzbeitrag?: number | null
  pkvBeitrag?: number | null
  rentenversicherungspflichtig?: boolean
  schwerbehindert?: boolean
  lohnart?: string | null
  stundenlohn?: number | null
  monatsgehalt?: number | null
  iban?: string | null
  bic?: string | null
  kontoinhaber?: string | null
  notiz?: string | null
}

const BUNDESLAENDER = [
  'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg',
  'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen', 'Nordrhein-Westfalen',
  'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt',
  'Schleswig-Holstein', 'Thüringen',
]

/** Angaben, ohne die keine Abrechnung möglich ist. */
function fehlendePflichtangaben(p: Profil): string[] {
  const fehlt: string[] = []
  if (!p.steuerklasse) fehlt.push('Steuerklasse')
  if (!p.versicherungsart) fehlt.push('Versicherungsart')
  if (!p.bundesland) fehlt.push('Bundesland')
  if (!p.lohnart) fehlt.push('Lohnart')
  else if (p.lohnart === 'stunde' && !p.stundenlohn) fehlt.push('Stundenlohn')
  else if (p.lohnart === 'monat' && !p.monatsgehalt) fehlt.push('Monatsgehalt')
  return fehlt
}

export function LohnStammdaten({ employeeId }: { employeeId: string }) {
  const { showToast } = useToast()
  const [profil, setProfil] = useState<Profil>({ rentenversicherungspflichtig: true })
  const [laden, setLaden] = useState(true)
  const [speichert, setSpeichert] = useState(false)
  const [offen, setOffen] = useState(false)

  const holen = useCallback(async () => {
    setLaden(true)
    try {
      const r = await fetch(`/api/employees/${employeeId}/payroll-profile`)
      const d = await r.json()
      setProfil(d.profil ?? { rentenversicherungspflichtig: true })
    } catch { /* leer lassen */ }
    setLaden(false)
  }, [employeeId])
  useEffect(() => { holen() }, [holen])

  const setzen = <K extends keyof Profil>(feld: K, wert: Profil[K]) =>
    setProfil(p => ({ ...p, [feld]: wert }))

  const speichern = async () => {
    setSpeichert(true)
    try {
      const r = await fetch(`/api/employees/${employeeId}/payroll-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profil),
      })
      if (!r.ok) throw new Error()
      showToast('Lohn-Stammdaten gespeichert', 'success')
    } catch { showToast('Speichern fehlgeschlagen', 'error') }
    finally { setSpeichert(false) }
  }

  const fehlt = fehlendePflichtangaben(profil)

  const Feld = ({ label, feld, typ = 'text', platzhalter }: {
    label: string; feld: keyof Profil; typ?: string; platzhalter?: string
  }) => (
    <div>
      <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">{label}</label>
      <input
        type={typ}
        value={(profil[feld] ?? '') as string | number}
        placeholder={platzhalter}
        onChange={e => setzen(feld, (typ === 'number'
          ? (e.target.value === '' ? null : Number(e.target.value))
          : e.target.value) as Profil[keyof Profil])}
        className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20 placeholder:text-gray-300"
      />
    </div>
  )

  return (
    <div className="border border-gray-100 rounded-xl p-3">
      <button onClick={() => setOffen(o => !o)} className="w-full flex items-center gap-2 text-left">
        <Euro size={14} className="text-gray-400" />
        <span className="text-sm font-semibold text-navy flex-1">Lohn-Stammdaten</span>
        {!laden && fehlt.length > 0 && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
            {fehlt.length} Angabe{fehlt.length === 1 ? '' : 'n'} fehlt
          </span>
        )}
        {!laden && fehlt.length === 0 && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">
            vollständig
          </span>
        )}
        {offen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {offen && !laden && (
        <div className="mt-3 space-y-4">
          {fehlt.length > 0 && (
            <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-2">
              Für eine Abrechnung fehlt noch: {fehlt.join(', ')}.
            </p>
          )}

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Beschäftigung</p>
            <div className="grid grid-cols-2 gap-2">
              <Feld label="Personalnummer" feld="personalnummer" />
              <Feld label="Eintritt" feld="eintrittsdatum" typ="date" />
              <Feld label="Probezeit bis" feld="probezeitBis" typ="date" />
              <Feld label="Befristet bis" feld="befristetBis" typ="date" />
              <Feld label="Austritt" feld="austrittsdatum" typ="date" />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Anschrift (steht auf der Abrechnung)</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2"><Feld label="Straße und Nr." feld="strasse" /></div>
              <Feld label="PLZ" feld="plz" />
              <Feld label="Ort" feld="ort" />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Steuer</p>
            <div className="grid grid-cols-2 gap-2">
              <Feld label="Steuer-ID" feld="steuerId" platzhalter="11-stellig" />
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Steuerklasse</label>
                <select value={profil.steuerklasse ?? ''} onChange={e => setzen('steuerklasse', e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20">
                  <option value="">— wählen —</option>
                  {[1, 2, 3, 4, 5, 6].map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <Feld label="Kinderfreibeträge" feld="kinderfreibetraege" typ="number" platzhalter="z.B. 1" />
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Konfession</label>
                <select value={profil.konfession ?? ''} onChange={e => setzen('konfession', e.target.value || null)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20">
                  <option value="">— wählen —</option>
                  <option value="keine">keine (keine Kirchensteuer)</option>
                  <option value="ev">evangelisch</option>
                  <option value="rk">römisch-katholisch</option>
                  <option value="sonstige">sonstige</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Bundesland</label>
                <select value={profil.bundesland ?? ''} onChange={e => setzen('bundesland', e.target.value || null)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20">
                  <option value="">— wählen —</option>
                  {BUNDESLAENDER.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Sozialversicherung</p>
            <div className="grid grid-cols-2 gap-2">
              <Feld label="SV-Nummer" feld="sozialversicherungsnummer" />
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Versicherungsart</label>
                <select value={profil.versicherungsart ?? ''} onChange={e => setzen('versicherungsart', e.target.value || null)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20">
                  <option value="">— wählen —</option>
                  <option value="GKV">gesetzlich</option>
                  <option value="PKV">privat</option>
                </select>
              </div>
              {profil.versicherungsart === 'PKV' ? (
                <Feld label="PKV-Beitrag mtl." feld="pkvBeitrag" typ="number" />
              ) : (
                <>
                  <Feld label="Krankenkasse" feld="krankenkasse" />
                  <Feld label="Zusatzbeitrag %" feld="zusatzbeitrag" typ="number" platzhalter="z.B. 1.7" />
                </>
              )}
            </div>
            {/* §116 Pflegeversicherung: der Zuschlag entfällt dauerhaft mit dem
                ersten Kind, die Abschläge gibt es nur für Kinder unter 25 und
                erst ab dem zweiten. Aus den Kinderfreibeträgen lässt sich das
                nicht ableiten — deshalb zwei eigene Angaben. */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Hat Kinder</label>
                <select value={profil.hatKinder == null ? '' : profil.hatKinder ? 'ja' : 'nein'}
                  onChange={e => setzen('hatKinder', e.target.value === '' ? null : e.target.value === 'ja')}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20">
                  <option value="">— wählen —</option>
                  <option value="ja">ja</option>
                  <option value="nein">nein</option>
                </select>
              </div>
              <Feld label="Kinder unter 25" feld="kinderUnter25" typ="number" platzhalter="z.B. 2" />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Ohne Kinder fällt der Zuschlag zur Pflegeversicherung an. Ab dem zweiten
              Kind unter 25 mindert jedes Kind den Beitrag.
            </p>
            <div className="flex flex-wrap gap-4 mt-2">
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input type="checkbox" checked={profil.rentenversicherungspflichtig !== false}
                  onChange={e => setzen('rentenversicherungspflichtig', e.target.checked)}
                  className="rounded border-gray-300" />
                rentenversicherungspflichtig
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input type="checkbox" checked={profil.schwerbehindert === true}
                  onChange={e => setzen('schwerbehindert', e.target.checked)}
                  className="rounded border-gray-300" />
                schwerbehindert (Zusatzurlaub)
              </label>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Entgelt</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Lohnart</label>
                <select value={profil.lohnart ?? ''} onChange={e => setzen('lohnart', e.target.value || null)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20">
                  <option value="">— wählen —</option>
                  <option value="monat">Monatsgehalt</option>
                  <option value="stunde">Stundenlohn</option>
                </select>
              </div>
              {profil.lohnart === 'stunde'
                ? <Feld label="Stundenlohn €" feld="stundenlohn" typ="number" />
                : <Feld label="Monatsgehalt €" feld="monatsgehalt" typ="number" />}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Zahlung</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2"><Feld label="IBAN" feld="iban" /></div>
              <Feld label="BIC" feld="bic" />
              <Feld label="Kontoinhaber" feld="kontoinhaber" platzhalter="falls abweichend" />
            </div>
          </div>

          <Button size="sm" onClick={speichern} disabled={speichert} className="gap-1.5">
            {speichert ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Lohn-Stammdaten speichern
          </Button>
        </div>
      )}
    </div>
  )
}
