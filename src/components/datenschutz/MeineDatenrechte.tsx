'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FileDown, Download, Trash2, Loader2, Check, Clock, AlertTriangle, X,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

/**
 * §140 Auskunft und Löschung — an EINER Stelle im Programm.
 *
 * WARUM DAS ZUSAMMENGELEGT WURDE
 * Es gab beides zweimal, und die beiden Fassungen widersprachen sich.
 *
 * Unter „Mein Konto" stand „Meine Daten exportieren — alle gespeicherten Daten
 * als JSON". Ausgegeben wurden vier Tabellen, gekappt bei 500 Zeilen. Der
 * Katalog aus §128 kennt fünfunddreißig. Eine Auskunft, die unvollständig ist
 * und sich vollständig nennt, ist schlimmer als gar keine: Sie sieht aus wie
 * die Erfüllung von Art. 15 DSGVO und ist es nicht.
 *
 * Daneben stand „Konto unwiderruflich löschen" — und der Knopf tat genau das:
 * Benutzerkonto weg, Name des Mitarbeiters überschrieben mit „Gelöschter
 * Mitarbeiter", ohne jede Prüfung. In einem Programm, das Löhne rechnet, ist
 * das gleich doppelt falsch. Das Lohnkonto muss sechs Jahre zuordenbar bleiben
 * (§41 EStG, §147 AO, §257 HGB, §28f SGB IV) — und dem Menschen selbst nimmt
 * es seine Lohnsteuerbescheinigung weg.
 *
 * Beides läuft jetzt über den Weg aus §128/§139: vollständige Auskunft aus dem
 * Katalog, und ein Löschantrag, den der Arbeitgeber mit Vorschau abarbeitet —
 * gelöscht wird, was gelöscht werden darf, gesperrt, was bleiben muss.
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

export function MeineDatenrechte() {
  const { user } = useAuth()
  const [antraege, setAntraege] = useState<Antrag[]>([])
  const [laedt, setLaedt] = useState(true)
  const [maske, setMaske] = useState(false)
  const [grund, setGrund] = useState('')
  const [sendet, setSendet] = useState(false)
  const [fehler, setFehler] = useState('')

  // Ein Zugang ohne Mitarbeiterdatensatz (etwa die Geschäftsführung) hat hier
  // nichts abzurufen. Ein Knopf, der dann „Kein Mitarbeiter angegeben"
  // zurückgibt, wäre eine Falle statt einer Auskunft.
  const hatAkte = !!user?.employeeId

  const holen = useCallback(async () => {
    if (!hatAkte) { setLaedt(false); return }
    try {
      const r = await fetch('/api/dsgvo/loeschantrag')
      const d = await r.json().catch(() => ({}))
      setAntraege(d.antraege ?? [])
    } catch { /* ohne Netz bleibt die Liste leer */ }
    finally { setLaedt(false) }
  }, [hatAkte])

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

  if (!hatAkte) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-sm font-semibold text-navy">Meine Daten</p>
        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
          Zu diesem Zugang gehört keine Personalakte — er dient der Verwaltung,
          nicht der eigenen Beschäftigung. Auskunft und Löschung betreffen deshalb
          nichts, was hier abrufbar wäre. Wenden Sie sich an den
          Datenschutzbeauftragten Ihres Unternehmens.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Auskunft ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <p className="text-sm font-semibold text-navy">Auskunft über meine Daten</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          Eine Übersicht, was gespeichert ist, wofür, wie lange es bleiben muss und
          woher es kommt — über alle Bereiche hinweg. Das ist Ihr Recht aus
          Art. 15 DSGVO.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <a
            href="/api/dsgvo/auskunft?format=pdf"
            target="_blank" rel="noreferrer"
            className="flex-1 h-12 rounded-2xl bg-navy text-white font-semibold text-sm
                       flex items-center justify-center gap-2 active:scale-[0.98]
                       transition-transform"
          >
            <FileDown size={17} /> Auskunft als PDF
          </a>
          <a
            href="/api/dsgvo/auskunft"
            target="_blank" rel="noreferrer"
            className="flex-1 h-12 rounded-2xl border border-gray-200 text-navy font-semibold
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

      {/* ── Löschung ────────────────────────────────────────────────────── */}
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
                Ihr Antrag vom {DATUM(offen.createdAt)} liegt vor.
              </p>
              <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
                Die Standortleitung bearbeitet ihn. Sie sehen hier, sobald das
                geschehen ist — und was gelöscht wurde.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 leading-relaxed">
              Sie können verlangen, dass Ihre Daten gelöscht werden (Art. 17 DSGVO).
              Ein Teil davon <strong>muss</strong> allerdings bleiben: Lohnunterlagen
              sechs Jahre, Buchungsbelege zehn, Arbeitszeitnachweise zwei. Das ist
              keine Bequemlichkeit, sondern Steuer- und Sozialrecht — und es schützt
              auch Sie, denn daraus kommt Ihre Lohnsteuerbescheinigung.
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Was bleiben muss, wird <strong>gesperrt</strong> statt gelöscht: Es wird
              nur noch für den Zweck verwendet, für den das Gesetz es verlangt. Alles
              andere verschwindet. Sie bekommen darüber einen Bericht.
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

      {/* ── Die Rückfrage vor dem Antrag ────────────────────────────────── */}
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
              Der Antrag geht an Ihre Standortleitung. Solange Sie hier noch
              beschäftigt sind, kann sie ihn ablehnen — dann steht hier, warum.
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
                placeholder="z. B. bis wann Sie eine Antwort brauchen"
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
    </div>
  )
}
