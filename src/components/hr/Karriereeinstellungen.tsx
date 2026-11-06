'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Globe, Copy, Check, Rss, Lock } from 'lucide-react'

/**
 * §148 Die Karriereseite einrichten.
 *
 * WARUM DER SCHALTER UNTEN STEHT UND NICHT OBEN
 * Weil er das Letzte ist, was man drückt. Darüber steht, was die Seite
 * braucht — und solange etwas fehlt, sagt der Server beim Einschalten, was.
 *
 * WARUM DER FEED-LINK HIER STEHT
 * Weil ihn sonst niemand findet. Er ist der Weg zu Indeed, StepStone und der
 * Bundesagentur: Man trägt die Adresse dort einmal ein, und ab da holen sie
 * sich die Anzeigen selbst.
 */

interface Einstellungen {
  karriereSlug: string | null
  karriereAktiv: boolean
  karriereUeberschrift: string | null
  karriereText: string | null
  karriereEmail: string | null
  karriereImpressum: string | null
  karriereDatenschutz: string | null
  organizationName: string
}

export function Karriereeinstellungen({ beimSpeichern }: {
  beimSpeichern?: (slug: string | null, aktiv: boolean) => void
}) {
  const [e, setE] = useState<Einstellungen | null>(null)
  const [darf, setDarf] = useState(false)
  const [fehlt, setFehlt] = useState<string[]>([])
  const [fehler, setFehler] = useState<string | null>(null)
  const [speichert, setSpeichert] = useState(false)
  const [kopiert, setKopiert] = useState<string | null>(null)

  const holen = useCallback(async () => {
    const d = await fetch('/api/karriere-einstellungen').then(r => r.json())
      .catch(() => ({}))
    if (d.einstellungen) {
      setE({
        ...d.einstellungen,
        karriereSlug: d.einstellungen.karriereSlug ?? d.vorschlag ?? '',
      })
    }
    setDarf(!!d.darfAendern)
    setFehlt(d.fehlt ?? [])
  }, [])

  useEffect(() => { holen() }, [holen])

  async function speichern(zusatz: Partial<Einstellungen> = {}) {
    if (!e) return
    setSpeichert(true); setFehler(null); setFehlt([])
    const res = await fetch('/api/karriere-einstellungen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        karriereSlug: e.karriereSlug,
        karriereUeberschrift: e.karriereUeberschrift,
        karriereText: e.karriereText,
        karriereEmail: e.karriereEmail,
        karriereImpressum: e.karriereImpressum,
        karriereDatenschutz: e.karriereDatenschutz,
        ...zusatz,
      }),
    })
    const d = await res.json().catch(() => ({}))
    setSpeichert(false)
    if (!res.ok) {
      setFehler(d.error ?? 'Das hat nicht geklappt.')
      setFehlt(d.fehlt ?? [])
      return
    }
    setE(v => v && ({ ...v, ...d.einstellungen }))
    setFehlt(d.fehlt ?? [])
    beimSpeichern?.(d.einstellungen.karriereSlug, d.einstellungen.karriereAktiv)
  }

  function kopieren(text: string, was: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setKopiert(was)
      setTimeout(() => setKopiert(null), 2000)
    }).catch(() => undefined)
  }

  if (!e) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-gray-300" />
      </div>
    )
  }

  const basis = typeof window !== 'undefined' ? window.location.origin : ''
  const link = e.karriereSlug ? `${basis}/karriere/${e.karriereSlug}` : null
  const feed = link ? `${link}/stellen.xml` : null

  return (
    <div className="space-y-4 max-w-2xl">
      {!darf && (
        <p className="flex items-start gap-2 text-sm text-gray-500 bg-gray-50
                      border border-gray-200 rounded-xl px-4 py-3">
          <Lock size={15} className="shrink-0 mt-0.5" />
          Die öffentliche Seite des Trägers richtet die Unternehmensebene ein.
          Stellen ausschreiben kannst du trotzdem.
        </p>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div>
          <span className="text-xs font-semibold text-gray-500">Adresse der Seite</span>
          <div className="flex items-center mt-1 border border-gray-300 rounded-lg
                          overflow-hidden">
            <span className="text-sm text-gray-400 px-3 py-2 bg-gray-50 shrink-0
                             border-r border-gray-200 truncate">
              {basis}/karriere/
            </span>
            <input
              value={e.karriereSlug ?? ''} disabled={!darf}
              onChange={ev => setE(v => v && ({ ...v, karriereSlug: ev.target.value }))}
              className="flex-1 px-3 py-2 text-sm focus:outline-none disabled:bg-gray-50" />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Kleinbuchstaben und Bindestriche. Umlaute werden ausgeschrieben.
          </p>
        </div>

        <Feld label="Überschrift" wert={e.karriereUeberschrift ?? ''} lesen={!darf}
          platzhalter={`Arbeiten bei ${e.organizationName}`}
          setzen={v => setE(x => x && ({ ...x, karriereUeberschrift: v }))} />

        <Bereich label="Über uns" wert={e.karriereText ?? ''} lesen={!darf} zeilen={5}
          platzhalter="Wer ihr seid, wofür ihr steht, warum man bei euch arbeiten will."
          setzen={v => setE(x => x && ({ ...x, karriereText: v }))} />

        <Feld label="Bewerbungen melden an" wert={e.karriereEmail ?? ''} lesen={!darf}
          platzhalter="leer = die allgemeine Benachrichtigungsadresse"
          setzen={v => setE(x => x && ({ ...x, karriereEmail: v }))} />

        <Bereich
          label="Impressum *" wert={e.karriereImpressum ?? ''} lesen={!darf} zeilen={6}
          platzhalter={'Träger e.V.\nMusterweg 1, 50667 Köln\nVertreten durch: …\n'
            + 'Telefon: …\nE-Mail: …\nRegistergericht: …'}
          setzen={v => setE(x => x && ({ ...x, karriereImpressum: v }))} />
        <p className="text-xs text-gray-400 -mt-2">
          Pflicht nach §5 DDG. Ohne Impressum geht die Seite nicht online.
        </p>

        <Bereich
          label="Datenschutz (Ergänzung)" wert={e.karriereDatenschutz ?? ''}
          lesen={!darf} zeilen={4}
          platzhalter="Verantwortlicher, Datenschutzbeauftragter, Aufsichtsbehörde. Der
Teil über die Bewerbungsdaten steht schon fest drin."
          setzen={v => setE(x => x && ({ ...x, karriereDatenschutz: v }))} />

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

        {darf && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button onClick={() => speichern()} disabled={speichert}
              className="bg-navy text-white text-sm font-semibold px-5 py-2.5
                         rounded-xl flex items-center gap-2 disabled:opacity-60">
              {speichert && <Loader2 size={14} className="animate-spin" />} Speichern
            </button>
            <button
              onClick={() => speichern({ karriereAktiv: !e.karriereAktiv })}
              disabled={speichert}
              className={`text-sm font-semibold px-5 py-2.5 rounded-xl
                          flex items-center gap-2 disabled:opacity-60
                          ${e.karriereAktiv
                ? 'bg-gray-100 text-gray-600' : 'bg-teal-600 text-white'}`}>
              <Globe size={15} />
              {e.karriereAktiv ? 'Seite abschalten' : 'Seite online stellen'}
            </button>
          </div>
        )}
      </div>

      {e.karriereAktiv && link && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-navy flex items-center gap-2">
            <Globe size={15} className="text-teal-600" /> Die Seite ist online.
          </p>
          <Zeile text={link} beschriftung="Link zum Teilen"
            kopiert={kopiert === 'link'} kopieren={() => kopieren(link, 'link')} />
          <Zeile text={feed!} beschriftung="Feed für Indeed, StepStone & Co." symbol
            kopiert={kopiert === 'feed'} kopieren={() => kopieren(feed!, 'feed')} />
          <p className="text-xs text-gray-400">
            Den Feed trägt man bei der Börse einmal ein; danach holt sie sich die
            Anzeigen selbst. Google for Jobs braucht nichts davon — es liest die
            Anzeigen direkt von der Seite.
          </p>
        </div>
      )}
    </div>
  )
}

function Zeile({ text, beschriftung, kopieren, kopiert, symbol }: {
  text: string; beschriftung: string; kopieren: () => void
  kopiert: boolean; symbol?: boolean
}) {
  return (
    <div>
      <span className="text-xs font-semibold text-gray-500">{beschriftung}</span>
      <div className="flex items-center gap-2 mt-1">
        {symbol && <Rss size={14} className="text-gray-400 shrink-0" />}
        <a href={text} target="_blank" rel="noreferrer"
          className="text-sm text-teal-700 underline truncate flex-1">{text}</a>
        <button onClick={kopieren} className="text-gray-400 hover:text-navy shrink-0"
          aria-label="Kopieren">
          {kopiert ? <Check size={15} className="text-teal-600" /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  )
}

function Feld({ label, wert, setzen, platzhalter, lesen }: {
  label: string; wert: string; setzen: (v: string) => void
  platzhalter?: string; lesen?: boolean
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <input value={wert} placeholder={platzhalter} disabled={lesen}
        onChange={e => setzen(e.target.value)}
        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                   focus:border-teal-500 focus:outline-none disabled:bg-gray-50" />
    </label>
  )
}

function Bereich({ label, wert, setzen, platzhalter, zeilen = 3, lesen }: {
  label: string; wert: string; setzen: (v: string) => void
  platzhalter?: string; zeilen?: number; lesen?: boolean
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <textarea rows={zeilen} value={wert} placeholder={platzhalter} disabled={lesen}
        onChange={e => setzen(e.target.value)}
        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                   focus:border-teal-500 focus:outline-none resize-y disabled:bg-gray-50" />
    </label>
  )
}
