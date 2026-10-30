'use client'

import { useState, useEffect, useCallback } from 'react'
import { Lock, LockOpen, Loader2 } from 'lucide-react'

/**
 * §201 Die zweite Tür vor den eigenen Lohndaten — Bedienung.
 *
 * WARUM DAS EIN EIGENER BAUSTEIN IST
 * Die Sperre sitzt an mehreren Stellen: bei den Lohnabrechnungen und bei
 * „Meine Daten" im Profil (die Auskunft nach Art. 15 enthält jede
 * Abrechnungszeile). Zwei Abschriften derselben Eingabemaske laufen
 * auseinander — dann hat die eine eine Fehlermeldung und die andere nicht,
 * und niemand merkt es, weil beide „funktionieren".
 *
 * WAS DIESER BAUSTEIN NICHT IST
 * Er ist nicht der Schutz. Der sitzt in den Routen; diese Maske sorgt nur
 * dafür, dass niemand erst auf eine Fehlermeldung läuft. Wer sie im Browser
 * wegklickt, hat nichts gewonnen.
 */

export interface Siegelstand {
  /** `null`, solange noch nicht bekannt. */
  frei: boolean | null
  /** Verbleibende Sekunden. */
  rest: number
  minuten: number
  passwort: string
  setPasswort: (w: string) => void
  prueft: boolean
  fehler: string
  freigeben: (e: React.FormEvent) => void
  sperren: () => void
}

export function useLohnsiegel(): Siegelstand {
  const [frei, setFrei] = useState<boolean | null>(null)
  const [rest, setRest] = useState(0)
  // Die Dauer sagt der Server — sonst steht hier irgendwann eine andere Zahl
  // als dort, und der Text verspricht etwas, das nicht gilt.
  const [minuten, setMinuten] = useState(15)
  const [passwort, setPasswort] = useState('')
  const [prueft, setPrueft] = useState(false)
  const [fehler, setFehler] = useState('')

  // Beim Öffnen fragen, ob noch eine Freigabe läuft — sonst müsste jemand,
  // der nur kurz weggetippt hat, das Passwort erneut eingeben.
  useEffect(() => {
    fetch('/api/auth/lohnsiegel')
      .then(r => r.json())
      .then(d => {
        setFrei(Boolean(d.frei))
        setRest(d.restSekunden ?? 0)
        if (typeof d.minuten === 'number') setMinuten(d.minuten)
      })
      // Antwortet die Frage gar nicht, wird gesperrt angenommen. Eine
      // Oberfläche, die bei einem Netzfehler aufmacht, ist keine Sperre.
      .catch(() => { setFrei(false); setRest(0) })
  }, [])

  // Die Uhr läuft sichtbar ab — und schließt am Ende selbst. Ohne das stünde
  // die Seite offen da und erst der Klick liefe ins Leere.
  useEffect(() => {
    if (!frei || rest <= 0) return
    const uhr = setInterval(() => {
      setRest(r => {
        if (r <= 1) { setFrei(false); return 0 }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(uhr)
  }, [frei, rest])

  const freigeben = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setPrueft(true)
    setFehler('')
    try {
      const r = await fetch('/api/auth/lohnsiegel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwort }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
      setFrei(true)
      setRest(d.restSekunden ?? 0)
      setPasswort('')
    } catch {
      setFehler('Keine Verbindung. Bitte noch einmal versuchen.')
    } finally {
      setPrueft(false)
    }
  }, [passwort])

  const sperren = useCallback(async () => {
    await fetch('/api/auth/lohnsiegel', { method: 'DELETE' }).catch(() => undefined)
    setFrei(false)
    setRest(0)
  }, [])

  return { frei, rest, minuten, passwort, setPasswort, prueft, fehler, freigeben, sperren }
}

/** mm:ss — ohne führende Null bei den Minuten, das liest sich ruhiger. */
export const restZeit = (sek: number) =>
  `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')}`

/** Die Eingabemaske, wenn noch gesperrt ist. */
export function Siegelkarte({ stand, text }: { stand: Siegelstand; text: string }) {
  return (
    <form
      onSubmit={stand.freigeben}
      className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4"
    >
      <div className="flex flex-col items-center text-center gap-2">
        <span className="w-11 h-11 rounded-full bg-teal-50 flex items-center justify-center">
          <Lock size={19} className="text-teal-600" />
        </span>
        <p className="text-sm font-semibold text-navy">Geschützter Bereich</p>
        <p className="text-xs text-gray-500 max-w-xs">
          {text} Bestätige kurz dein Passwort — dann bleibt der Bereich{' '}
          {stand.minuten} Minuten lang offen.
        </p>
      </div>

      <div>
        <label htmlFor="siegel-passwort" className="sr-only">Dein Passwort</label>
        <input
          id="siegel-passwort"
          type="password"
          autoComplete="current-password"
          value={stand.passwort}
          onChange={e => stand.setPasswort(e.target.value)}
          placeholder="Dein Passwort"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
        />
        {stand.fehler && <p className="text-xs text-red-600 mt-2">{stand.fehler}</p>}
      </div>

      <button
        type="submit"
        disabled={stand.prueft || stand.passwort.length === 0}
        className="w-full rounded-xl bg-teal-600 text-white text-sm font-semibold py-3
                   disabled:opacity-40 active:bg-teal-700 flex items-center justify-center gap-2"
      >
        {stand.prueft && <Loader2 size={15} className="animate-spin" />}
        Freigeben
      </button>

      <p className="text-[11px] text-gray-400 text-center">
        Es ist dasselbe Passwort wie bei der Anmeldung — du musst dir keines merken.
      </p>
    </form>
  )
}

/** Die Zeile über dem freigegebenen Inhalt: Restzeit und ein Weg zurück. */
export function Freigabeleiste({ stand }: { stand: Siegelstand }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <LockOpen size={13} className="text-teal-600 shrink-0" />
      <p className="text-xs text-gray-500 flex-1">
        Freigegeben für noch {restZeit(stand.rest)}
      </p>
      <button
        type="button"
        onClick={stand.sperren}
        className="text-xs font-semibold text-teal-600 active:text-teal-700"
      >
        Wieder sperren
      </button>
    </div>
  )
}
