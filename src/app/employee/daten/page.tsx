'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Shield, FileDown, Download, Trash2, Loader2, Check, Clock, AlertTriangle, X,
} from 'lucide-react'

/**
 * §139 „Meine Daten" — Auskunft und Löschung, an einer Stelle in der App.
 *
 * ZWEI GRÜNDE, WARUM DIESE SEITE EXISTIERT
 *
 *   Art. 15, 17 und 20 DSGVO geben jedem das Recht zu erfahren, was gespeichert
 *   ist, es mitzunehmen und es löschen zu lassen. Bisher gab es die Auskunft
 *   nur als Link in einer Liste und die Löschung gar nicht für den Betroffenen
 *   selbst — sie musste jemand anders anstoßen.
 *
 *   Apple verlangt seit 2022, dass eine App, die ein Konto führt, das Löschen
 *   auch IN der App anbietet (Richtlinie 5.1.1 v). Ein Hinweis „schreiben Sie
 *   uns" genügt dort ausdrücklich nicht und ist ein häufiger Ablehnungsgrund.
 *
 * WARUM HIER KEIN KNOPF STEHT, DER SOFORT ALLES LÖSCHT
 * Weil das nicht erlaubt wäre. Lohnunterlagen müssen sechs Jahre aufbewahrt
 * werden (§147 AO, §257 HGB, §28f SGB IV) — unabhängig davon, was jemand
 * möchte. Ein Knopf, der sofort alles entfernt, verstieße gegen diese Pflichten
 * und risse der Person am Ende ihre eigene Lohnsteuerbescheinigung weg.
 *
 * Ehrlich ist deshalb: Der Antrag geht an den Arbeitgeber, der ihn mit dem
 * Löschkonzept (§128) abarbeitet. Was gelöscht wird, wird gelöscht; was bleiben
 * muss, wird gesperrt. Und die Person sieht hier, was daraus geworden ist.
 */

interface Antrag {
  id: string
  status: string
  begruendung: string | null
  antwort: string | null
  createdAt: string
  bearbeitetAm: string | null
}

const DATUM = (iso: string) => new Date(iso).toLocaleDateString('de-DE', {
  day: '2-digit', month: '2-digit', year: 'numeric',
})

export default function MeineDaten() {
  const [antraege, setAntraege] = useState<Antrag[]>([])
  const [laedt, setLaedt] = useState(true)
  const [maske, setMaske] = useState(false)
  const [grund, setGrund] = useState('')
  const [sendet, setSendet] = useState(false)
  const [fehler, setFehler] = useState('')

  const holen = useCallback(async () => {
    try {
      const r = await fetch('/api/dsgvo/loeschantrag')
      const d = await r.json().catch(() => ({}))
      setAntraege(d.antraege ?? [])
    } catch { /* ohne Netz bleibt die Liste leer */ }
    finally { setLaedt(false) }
  }, [])

  useEffect(() => { holen() }, [holen])

  const offen = antraege.find(a => a.status === 'offen')

  async function beantragen() {
    setSendet(true); setFehler('')
    try {
      const r = await fetch('/api/dsgvo/loeschantrag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ begruendung: grund.trim() || undefined }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFehler(d.error ?? 'Der Antrag konnte nicht gestellt werden.'); return }
      setMaske(false); setGrund('')
      await holen()
    } catch {
      setFehler('Keine Verbindung. Der Antrag wurde nicht gestellt.')
    } finally { setSendet(false) }
  }

  return (
    <div className="px-4 pt-4 pb-2 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-navy font-bold text-xl flex items-center gap-2">
          <Shield size={20} className="text-teal-600" /> Meine Daten
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Was über dich gespeichert ist, zum Nachlesen und zum Mitnehmen — und der
          Weg, es löschen zu lassen.
        </p>
      </div>

      {/* ── Auskunft ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <p className="text-sm font-semibold text-navy">Auskunft über meine Daten</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          Eine Übersicht, was gespeichert ist, wofür, wie lange es bleiben muss und
          woher es kommt. Das ist dein Recht aus Art. 15 DSGVO.
        </p>
        <div className="flex flex-col gap-2">
          <a
            href="/api/dsgvo/auskunft?format=pdf"
            target="_blank" rel="noreferrer"
            className="h-12 rounded-2xl bg-navy text-white font-semibold text-sm
                       flex items-center justify-center gap-2 active:scale-[0.98]
                       transition-transform"
          >
            <FileDown size={17} /> Auskunft als PDF
          </a>
          <a
            href="/api/dsgvo/auskunft"
            target="_blank" rel="noreferrer"
            className="h-12 rounded-2xl border border-gray-200 text-navy font-semibold
                       text-sm flex items-center justify-center gap-2 active:scale-[0.98]
                       transition-transform"
          >
            <Download size={17} /> Alle Daten zum Mitnehmen
          </a>
        </div>
        <p className="text-[11px] text-gray-400">
          Die zweite Datei ist für den Wechsel zu einem anderen Anbieter gedacht
          (Art. 20 DSGVO) — maschinenlesbar, nicht zum Schmökern.
        </p>
      </div>

      {/* ── Löschung ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <p className="text-sm font-semibold text-navy">Meine Daten löschen lassen</p>

        {laedt ? (
          <div className="h-12 flex items-center justify-center">
            <Loader2 size={18} className="animate-spin text-gray-300" />
          </div>
        ) : offen ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border
                          border-amber-200 p-3">
            <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-900">
                Dein Antrag vom {DATUM(offen.createdAt)} liegt vor.
              </p>
              <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
                Deine Standortleitung bearbeitet ihn. Du siehst hier, sobald das
                geschehen ist — und was gelöscht wurde.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 leading-relaxed">
              Du kannst verlangen, dass deine Daten gelöscht werden (Art. 17 DSGVO).
              Ein Teil davon <strong>muss</strong> allerdings bleiben: Lohnunterlagen
              sechs Jahre, Buchungsbelege zehn, Arbeitszeitnachweise zwei. Das ist
              keine Bequemlichkeit, sondern Steuer- und Sozialrecht — und es schützt
              auch dich, denn daraus kommt deine Lohnsteuerbescheinigung.
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Was bleiben muss, wird <strong>gesperrt</strong> statt gelöscht: Es wird
              nur noch für den Zweck verwendet, für den das Gesetz es verlangt. Alles
              andere verschwindet. Du bekommst darüber einen Bericht.
            </p>
            <button
              onClick={() => setMaske(true)}
              className="w-full h-12 rounded-2xl border border-red-200 text-red-700
                         font-semibold text-sm flex items-center justify-center gap-2
                         active:scale-[0.98] transition-transform"
            >
              <Trash2 size={17} /> Löschung beantragen
            </button>
          </>
        )}

        {/* Erledigte und abgelehnte Anträge bleiben sichtbar — sonst wüsste
            niemand mehr, dass er gefragt hat und was die Antwort war. */}
        {antraege.filter(a => a.status !== 'offen').map(a => (
          <div key={a.id} className="rounded-xl bg-gray-50 p-3 flex items-start gap-2.5">
            {a.status === 'erledigt'
              ? <Check size={16} className="text-green-600 shrink-0 mt-0.5" />
              : <AlertTriangle size={16} className="text-gray-400 shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-navy">
                Antrag vom {DATUM(a.createdAt)}
                {' — '}
                {a.status === 'erledigt' ? 'erledigt' : 'abgelehnt'}
                {a.bearbeitetAm ? ` am ${DATUM(a.bearbeitetAm)}` : ''}
              </p>
              {a.antwort && (
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{a.antwort}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Die Rückfrage vor dem Antrag ──────────────────────────────────── */}
      {maske && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center
                        justify-center p-0 sm:p-6">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5
                          space-y-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold text-navy">Löschung beantragen</p>
              <button onClick={() => setMaske(false)} aria-label="Schließen">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Der Antrag geht an deine Standortleitung. Solange du hier noch
              beschäftigt bist, kann sie ihn ablehnen — dann steht hier, warum.
              Nach dem Austritt wird gelöscht, was gelöscht werden darf.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Anmerkung (freiwillig)
              </label>
              <textarea
                value={grund}
                onChange={e => setGrund(e.target.value)}
                rows={3}
                placeholder="z. B. bis wann du eine Antwort brauchst"
                className="w-full text-base border border-gray-200 rounded-xl px-3 py-2.5"
              />
            </div>

            {fehler && <p className="text-xs text-amber-700">{fehler}</p>}

            <div className="flex gap-2.5">
              <button
                onClick={() => setMaske(false)}
                className="flex-1 h-12 rounded-2xl border border-gray-200 text-navy
                           font-semibold text-sm"
              >
                Abbrechen
              </button>
              <button
                onClick={beantragen}
                disabled={sendet}
                className="flex-1 h-12 rounded-2xl bg-red-600 text-white font-semibold
                           text-sm flex items-center justify-center gap-2
                           disabled:opacity-60"
              >
                {sendet ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                Beantragen
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center px-4">
        Fragen dazu beantwortet deine Standortleitung oder der Datenschutzbeauftragte
        deines Arbeitgebers.
      </p>
    </div>
  )
}
