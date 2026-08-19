'use client'

// §100 Personalakte — Dokumente eines Mitarbeiters oder eines Standorts.
//
// Dieselbe Komponente dient beiden Seiten:
//   verwalten = true   Leitung: hochladen, freigeben, löschen
//   verwalten = false  Mitarbeiter: eigene Unterlagen sehen, Krankmeldung einreichen
//
// Was der Mitarbeiter zu sehen bekommt, entscheidet der Server (file-storage.ts),
// nicht diese Oberfläche. Sichtbarkeit im Browser ist kein Schutz.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/lib/toast-context'
import { FileText, Upload, Trash2, Eye, EyeOff, Loader2, Image as ImageIcon, Download } from 'lucide-react'

interface Datei {
  id: string
  kategorie: string
  dateiname: string
  mimeType: string
  groesse: number
  sichtbarFuerMitarbeiter: boolean
  hochgeladenVonName?: string | null
  notiz?: string | null
  gueltigVon?: string | null
  gueltigBis?: string | null
  createdAt: string
}

const KATEGORIE_TEXT: Record<string, string> = {
  vertrag: 'Arbeitsvertrag',
  zeugnis: 'Zeugnis',
  bescheinigung: 'Bescheinigung',
  krankenschein: 'Krankmeldung',
  lohnabrechnung: 'Lohnabrechnung',
  sonstiges: 'Sonstiges',
}

/** Kategorien, die der jeweilige Nutzer anlegen darf — spiegelt den Server. */
const KATEGORIEN_LEITUNG = ['vertrag', 'zeugnis', 'bescheinigung', 'krankenschein', 'lohnabrechnung', 'sonstiges']
const KATEGORIEN_MITARBEITER = ['krankenschein', 'bescheinigung']

function groesseText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function datumText(iso: string): string {
  try { return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return iso }
}

export function Personalakte({
  ownerType = 'employee',
  ownerId,
  verwalten,
  titel = 'Personalakte',
}: {
  ownerType?: 'employee' | 'location'
  ownerId: string
  verwalten: boolean
  titel?: string
}) {
  const { showToast } = useToast()
  const [dateien, setDateien] = useState<Datei[]>([])
  const [laden, setLaden] = useState(true)
  const [laedtHoch, setLaedtHoch] = useState(false)
  const [kategorie, setKategorie] = useState(verwalten ? 'vertrag' : 'krankenschein')
  const dateiFeld = useRef<HTMLInputElement>(null)

  const kategorien = verwalten ? KATEGORIEN_LEITUNG : KATEGORIEN_MITARBEITER

  const laden_ = useCallback(async () => {
    setLaden(true)
    try {
      const res = await fetch(`/api/files?ownerType=${ownerType}&ownerId=${ownerId}`)
      const d = await res.json()
      setDateien(res.ok ? (d.dateien ?? []) : [])
    } catch { setDateien([]) }
    setLaden(false)
  }, [ownerType, ownerId])

  useEffect(() => { laden_() }, [laden_])

  const hochladen = async (datei: File) => {
    setLaedtHoch(true)
    try {
      const form = new FormData()
      form.append('datei', datei)
      form.append('ownerType', ownerType)
      form.append('ownerId', ownerId)
      form.append('kategorie', kategorie)
      const res = await fetch('/api/files', { method: 'POST', body: form })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(d.error ?? 'Hochladen fehlgeschlagen', 'error'); return }
      setDateien(prev => [d.datei, ...prev])
      showToast(verwalten ? 'Dokument abgelegt' : 'Eingereicht — die Leitung sieht es jetzt', 'success')
    } catch {
      showToast('Hochladen fehlgeschlagen', 'error')
    } finally {
      setLaedtHoch(false)
      if (dateiFeld.current) dateiFeld.current.value = ''
    }
  }

  const freigabeUmschalten = async (d: Datei) => {
    const neu = !d.sichtbarFuerMitarbeiter
    const res = await fetch(`/api/files/${d.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sichtbarFuerMitarbeiter: neu }),
    })
    if (!res.ok) { showToast('Änderung fehlgeschlagen', 'error'); return }
    setDateien(prev => prev.map(x => x.id === d.id ? { ...x, sichtbarFuerMitarbeiter: neu } : x))
    showToast(neu ? 'Für den Mitarbeiter sichtbar' : 'Nicht mehr sichtbar', 'success')
  }

  const loeschen = async (d: Datei) => {
    if (!confirm(`„${d.dateiname}“ wirklich aus der Akte entfernen?`)) return
    const res = await fetch(`/api/files/${d.id}`, { method: 'DELETE' })
    if (!res.ok) { showToast('Löschen fehlgeschlagen', 'error'); return }
    setDateien(prev => prev.filter(x => x.id !== d.id))
    showToast('Entfernt', 'success')
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-sm font-semibold text-navy">{titel}</p>
        <span className="text-[11px] text-gray-400">{dateien.length} Dokument{dateien.length === 1 ? '' : 'e'}</span>
      </div>
      <p className="text-[11px] text-gray-400 mb-3">
        {verwalten
          ? 'Arbeitsvertrag, Zeugnisse, Bescheinigungen und Krankmeldungen. Vertrag und Lohnabrechnung sieht der Mitarbeiter automatisch; alles andere nur nach Freigabe.'
          : 'Deine Unterlagen. Krankmeldungen kannst du hier einreichen.'}
      </p>

      {/* Hochladen */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={kategorie}
          onChange={e => setKategorie(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          {kategorien.map(k => <option key={k} value={k}>{KATEGORIE_TEXT[k]}</option>)}
        </select>
        <input
          ref={dateiFeld}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/heic,image/webp"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) hochladen(f) }}
        />
        <Button size="sm" onClick={() => dateiFeld.current?.click()} disabled={laedtHoch} className="gap-1.5">
          {laedtHoch ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {verwalten ? 'Dokument hinzufügen' : 'Einreichen'}
        </Button>
        <span className="text-[11px] text-gray-400">PDF oder Bild, max. 10 MB</span>
      </div>

      {/* Liste */}
      {laden ? (
        <p className="text-xs text-gray-400">Wird geladen…</p>
      ) : dateien.length === 0 ? (
        <p className="text-xs text-gray-400">Noch keine Dokumente abgelegt.</p>
      ) : (
        <div className="space-y-2">
          {dateien.map(d => {
            const istBild = d.mimeType.startsWith('image/')
            return (
              <div key={d.id} className="flex items-center gap-2.5 border border-gray-100 rounded-xl px-3 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                  {istBild
                    ? <ImageIcon size={14} className="text-gray-400" />
                    : <FileText size={14} className="text-gray-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <a
                      href={`/api/files/${d.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-navy hover:text-brand truncate"
                    >
                      {d.dateiname}
                    </a>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                      {KATEGORIE_TEXT[d.kategorie] ?? d.kategorie}
                    </span>
                    {verwalten && d.sichtbarFuerMitarbeiter && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 flex-shrink-0">
                        sichtbar
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {datumText(d.createdAt)} · {groesseText(d.groesse)}
                    {d.hochgeladenVonName ? ` · ${d.hochgeladenVonName}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a
                    href={`/api/files/${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Öffnen"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-brand hover:bg-gray-50 transition-colors"
                  >
                    <Download size={13} />
                  </a>
                  {verwalten && (
                    <>
                      <button
                        onClick={() => freigabeUmschalten(d)}
                        title={d.sichtbarFuerMitarbeiter ? 'Für den Mitarbeiter verbergen' : 'Für den Mitarbeiter freigeben'}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                      >
                        {d.sichtbarFuerMitarbeiter ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button
                        onClick={() => loeschen(d)}
                        title="Aus der Akte entfernen"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
