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
import { direktHochladen } from '@/lib/datei-direkt'
import { bildVerkleinern } from '@/lib/bild-verkleinern'
import { dateiSichern } from '@/lib/datei-oeffnen'
import { Bildschau } from '@/components/ui/Bildschau'
import { FileText, Upload, Trash2, Eye, EyeOff, Loader2, Image as ImageIcon, Download, Link2, Stethoscope } from 'lucide-react'

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
  absenceId?: string | null
  createdAt: string
}

// §130 Die Fehlzeiten der Person — eine Krankmeldung gehoert zu einer von ihnen.
interface Fehlzeit {
  id: string
  type: string
  startDate: string
  endDate: string
  days: number
}

const NACHWEISPFLICHTIG = ['krankheit', 'krank']

const kurz = (iso: string) => iso.split('-').reverse().join('.')

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
  // §263 Welches Bild gerade groß zu sehen ist — oder keines.
  const [schau, setSchau] = useState<{ adresse: string; name: string } | null>(null)
  const [kategorie, setKategorie] = useState(verwalten ? 'vertrag' : 'krankenschein')
  const dateiFeld = useRef<HTMLInputElement>(null)

  // §130 Krankmeldung und Fehlzeit gehoeren zusammen. Beim Einreichen wird der
  // Zeitraum der Bescheinigung mitgegeben — damit ordnet der Server sie der
  // richtigen Fehlzeit zu, ohne dass jemand zwei Listen vergleichen muss.
  const [gueltigVon, setGueltigVon] = useState('')
  const [gueltigBis, setGueltigBis] = useState('')
  const [fehlzeiten, setFehlzeiten] = useState<Fehlzeit[]>([])

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

  useEffect(() => {
    if (ownerType !== 'employee') return
    fetch(`/api/absences?employeeId=${ownerId}`)
      .then(r => r.ok ? r.json() : { absences: [] })
      .then(d => setFehlzeiten(
        (d.absences ?? []).filter((a: Fehlzeit) => NACHWEISPFLICHTIG.includes(a.type)),
      ))
      .catch(() => setFehlzeiten([]))
  }, [ownerType, ownerId])

  /**
   * §261 Was nach dem Hochladen für beide Wege gleich ist — der direkte in
   * den Objektspeicher und der alte durch die Anwendung.
   */
  const uebernehmen = (d: {
    datei: Datei
    zuordnung?: { zugeordnet: string | null; vorschlaege: unknown[] }
  }) => {
    setDateien(prev => [d.datei, ...prev])
    setGueltigVon(''); setGueltigBis('')

    // Der Hinweis sagt, was tatsaechlich passiert ist. "Eingereicht" allein
    // laesst offen, ob die Bescheinigung auch angekommen ist, wo sie hin soll.
    if (d.zuordnung?.zugeordnet) {
      showToast('Eingereicht und der passenden Fehlzeit zugeordnet', 'success')
    } else if (kategorie === 'krankenschein' && (d.zuordnung?.vorschlaege?.length ?? 0) > 0) {
      showToast('Eingereicht — bitte unten noch die Fehlzeit auswählen', 'success')
    } else {
      showToast(verwalten ? 'Dokument abgelegt' : 'Eingereicht — die Leitung sieht es jetzt', 'success')
    }
  }

  /**
   * §263 Eine Unterlage öffnen — ohne die App zu verlassen.
   *
   * Ein Bild geht in die Bildschau: Dort lässt es sich vergrößern, und genau
   * das war die Meldung („man kann das Bild nicht richtig schön vergrößern").
   * Alles andere wird gesichert, ohne dass eine fremde Adresse angesteuert
   * wird.
   */
  const oeffnen = async (d: Datei) => {
    const adresse = `/api/files/${d.id}`
    if (d.mimeType.startsWith('image/')) {
      setSchau({ adresse, name: d.dateiname })
      return
    }
    if (await dateiSichern(adresse, d.dateiname) === 'fehlgeschlagen') {
      showToast('Die Datei ließ sich nicht öffnen.', 'error')
    }
  }

  const hochladen = async (roh: File) => {
    setLaedtHoch(true)
    try {
      /*
       * §262 Auch hier verkleinern, nicht nur beim Einreichen durch den
       * Mitarbeiter (§249).
       *
       * Hier legt die Leitung ab, was sie gerade abfotografiert hat — ein
       * Zeugnis, eine Bescheinigung vom Träger. Aus einer Telefonkamera sind
       * das drei bis fünf Megabyte; danach ein paar hundert Kilobyte. Und bei
       * HEIC vom iPhone ist es zugleich die Umwandlung in ein Format, das
       * überall angenommen wird. Dass das an der einen Stelle geschah und an
       * der anderen nicht, war schlicht übersehen.
       */
      const datei = await bildVerkleinern(roh)
      const kontext = { ownerType, ownerId, kategorie }
      const zusatz: Record<string, string> = {}
      if (kategorie === 'krankenschein') {
        if (gueltigVon) zusatz.gueltigVon = gueltigVon
        if (gueltigBis) zusatz.gueltigBis = gueltigBis
      }

      /*
       * §261 Zuerst der direkte Weg in den Objektspeicher. Ist keiner
       * eingerichtet oder kommt er nicht durch, läuft unten der alte Weg
       * weiter — eine Umstellung, die ohne Einrichtung das Hochladen anhält,
       * wäre schlimmer als der Zustand vorher.
       */
      const direkt = await direktHochladen({
        adressePfad: '/api/files/adresse',
        vermerkPfad: '/api/files',
        datei, kontext, zusatz,
      })
      if (direkt.art === 'abgewiesen') { showToast(direkt.fehler, 'error'); return }
      if (direkt.art === 'ok') {
        uebernehmen(direkt.antwort as unknown as Parameters<typeof uebernehmen>[0])
        return
      }

      const form = new FormData()
      form.append('datei', datei)
      form.append('ownerType', ownerType)
      form.append('ownerId', ownerId)
      form.append('kategorie', kategorie)
      for (const [k, v] of Object.entries(zusatz)) form.append(k, v)
      const res = await fetch('/api/files', { method: 'POST', body: form })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(d.error ?? 'Hochladen fehlgeschlagen', 'error'); return }
      uebernehmen(d)
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

  const zuordnen = async (d: Datei, absenceId: string | null) => {
    const res = await fetch(`/api/files/${d.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ absenceId }),
    })
    if (!res.ok) {
      const f = await res.json().catch(() => ({}))
      showToast(f.error ?? 'Zuordnung fehlgeschlagen', 'error')
      return
    }
    setDateien(prev => prev.map(x => x.id === d.id ? { ...x, absenceId } : x))
    showToast(absenceId ? 'Der Fehlzeit zugeordnet' : 'Zuordnung gelöst', 'success')
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

      {/*
        §130 Der Zeitraum der Bescheinigung. Ohne ihn laesst sich nicht sagen,
        ob eine Fehlzeit gedeckt ist — eine dreiwoechige Krankheit mit einer
        Bescheinigung ueber eine Woche saehe sonst genauso aus wie eine
        vollstaendig belegte.
      */}
      {kategorie === 'krankenschein' && (
        <div className="flex flex-wrap items-end gap-2 mb-4 -mt-2">
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">
              Arbeitsunfähig von
            </label>
            <input
              type="date" value={gueltigVon} onChange={e => setGueltigVon(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">
              bis
            </label>
            <input
              type="date" value={gueltigBis} onChange={e => setGueltigBis(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
          </div>
          <span className="text-[11px] text-gray-400 pb-1.5">
            Steht auf der Bescheinigung. Damit wird sie der richtigen Fehlzeit zugeordnet.
          </span>
        </div>
      )}

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
                    {/*
                      * §263 Knopf statt Verweis — siehe `Bildschau`.
                      *
                      * Seit §260 leitet `/api/files/<id>` in den
                      * Objektspeicher um, also auf eine fremde Adresse. iOS
                      * holt eine installierte App dafür aus dem Vollbild in
                      * einen Browser mit Adresszeile. Ein Bild öffnet sich
                      * jetzt in der App, alles andere wird gesichert.
                      */}
                    <button
                      type="button"
                      onClick={() => oeffnen(d)}
                      className="text-sm font-medium text-navy hover:text-brand truncate text-left"
                    >
                      {d.dateiname}
                    </button>
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
                    {d.gueltigVon && d.gueltigBis
                      ? ` · arbeitsunfähig ${kurz(d.gueltigVon)}–${kurz(d.gueltigBis)}`
                      : ''}
                  </p>

                  {/* §130 Wozu diese Krankmeldung gehoert */}
                  {d.kategorie === 'krankenschein' && ownerType === 'employee' && (
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Link2 size={11} className="text-gray-400 shrink-0" />
                      <select
                        value={d.absenceId ?? ''}
                        onChange={e => zuordnen(d, e.target.value || null)}
                        className="text-[11px] border border-gray-200 rounded-lg px-1.5 py-0.5 max-w-full"
                      >
                        <option value="">— keiner Fehlzeit zugeordnet —</option>
                        {fehlzeiten.map(f => (
                          <option key={f.id} value={f.id}>
                            {kurz(f.startDate)}–{kurz(f.endDate)} ({f.days} Tage)
                          </option>
                        ))}
                      </select>
                      {!d.absenceId && fehlzeiten.length === 0 && (
                        <span className="text-[10px] text-amber-700">
                          Für diese Zeit ist noch keine Fehlzeit gemeldet.
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => oeffnen(d)}
                    title="Öffnen"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-brand hover:bg-gray-50 transition-colors"
                  >
                    <Download size={13} />
                  </button>
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

      {schau && (
        <Bildschau
          adresse={schau.adresse}
          name={schau.name}
          onSchliessen={() => setSchau(null)}
          onHerunterladen={() => { dateiSichern(schau.adresse, schau.name) }}
        />
      )}
    </div>
  )
}
