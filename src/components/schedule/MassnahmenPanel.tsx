'use client'
/**
 * §169 Maßnahmen entscheiden.
 *
 * Wenn der Rechendienst eine Gruppe nicht besetzen kann, plant er nichts
 * Halbgares, sondern schlägt vor: „Gruppe 7 am Donnerstag aufteilen." Hier
 * entscheidet ein Mensch darüber — genehmigen, ablehnen, einen Satz dazu
 * schreiben.
 *
 * WARUM DIE ENTSCHEIDUNG DEN NÄCHSTEN LAUF ÄNDERT
 * Eine genehmigte Aufteilung geht als Tatsache in die nächste Rechnung. Die
 * Gruppe muss dann nicht mehr besetzt werden, und der Rechendienst hört auf,
 * dieselbe Lücke jeden Morgen erneut zu melden.
 */
import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, Clock, MessageSquare, Loader } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'

export interface MassnahmenVorschlag {
  typ: string
  ziel: string
  tag: string
  text: string
}

type Status = 'offen' | 'genehmigt' | 'abgelehnt'

interface Gespeichert {
  typ: string
  ziel: string
  tag: string
  status: string
  kommentar: string | null
  entschiedenVon: string | null
  entschiedenAm: string | null
}

interface Props {
  locationId: string
  vorschlaege: MassnahmenVorschlag[]
  /** Hat der Rechendienst nachgerechnet, dass es damit aufgeht? */
  loest: boolean
  /** Klartextname der Gruppe oder Etage, falls auflösbar */
  nameFuer: (zielId: string) => string | undefined
}

const TYP_LABEL: Record<string, string> = {
  aufteilen: 'Gruppe aufteilen',
  frueh_entfaellt: 'Später öffnen',
  spaet_entfaellt: 'Früher schließen',
}

function schluessel(m: { typ: string; ziel: string; tag: string }) {
  return `${m.typ}|${m.ziel}|${m.tag}`
}

export function MassnahmenPanel({ locationId, vorschlaege, loest, nameFuer }: Props) {
  const [stand, setStand] = useState<Record<string, Gespeichert>>({})
  const [entwurf, setEntwurf] = useState<Record<string, string>>({})
  const [offenerKommentar, setOffenerKommentar] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState<string | null>(null)
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)

  const tage = vorschlaege.map(v => v.tag).sort()
  const von = tage[0]
  const bis = tage[tage.length - 1]

  const holen = useCallback(async () => {
    if (!locationId || !von || !bis) { setLaden(false); return }
    try {
      const r = await fetch(`/api/planning/massnahmen?locationId=${encodeURIComponent(locationId)}&von=${von}&bis=${bis}`)
      const d = await r.json()
      const karte: Record<string, Gespeichert> = {}
      for (const m of (d.massnahmen ?? []) as Gespeichert[]) karte[schluessel(m)] = m
      setStand(karte)
    } catch {
      // Ein fehlgeschlagener Abruf darf die Vorschläge nicht verstecken —
      // sie stehen dann eben alle als „offen" da.
    } finally {
      setLaden(false)
    }
  }, [locationId, von, bis])

  useEffect(() => { void holen() }, [holen])

  async function entscheiden(v: MassnahmenVorschlag, status: Status, kommentar?: string | null) {
    const k = schluessel(v)
    setLaeuft(k)
    setFehler(null)
    try {
      const r = await fetch('/api/planning/massnahmen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          typ: v.typ,
          ziel: v.ziel,
          zielName: nameFuer(v.ziel) ?? null,
          tag: v.tag,
          text: v.text,
          status,
          kommentar: kommentar ?? stand[k]?.kommentar ?? null,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        setFehler(d.error ?? 'Die Entscheidung konnte nicht gespeichert werden.')
        return
      }
      setStand(prev => ({ ...prev, [k]: d.massnahme as Gespeichert }))
      setOffenerKommentar(null)
    } catch {
      setFehler('Die Entscheidung konnte nicht gespeichert werden — keine Verbindung.')
    } finally {
      setLaeuft(null)
    }
  }

  if (vorschlaege.length === 0) return null

  const entschieden = vorschlaege.filter(v => (stand[schluessel(v)]?.status ?? 'offen') !== 'offen').length

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-3" data-test="massnahmen-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
            Maßnahmen zu entscheiden
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            {loest
              ? 'Der Rechendienst hat nachgerechnet: Mit diesen Maßnahmen geht der Plan auf.'
              : 'Auch mit diesen Maßnahmen bleiben Lücken — sie sind die beste erreichbare Lösung.'}
          </p>
        </div>
        <span className="text-[11px] font-semibold text-amber-700 whitespace-nowrap">
          {entschieden}/{vorschlaege.length} entschieden
        </span>
      </div>

      {fehler && (
        <p className="text-xs text-red-700 bg-red-50 rounded-lg px-2.5 py-1.5">{fehler}</p>
      )}

      {laden ? (
        <p className="text-xs text-amber-700">Lade bisherige Entscheidungen…</p>
      ) : (
        <div className="space-y-2">
          {vorschlaege.map(v => {
            const k = schluessel(v)
            const gespeichert = stand[k]
            const status = (gespeichert?.status ?? 'offen') as Status
            const busy = laeuft === k
            const name = nameFuer(v.ziel)
            return (
              <div
                key={k}
                className="rounded-lg bg-white border border-amber-100 px-3 py-2 space-y-2"
                data-test={`massnahme-${v.typ}-${v.tag}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                      {TYP_LABEL[v.typ] ?? v.typ}
                      {name ? ` · ${name}` : ''}
                    </p>
                    <p className="text-xs text-gray-800 mt-0.5">{v.text}</p>
                  </div>
                  <span
                    className={`flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap rounded-full px-2 py-0.5 ${
                      status === 'genehmigt' ? 'bg-green-50 text-green-700'
                        : status === 'abgelehnt' ? 'bg-red-50 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}
                    data-test={`massnahme-status-${v.typ}-${v.tag}`}
                  >
                    {status === 'genehmigt' ? <CheckCircle size={11} />
                      : status === 'abgelehnt' ? <XCircle size={11} />
                        : <Clock size={11} />}
                    {status === 'genehmigt' ? 'Genehmigt' : status === 'abgelehnt' ? 'Abgelehnt' : 'Offen'}
                  </span>
                </div>

                {gespeichert?.kommentar && offenerKommentar !== k && (
                  <p className="text-xs text-gray-600 bg-gray-50 rounded-md px-2 py-1.5">
                    &bdquo;{gespeichert.kommentar}&ldquo;
                  </p>
                )}

                {gespeichert?.entschiedenVon && (
                  <p className="text-[11px] text-gray-400">
                    {gespeichert.entschiedenVon}
                    {gespeichert.entschiedenAm
                      ? ` · ${new Date(gespeichert.entschiedenAm).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`
                      : ''}
                  </p>
                )}

                {offenerKommentar === k && (
                  <div className="space-y-1.5">
                    <Textarea
                      rows={2}
                      value={entwurf[k] ?? gespeichert?.kommentar ?? ''}
                      onChange={e => setEntwurf(prev => ({ ...prev, [k]: e.target.value }))}
                      placeholder="Warum so entschieden? Der Satz steht in vier Wochen noch da."
                      data-test={`massnahme-kommentar-${v.typ}-${v.tag}`}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => entscheiden(v, status, entwurf[k] ?? '')}
                        disabled={busy}
                      >
                        Notiz speichern
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOffenerKommentar(null)}>
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 items-center">
                  {busy && <Loader size={12} className="animate-spin text-gray-400" />}
                  <button
                    onClick={() => entscheiden(v, 'genehmigt')}
                    disabled={busy || status === 'genehmigt'}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-40 disabled:hover:bg-transparent"
                    data-test={`massnahme-genehmigen-${v.typ}-${v.tag}`}
                  >
                    <CheckCircle size={11} /> Genehmigen
                  </button>
                  <button
                    onClick={() => entscheiden(v, 'abgelehnt')}
                    disabled={busy || status === 'abgelehnt'}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent"
                    data-test={`massnahme-ablehnen-${v.typ}-${v.tag}`}
                  >
                    <XCircle size={11} /> Ablehnen
                  </button>
                  {status !== 'offen' && (
                    <button
                      onClick={() => entscheiden(v, 'offen')}
                      disabled={busy}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      data-test={`massnahme-zuruecknehmen-${v.typ}-${v.tag}`}
                    >
                      <Clock size={11} /> Zurücknehmen
                    </button>
                  )}
                  <button
                    onClick={() => setOffenerKommentar(offenerKommentar === k ? null : k)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
                    data-test={`massnahme-notiz-${v.typ}-${v.tag}`}
                  >
                    <MessageSquare size={11} /> {gespeichert?.kommentar ? 'Notiz ändern' : 'Notiz'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[11px] text-amber-700">
        Genehmigte Maßnahmen gelten für den Tag, nicht für den Rechenlauf — beim
        nächsten Planen nach einer Krankmeldung stehen sie noch.
      </p>
    </div>
  )
}
