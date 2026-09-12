'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import {
  Stethoscope, Camera, Check, AlertTriangle, Loader2, FileText,
} from 'lucide-react'

/**
 * §137 Krankmelden vom Telefon.
 *
 * Bisher ging das nur über die Personalakte: Datei hochladen, Kategorie wählen,
 * Zeitraum eintragen — und die Fehlzeit selbst meldete jemand anders. Wer
 * morgens um halb sechs mit Fieber im Bett liegt, macht das nicht.
 *
 * Hier sind es zwei Angaben: seit wann, und voraussichtlich bis wann. Der Rest
 * ergibt sich. Die Bescheinigung kann gleich mit — oder später, wenn man sie
 * beim Arzt geholt hat.
 *
 * Was die App dabei von selbst weiß: ob überhaupt eine Bescheinigung nötig ist.
 * Das steht im Gesetz (§5 EntgFG: ab dem vierten Kalendertag) und im
 * Arbeitsvertrag (der Betrieb darf sie früher verlangen) — beides muss niemand
 * im Kopf haben, der gerade krank ist.
 */

const heuteStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const kalendertage = (von: string, bis: string) => {
  const a = Date.parse(`${von}T00:00:00Z`), b = Date.parse(`${bis}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
  return Math.round((b - a) / 86400000) + 1
}

export default function Krankmelden() {
  const { user } = useAuth()
  const [von, setVon] = useState(heuteStr())
  const [bis, setBis] = useState(heuteStr())
  const [notiz, setNotiz] = useState('')
  const [sendet, setSendet] = useState(false)
  const [fehler, setFehler] = useState('')
  const [fertig, setFertig] = useState<{ id: string; pflichtig: boolean; text: string } | null>(null)
  const [laedtHoch, setLaedtHoch] = useState(false)
  const [eingereicht, setEingereicht] = useState(false)
  const [locationId, setLocationId] = useState<string | null>(null)
  const dateiFeld = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user?.employeeId) return
    fetch('/api/employees')
      .then(r => r.json())
      .then(d => {
        const ich = (d.employees ?? []).find((e: { id: string }) => e.id === user.employeeId)
        setLocationId(ich?.locationId ?? user.locationId ?? null)
      })
      .catch(() => setLocationId(user.locationId ?? null))
  }, [user?.employeeId, user?.locationId])

  const tage = kalendertage(von, bis)

  const melden = useCallback(async () => {
    if (!user?.employeeId || !locationId) {
      setFehler('Für deinen Zugang ist kein Standort hinterlegt. Bitte bei der Leitung melden.')
      return
    }
    if (tage < 1) {
      setFehler('Das Ende liegt vor dem Anfang.')
      return
    }
    setSendet(true); setFehler('')
    try {
      const r = await fetch('/api/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: user.employeeId,
          employeeName: user.name,
          locationId,
          type: 'krankheit',
          startDate: von,
          endDate: bis,
          days: tage,
          note: notiz.trim() || undefined,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFehler(d.error ?? 'Die Meldung konnte nicht gespeichert werden.'); return }

      // Ob eine Bescheinigung nötig ist, sagt der Server — dort steht die
      // betriebliche Regelung. Im Zweifel lieber der Hinweis als keiner.
      const lage = await fetch(`/api/absences/${d.absence.id}/nachweise`)
        .then(x => x.json()).catch(() => null)
      setFertig({
        id: d.absence.id,
        pflichtig: lage?.lage?.pflicht?.pflichtig ?? tage >= 4,
        text: lage?.lage?.pflicht?.begruendung ?? '',
      })
    } catch {
      setFehler('Keine Verbindung. Die Meldung wurde nicht gespeichert.')
    } finally { setSendet(false) }
  }, [user, locationId, von, bis, tage, notiz])

  async function hochladen(datei: File) {
    if (!fertig || !user?.employeeId) return
    setLaedtHoch(true); setFehler('')
    try {
      const form = new FormData()
      form.append('datei', datei)
      form.append('ownerType', 'employee')
      form.append('ownerId', user.employeeId)
      form.append('kategorie', 'krankenschein')
      form.append('gueltigVon', von)
      form.append('gueltigBis', bis)
      // §130 Direkt der eben gemeldeten Fehlzeit zuordnen — dann muss das
      // niemand später von Hand zusammensuchen.
      form.append('absenceId', fertig.id)
      const r = await fetch('/api/files', { method: 'POST', body: form })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setFehler(d.error ?? 'Das Bild konnte nicht übertragen werden.')
        return
      }
      setEingereicht(true)
    } catch {
      setFehler('Keine Verbindung. Das Bild wurde nicht übertragen.')
    } finally {
      setLaedtHoch(false)
      if (dateiFeld.current) dateiFeld.current.value = ''
    }
  }

  // ── Nach der Meldung ─────────────────────────────────────────────────────
  if (fertig) {
    return (
      <div className="px-4 pt-4 pb-2 space-y-4 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <Check size={22} className="text-green-600" />
          </div>
          <p className="font-bold text-navy">Krankmeldung ist raus</p>
          <p className="text-sm text-gray-500 mt-1">
            Deine Standortleitung sieht sie jetzt. Gute Besserung.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <p className="text-sm font-semibold text-navy flex items-center gap-2">
            <FileText size={16} className="text-gray-400" />
            {fertig.pflichtig ? 'Bescheinigung nötig' : 'Bescheinigung nicht nötig'}
          </p>
          <p className="text-xs text-gray-500">{fertig.text}</p>

          {eingereicht ? (
            <p className="text-xs text-green-700 flex items-center gap-1.5">
              <Check size={14} /> Bescheinigung eingereicht und der Krankmeldung zugeordnet.
            </p>
          ) : (
            <>
              <input
                ref={dateiFeld}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) hochladen(f) }}
              />
              <button
                onClick={() => dateiFeld.current?.click()}
                disabled={laedtHoch}
                className="w-full h-12 rounded-2xl bg-brand text-navy font-semibold
                           flex items-center justify-center gap-2 active:scale-[0.98]
                           transition-transform disabled:opacity-60"
              >
                {laedtHoch
                  ? <Loader2 size={18} className="animate-spin" />
                  : <Camera size={18} />}
                Bescheinigung abfotografieren
              </button>
              <p className="text-[11px] text-gray-400 text-center">
                Geht auch später — du findest die Krankmeldung unter &bdquo;Ich&ldquo;.
              </p>
            </>
          )}

          {fehler && <p className="text-xs text-amber-700">{fehler}</p>}
        </div>
      </div>
    )
  }

  // ── Die Meldung ──────────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-4 pb-2 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-navy font-bold text-xl flex items-center gap-2">
          <Stethoscope size={20} className="text-purple-600" /> Krankmelden
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Zwei Angaben genügen. Die Bescheinigung kannst du gleich mitschicken oder später
          nachreichen.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
            Krank seit
          </label>
          <input
            type="date" value={von}
            onChange={e => { setVon(e.target.value); if (e.target.value > bis) setBis(e.target.value) }}
            className="w-full h-12 text-base border border-gray-200 rounded-xl px-3"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
            Voraussichtlich bis
          </label>
          <input
            type="date" value={bis} min={von}
            onChange={e => setBis(e.target.value)}
            className="w-full h-12 text-base border border-gray-200 rounded-xl px-3"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            {tage > 0
              ? `${tage} ${tage === 1 ? 'Kalendertag' : 'Kalendertage'}`
              : 'Das Ende liegt vor dem Anfang.'}
            {tage >= 4 && ' — dafür braucht es in der Regel eine Bescheinigung.'}
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
            Notiz (freiwillig)
          </label>
          <input
            value={notiz}
            onChange={e => setNotiz(e.target.value)}
            placeholder={'z. B. „bin beim Arzt, melde mich nachmittags“'}
            className="w-full h-12 text-base border border-gray-200 rounded-xl px-3"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Was dir fehlt, geht niemanden etwas an — die Diagnose gehört nicht hierher.
          </p>
        </div>

        {fehler && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3">
            <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900">{fehler}</p>
          </div>
        )}

        <button
          onClick={melden}
          disabled={sendet || tage < 1}
          className="w-full h-14 rounded-2xl bg-purple-600 text-white font-bold text-base
                     flex items-center justify-center gap-2 active:scale-[0.98]
                     transition-transform disabled:opacity-50"
        >
          {sendet ? <Loader2 size={20} className="animate-spin" /> : <Stethoscope size={20} />}
          Krankmeldung abschicken
        </button>
      </div>
    </div>
  )
}
