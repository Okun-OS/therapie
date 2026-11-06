'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, X, Loader2, Globe, FileEdit, Archive, Users2, Trash2, ExternalLink,
} from 'lucide-react'

/**
 * §148 Die Stellen eines Betriebs.
 *
 * WARUM DER ENTWURF DER NORMALFALL IST
 * Eine neue Anzeige entsteht als Entwurf und geht nicht sofort ins Internet.
 * Zwischen „ich tippe mal was" und „das steht jetzt bei Google" gehört ein
 * bewusster Schritt — und der zeigt vorher, was noch fehlt.
 *
 * WARUM DIE FEHLENDEN PUNKTE ALS LISTE KOMMEN
 * Weil „Veröffentlichen fehlgeschlagen" niemandem hilft. Der Server schickt,
 * was fehlt; hier steht es untereinander.
 */

interface Stelle {
  id: string
  titel: string
  locationId: string | null
  ort: string | null
  plz: string | null
  umfang: string
  stundenProWoche: number | null
  befristung: string
  befristetBis: string | null
  beginn: string | null
  beschreibung: string
  aufgaben: string[]
  profil: string[]
  wirBieten: string[]
  verguetungVon: number | null
  verguetungBis: number | null
  verguetungZeit: string
  status: string
  slug: string
  kontaktName: string | null
  kontaktEmail: string | null
  offeneBewerbungen: number
}

const LEER = {
  titel: '', locationId: '', ort: '', plz: '', umfang: 'teilzeit',
  stundenProWoche: '', befristung: 'unbefristet', befristetBis: '', beginn: '',
  beschreibung: '', aufgaben: '', profil: '', wirBieten: '',
  verguetungVon: '', verguetungBis: '', verguetungZeit: 'monat',
  kontaktName: '', kontaktEmail: '',
}

const STAND_FARBE: Record<string, string> = {
  entwurf: 'bg-gray-100 text-gray-600',
  veroeffentlicht: 'bg-teal-50 text-teal-700',
  geschlossen: 'bg-gray-100 text-gray-400',
}
const STAND_TEXT: Record<string, string> = {
  entwurf: 'Entwurf', veroeffentlicht: 'Online', geschlossen: 'Geschlossen',
}

function zeilen(text: string): string[] {
  return text.split('\n').map(z => z.trim()).filter(Boolean)
}

export function Stellenliste({ karriereSlug }: { karriereSlug?: string | null }) {
  const [stellen, setStellen] = useState<Stelle[]>([])
  const [umfaenge, setUmfaenge] = useState<Record<string, string>>({})
  const [standorte, setStandorte] = useState<{ id: string; name: string }[]>([])
  const [laden, setLaden] = useState(true)
  const [formular, setFormular] = useState<typeof LEER | null>(null)
  const [bearbeitet, setBearbeitet] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [fehlt, setFehlt] = useState<string[]>([])
  const [speichert, setSpeichert] = useState(false)

  const holen = useCallback(async () => {
    const d = await fetch('/api/stellen').then(r => r.json()).catch(() => ({}))
    setStellen(d.stellen ?? [])
    setUmfaenge(d.umfaenge ?? {})
    setLaden(false)
  }, [])

  useEffect(() => {
    holen()
    fetch('/api/locations').then(r => r.json())
      .then(d => setStandorte(
        (d.locations ?? []).map((l: { id: string; name: string }) => ({
          id: l.id, name: l.name,
        })),
      ))
      .catch(() => undefined)
  }, [holen])

  async function speichern() {
    if (!formular) return
    setSpeichert(true); setFehler(null); setFehlt([])
    const koerper = {
      ...(bearbeitet ? { id: bearbeitet } : {}),
      titel: formular.titel,
      locationId: formular.locationId || null,
      ort: formular.ort, plz: formular.plz,
      umfang: formular.umfang,
      stundenProWoche: formular.stundenProWoche || null,
      befristung: formular.befristung,
      befristetBis: formular.befristetBis,
      beginn: formular.beginn,
      beschreibung: formular.beschreibung,
      aufgaben: zeilen(formular.aufgaben),
      profil: zeilen(formular.profil),
      wirBieten: zeilen(formular.wirBieten),
      verguetungVon: formular.verguetungVon || null,
      verguetungBis: formular.verguetungBis || null,
      verguetungZeit: formular.verguetungZeit,
      kontaktName: formular.kontaktName, kontaktEmail: formular.kontaktEmail,
    }
    const res = await fetch('/api/stellen', {
      method: bearbeitet ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(koerper),
    })
    const d = await res.json().catch(() => ({}))
    setSpeichert(false)
    if (!res.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
    setFormular(null); setBearbeitet(null)
    holen()
  }

  async function standSetzen(s: Stelle, status: string) {
    setFehler(null); setFehlt([])
    const res = await fetch('/api/stellen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, status }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      setFehler(d.error ?? 'Das hat nicht geklappt.')
      setFehlt(d.fehlt ?? [])
      return
    }
    holen()
  }

  async function loeschen(s: Stelle) {
    const res = await fetch(`/api/stellen?id=${s.id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
    holen()
  }

  function bearbeiten(s: Stelle) {
    setBearbeitet(s.id)
    setFormular({
      titel: s.titel, locationId: s.locationId ?? '', ort: s.ort ?? '',
      plz: s.plz ?? '', umfang: s.umfang,
      stundenProWoche: s.stundenProWoche ? String(s.stundenProWoche) : '',
      befristung: s.befristung, befristetBis: s.befristetBis ?? '',
      beginn: s.beginn ?? '', beschreibung: s.beschreibung,
      aufgaben: s.aufgaben.join('\n'), profil: s.profil.join('\n'),
      wirBieten: s.wirBieten.join('\n'),
      verguetungVon: s.verguetungVon ? String(s.verguetungVon) : '',
      verguetungBis: s.verguetungBis ? String(s.verguetungBis) : '',
      verguetungZeit: s.verguetungZeit,
      kontaktName: s.kontaktName ?? '', kontaktEmail: s.kontaktEmail ?? '',
    })
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
          {stellen.length === 0 ? 'Noch keine Anzeige angelegt.'
            : `${stellen.filter(s => s.status === 'veroeffentlicht').length} von `
              + `${stellen.length} online`}
        </p>
        <button
          onClick={() => { setBearbeitet(null); setFormular({ ...LEER }) }}
          className="flex items-center gap-1.5 bg-navy text-white text-xs
                     font-semibold px-3.5 py-2 rounded-lg">
          <Plus size={14} /> Stelle ausschreiben
        </button>
      </div>

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

      {formular && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-navy">
              {bearbeitet ? 'Anzeige bearbeiten' : 'Neue Anzeige'}
            </h3>
            <button onClick={() => { setFormular(null); setBearbeitet(null) }}
              className="text-gray-400" aria-label="Schließen"><X size={18} /></button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Feld label="Titel *" wert={formular.titel}
              setzen={v => setFormular(f => f && ({ ...f, titel: v }))}
              platzhalter="Erzieher:in (m/w/d)" />
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Standort</span>
              <select
                value={formular.locationId}
                onChange={e => setFormular(f => f && ({ ...f, locationId: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Unternehmensweit</option>
                {standorte.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <Feld label="Ort *" wert={formular.ort}
              setzen={v => setFormular(f => f && ({ ...f, ort: v }))}
              platzhalter="Köln" />
            <Feld label="PLZ" wert={formular.plz}
              setzen={v => setFormular(f => f && ({ ...f, plz: v }))} />
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Umfang</span>
              <select
                value={formular.umfang}
                onChange={e => setFormular(f => f && ({ ...f, umfang: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {Object.entries(umfaenge).map(([k, t]) => (
                  <option key={k} value={k}>{t}</option>
                ))}
              </select>
            </label>
            <Feld label="Stunden pro Woche" wert={formular.stundenProWoche}
              setzen={v => setFormular(f => f && ({ ...f, stundenProWoche: v }))}
              platzhalter="30" />
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Vertrag</span>
              <select
                value={formular.befristung}
                onChange={e => setFormular(f => f && ({ ...f, befristung: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="unbefristet">unbefristet</option>
                <option value="befristet">befristet</option>
              </select>
            </label>
            {formular.befristung === 'befristet' && (
              <Feld label="Befristet bis" wert={formular.befristetBis} typ="date"
                setzen={v => setFormular(f => f && ({ ...f, befristetBis: v }))} />
            )}
            <Feld label="Beginn" wert={formular.beginn}
              setzen={v => setFormular(f => f && ({ ...f, beginn: v }))}
              platzhalter="ab sofort / 01.03." />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <Feld label="Vergütung ab" wert={formular.verguetungVon}
              setzen={v => setFormular(f => f && ({ ...f, verguetungVon: v }))}
              platzhalter="3200" />
            <Feld label="bis" wert={formular.verguetungBis}
              setzen={v => setFormular(f => f && ({ ...f, verguetungBis: v }))}
              platzhalter="3800" />
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">je</span>
              <select
                value={formular.verguetungZeit}
                onChange={e => setFormular(f => f && ({ ...f, verguetungZeit: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="stunde">Stunde</option>
                <option value="monat">Monat</option>
                <option value="jahr">Jahr</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-gray-400 -mt-2">
            Eine Anzeige mit Gehaltsangabe wird deutlich häufiger angeklickt.
            Pflicht ist sie nicht.
          </p>

          <Bereich label="Beschreibung" wert={formular.beschreibung} zeilen={5}
            setzen={v => setFormular(f => f && ({ ...f, beschreibung: v }))}
            platzhalter="Ein paar Sätze über die Stelle, das Team, das Haus." />
          <div className="grid sm:grid-cols-3 gap-3">
            <Bereich label="Aufgaben (eine je Zeile)" wert={formular.aufgaben} zeilen={4}
              setzen={v => setFormular(f => f && ({ ...f, aufgaben: v }))} />
            <Bereich label="Profil (eine je Zeile)" wert={formular.profil} zeilen={4}
              setzen={v => setFormular(f => f && ({ ...f, profil: v }))} />
            <Bereich label="Wir bieten (eine je Zeile)" wert={formular.wirBieten} zeilen={4}
              setzen={v => setFormular(f => f && ({ ...f, wirBieten: v }))} />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Feld label="Ansprechpartner" wert={formular.kontaktName}
              setzen={v => setFormular(f => f && ({ ...f, kontaktName: v }))} />
            <Feld label="Kontakt-E-Mail" wert={formular.kontaktEmail}
              setzen={v => setFormular(f => f && ({ ...f, kontaktEmail: v }))} />
          </div>

          <button
            onClick={speichern} disabled={speichert}
            className="bg-teal-600 text-white text-sm font-semibold px-5 py-2.5
                       rounded-xl flex items-center gap-2 disabled:opacity-60">
            {speichert && <Loader2 size={14} className="animate-spin" />}
            {bearbeitet ? 'Änderungen speichern' : 'Als Entwurf anlegen'}
          </button>
        </div>
      )}

      <ul className="space-y-2.5">
        {stellen.map(s => (
          <li key={s.id} className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-navy">{s.titel}</h3>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full
                                    ${STAND_FARBE[s.status]}`}>
                    {STAND_TEXT[s.status]}
                  </span>
                  {s.offeneBewerbungen > 0 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full
                                     bg-amber-50 text-amber-700 flex items-center gap-1">
                      <Users2 size={11} /> {s.offeneBewerbungen} offen
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {[s.ort, umfaenge[s.umfang] ?? s.umfang,
                    s.stundenProWoche ? `${s.stundenProWoche} Std./Woche` : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {s.status === 'veroeffentlicht' && karriereSlug && (
                  <a
                    href={`/karriere/${karriereSlug}/${s.slug}`}
                    target="_blank" rel="noreferrer"
                    className="p-2 text-gray-400 hover:text-teal-600"
                    title="Anzeige ansehen">
                    <ExternalLink size={15} />
                  </a>
                )}
                <button onClick={() => bearbeiten(s)}
                  className="p-2 text-gray-400 hover:text-navy" title="Bearbeiten">
                  <FileEdit size={15} />
                </button>
                {s.status !== 'veroeffentlicht' ? (
                  <button onClick={() => standSetzen(s, 'veroeffentlicht')}
                    className="flex items-center gap-1.5 text-xs font-semibold
                               text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg">
                    <Globe size={13} /> Veröffentlichen
                  </button>
                ) : (
                  <button onClick={() => standSetzen(s, 'geschlossen')}
                    className="flex items-center gap-1.5 text-xs font-semibold
                               text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
                    <Archive size={13} /> Schließen
                  </button>
                )}
                {s.status === 'entwurf' && s.offeneBewerbungen === 0 && (
                  <button onClick={() => loeschen(s)}
                    className="p-2 text-gray-300 hover:text-red-600" title="Löschen">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Feld({ label, wert, setzen, platzhalter, typ = 'text' }: {
  label: string; wert: string; setzen: (v: string) => void
  platzhalter?: string; typ?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <input
        type={typ} value={wert} placeholder={platzhalter}
        onChange={e => setzen(e.target.value)}
        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                   focus:border-teal-500 focus:outline-none" />
    </label>
  )
}

function Bereich({ label, wert, setzen, platzhalter, zeilen: hoehe = 3 }: {
  label: string; wert: string; setzen: (v: string) => void
  platzhalter?: string; zeilen?: number
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <textarea
        rows={hoehe} value={wert} placeholder={platzhalter}
        onChange={e => setzen(e.target.value)}
        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                   focus:border-teal-500 focus:outline-none resize-y" />
    </label>
  )
}
