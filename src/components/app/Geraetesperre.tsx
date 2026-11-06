'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { istApp, biometriePruefen, biometrielage } from '@/lib/nativ'
import { useAuth } from '@/lib/auth-context'

/**
 * §139 Die Sperre vor dem Wiedereinstieg — Face ID oder Fingerabdruck.
 *
 * WARUM ÜBERHAUPT
 * Auf dem Telefon einer Pflegekraft liegt hinter zwei Fingertipps ihre
 * Lohnabrechnung, und hinter drei die Personalliste des Standorts. Telefone
 * liegen im Dienstzimmer, werden verliehen und bleiben liegen. Eine Anmeldung,
 * die Wochen hält — und das soll sie, niemand tippt jeden Morgen ein Passwort —
 * braucht deshalb eine zweite, schnelle Tür.
 *
 * DREI ENTSCHEIDUNGEN
 *
 *   FREIWILLIG. Wer die Sperre nicht will, bekommt sie nicht. Eine erzwungene
 *   Gesichtserkennung ist bei einem Werkzeug, das um zehn vor sechs im Flur
 *   aufgeht, eine Zumutung — und die Leute schalten dann das Telefon-Schloss
 *   ganz ab, was schlimmer wäre.
 *
 *   ERST NACH EINER MINUTE. Wer zwischen App und Kamera wechselt, um den
 *   Krankenschein zu fotografieren, wird nicht gesperrt. Sonst steht die Sperre
 *   dem im Weg, wofür die App da ist.
 *
 *   IM ZWEIFEL ZU. Abbruch, Fehler, kein Sensor erkannt — alles bleibt
 *   gesperrt. Die einzige Tür daneben ist das Abmelden, und die führt zur
 *   Anmeldung, nicht an den Daten vorbei.
 */

/** Ob die Sperre auf DIESEM Gerät gilt — das ist eine Geräte-, keine Kontofrage. */
export const SPERRE_SCHLUESSEL = 'okun_geraetesperre'

export function sperreAn(): boolean {
  try { return window.localStorage.getItem(SPERRE_SCHLUESSEL) === '1' } catch { return false }
}

export function sperreSetzen(an: boolean) {
  try { window.localStorage.setItem(SPERRE_SCHLUESSEL, an ? '1' : '0') } catch { /* egal */ }
}

/** Ab wann nach dem Weglegen wieder gefragt wird. */
const RUHE_MS = 60_000

export function Geraetesperre() {
  const { logout } = useAuth()
  const [gesperrt, setGesperrt] = useState(false)
  const [fragt, setFragt] = useState(false)
  const [name, setName] = useState('Gerätesperre')
  const weggelegtSeit = useRef<number | null>(null)
  const laeuft = useRef(false)

  const entsperren = useCallback(async () => {
    // Zwei Abfragen gleichzeitig lassen iOS den Dialog verschlucken — dann
    // steht die App gesperrt da und reagiert auf nichts mehr.
    if (laeuft.current) return
    laeuft.current = true
    setFragt(true)
    const ok = await biometriePruefen('Zugriff auf deine Dienst- und Lohndaten')
    laeuft.current = false
    setFragt(false)
    if (ok) setGesperrt(false)
  }, [])

  useEffect(() => {
    if (!istApp() || !sperreAn()) return

    let abgemeldet = false
    biometrielage().then(l => {
      if (abgemeldet) return
      // Kein Sensor eingerichtet? Dann wäre die Sperre eine Tür ohne Schloss —
      // sie bliebe für immer zu. Also gar nicht erst sperren.
      if (!l.moeglich) { sperreSetzen(false); return }
      setName(l.name)
      setGesperrt(true)
      entsperren()
    })

    const plugin = import('@capacitor/app').then(({ App }) =>
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) { weggelegtSeit.current = Date.now(); return }
        const weg = weggelegtSeit.current
        weggelegtSeit.current = null
        if (weg !== null && Date.now() - weg < RUHE_MS) return
        setGesperrt(true)
        entsperren()
      }),
    ).catch(() => null)

    return () => {
      abgemeldet = true
      plugin.then(h => h?.remove()).catch(() => {})
    }
  }, [entsperren])

  if (!gesperrt) return null

  return (
    <div
      className="fixed inset-0 z-[100] bg-navy flex flex-col items-center justify-center
                 px-6 text-center"
      role="dialog"
      aria-modal="true"
      aria-label="Gesperrt"
    >
      <div className="w-20 h-20 rounded-3xl bg-brand/15 flex items-center justify-center mb-6">
        <ShieldCheck size={36} className="text-brand" />
      </div>
      <h1 className="text-white font-bold text-xl mb-2">Gesperrt</h1>
      <p className="text-white/60 text-sm max-w-xs leading-relaxed">
        Hier stehen deine Dienst- und Lohndaten. Entsperre mit {name}, um
        weiterzumachen.
      </p>

      <button
        onClick={entsperren}
        disabled={fragt}
        className="mt-8 h-14 px-8 rounded-2xl bg-brand text-navy font-bold text-base
                   flex items-center justify-center gap-2 active:scale-[0.98]
                   transition-transform disabled:opacity-60"
      >
        {fragt ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
        Entsperren
      </button>

      {/*
        Der einzige andere Weg. Er führt zur Anmeldung, nicht an den Daten
        vorbei — und er muss da sein: Wer sein Telefon weitergibt oder dessen
        Gesichtserkennung nicht mehr funktioniert, säße sonst fest.
      */}
      <button
        onClick={() => { setGesperrt(false); logout() }}
        className="mt-5 text-white/40 text-xs font-semibold"
      >
        Stattdessen abmelden
      </button>
    </div>
  )
}
