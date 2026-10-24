'use client'

import { useState } from 'react'
import { Users, AlertTriangle, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import type { BelegschaftZeile, BelegschaftFehler } from '@/lib/belegschaft-import'

/**
 * §183 Die Belegschaft beim Einrichten einspielen.
 *
 * WARUM DAS HIER STEHT UND NICHT BEIM KUNDEN
 * Direkt unter dem Regelpaket, weil es dazugehört: Wer ein Regelwerk aufnimmt,
 * hat die Belegschaft ohnehin vor sich — Namen, Stunden, Gruppen,
 * Tagesmuster. Sie den Kunden abtippen zu lassen, bevor er den ersten Plan
 * rechnen kann, ist eine vermeidbare Fehlerquelle an der empfindlichsten
 * Stelle.
 *
 * ERST ZEIGEN, DANN ANLEGEN
 * Achtzehn Menschen auf einmal sind achtzehn Gelegenheiten, sich zu vertun.
 * Deshalb zwei Schritte: prüfen, hinsehen, anlegen. Und stimmt eine Zeile
 * nicht, wird keine einzige angelegt — eine halb eingelesene Belegschaft ist
 * schlimmer als keine.
 */

interface Props {
  locationId: string
  standortName: string
  gruppen: string[]
}

interface Antwort {
  gelesen: BelegschaftZeile[]
  fehler: BelegschaftFehler[]
  angelegt?: number
  geaendert?: number
  hinweis?: string
  error?: string
}

const BEISPIEL = `# Name; Stunden; Tage/Woche; Gruppe; Funktion; Muster; Frei; Vorliebe
Marin Berg; 40; 5; Gruppe 1; Erzieher; 5x8
Heike Stein; 30; 4; Gruppe 5; Erzieher; 3x8+1x6; Fr
Nicole Sprung; 25; 5; ; Springer; 5x5
Franke Leitner; 40; 5; ; Leitung`

export function BelegschaftEinspielen({ locationId, standortName, gruppen }: Props) {
  const [offen, setOffen] = useState(false)
  const [text, setText] = useState('')
  const [antwort, setAntwort] = useState<Antwort | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [fertig, setFertig] = useState<string | null>(null)

  async function senden(anlegen: boolean) {
    setLaeuft(true)
    setFertig(null)
    try {
      const res = await fetch('/api/okun/belegschaft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, text, anlegen }),
      })
      const d: Antwort = await res.json().catch(() => ({ gelesen: [], fehler: [] }))
      setAntwort(d)
      if (res.ok && anlegen) {
        setFertig(d.hinweis ?? 'Angelegt.')
      }
    } catch {
      setAntwort({ gelesen: [], fehler: [], error: 'Die Anfrage ist nicht durchgekommen.' })
    } finally {
      setLaeuft(false)
    }
  }

  const hatFehler = (antwort?.fehler?.length ?? 0) > 0
  const bereit = !hatFehler && (antwort?.gelesen?.length ?? 0) > 0

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60">
      <button
        onClick={() => setOffen(o => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Users size={14} className="shrink-0 text-gray-400" />
        <span className="text-xs font-semibold text-navy">Belegschaft einspielen</span>
        <span className="text-[11px] text-gray-400">
          Name, Stunden, Gruppe, Tagesmuster — alles, was die Planung braucht
        </span>
        <span className="ml-auto text-gray-400">
          {offen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {offen && (
        <div className="space-y-3 border-t border-gray-100 px-3 py-3">
          <p className="text-[11px] leading-relaxed text-gray-500">
            Eine Zeile je Person, Felder durch Semikolon getrennt. Angelegt wird
            nur, was die Planung braucht — Geburtsdatum, Steuermerkmale und
            E-Mail-Adresse trägt {standortName} selbst nach. Solange keine
            Adresse da ist, kann niemand eingeladen werden; das steht dann auch
            so in der Mitarbeiterliste.
          </p>

          {gruppen.length > 0 && (
            <p className="text-[11px] text-gray-500">
              Gruppen an diesem Standort: <span className="font-medium">{gruppen.join(', ')}</span>
            </p>
          )}

          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setAntwort(null); setFertig(null) }}
            rows={8}
            spellCheck={false}
            placeholder={BEISPIEL}
            className="w-full rounded-lg border border-gray-200 px-2.5 py-2 font-mono text-[11px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand/30"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => senden(false)}
              disabled={laeuft || !text.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40"
            >
              {laeuft && <Loader2 size={12} className="animate-spin" />}
              Prüfen
            </button>
            <button
              onClick={() => senden(true)}
              disabled={laeuft || !bereit}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              title={bereit ? '' : 'Erst prüfen — angelegt wird nur eine fehlerfreie Liste'}
            >
              {laeuft && <Loader2 size={12} className="animate-spin" />}
              Anlegen
            </button>
            {!text.trim() && (
              <button
                onClick={() => setText(BEISPIEL)}
                className="text-[11px] text-gray-400 underline"
              >
                Beispiel einsetzen
              </button>
            )}
          </div>

          {antwort?.error && (
            <p className="text-xs text-amber-900">{antwort.error}</p>
          )}

          {fertig && (
            <div className="flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 p-2.5">
              <Check size={14} className="mt-0.5 shrink-0 text-teal-600" />
              <p className="text-xs text-teal-900">{fertig}</p>
            </div>
          )}

          {hatFehler && (
            <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                <AlertTriangle size={13} />
                {antwort!.fehler.length} Zeile(n) stimmen nicht — es wurde nichts angelegt
              </p>
              {antwort!.fehler.map((f, i) => (
                <p key={i} className="text-[11px] leading-relaxed text-amber-900">
                  <span className="font-mono">Zeile {f.zeile}</span>: {f.text}
                  {f.roh && <span className="block font-mono text-amber-700/70">{f.roh}</span>}
                </p>
              ))}
            </div>
          )}

          {!hatFehler && (antwort?.gelesen?.length ?? 0) > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-[11px]">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    {['Name', 'Std.', 'Tage', 'Gruppe', 'Funktion', 'Muster', 'Frei', 'Vorliebe']
                      .map(h => <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {antwort!.gelesen.map(z => (
                    <tr key={z.zeile} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 font-medium text-navy">{z.name}</td>
                      <td className="px-2 py-1.5 tabular-nums">{z.stunden}</td>
                      <td className="px-2 py-1.5 tabular-nums">{z.tageProWoche}</td>
                      <td className="px-2 py-1.5">{z.gruppe ?? '—'}</td>
                      <td className="px-2 py-1.5">{z.funktion}</td>
                      <td className="px-2 py-1.5">
                        {z.muster
                          ? z.muster.map(m => `${m.tage}×${m.stunden}`).join(' + ')
                          : '—'}
                      </td>
                      <td className="px-2 py-1.5">{z.freieTage.join(', ') || '—'}</td>
                      <td className="px-2 py-1.5">{z.vorliebe ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
