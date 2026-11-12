'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ShieldCheck, Loader2, MessageSquare, Mail, Smartphone } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { istApp } from '@/lib/nativ'

/**
 * §289 Beim Öffnen der App erneut mit dem zweiten Faktor bestätigen.
 *
 * GEWÜNSCHT: „Man einstellen kann, dass man bei jedem Öffnen der App neu mit
 * 2FA gefragt wird" — und ausdrücklich „bei 2fa mit sms, nicht bei
 * Fingerabdruck und so".
 *
 * WARUM DAS NICHT DIE SPERRE IST, DIE IN §288 RAUSGEFLOGEN IST
 * Die alte fragte den Finger. Wessen Sensor zickte, hing fest: Der einzige
 * Ausweg „abmelden" führte zur Anmeldung — und die ließ ihn durch, worauf die
 * Sperre wieder nach dem Finger fragte. Zwei verschiedene Tore, eines davon
 * kaputt, und ein Kreis.
 *
 * Hier ist es DASSELBE Tor wie bei der Anmeldung: derselbe SMS-Code,
 * dieselbe E-Mail, dieselbe Authenticator-App. Wer hier nicht durchkommt,
 * käme auch durch die Anmeldung nicht — es gibt nichts zu verlieren und
 * keinen Kreis zu laufen.
 *
 * WAS DIESER BILDSCHIRM NICHT IST
 * Er ist nicht der Schutz, sondern seine Anzeige. Gesperrt wird am Server,
 * in `requireRole` (§289, `oeffnungssiegel.ts`): Wer das Telefon in der Hand
 * hat, hat auch den Sitzungskeks, und eine Sperre, die nur ein Fenster
 * darüberlegt, ließe jede Adresse offen. Deshalb fragt dieser Bildschirm den
 * Server, ob zu ist — er entscheidet es nicht selbst.
 */

/** Ab wann nach dem Weglegen wieder gefragt wird. Siehe `oeffnungssiegel.ts`. */
const KARENZ_MS = 60_000

interface Lage {
  aktiv: boolean
  frei: boolean
  wege: { sms: string | null; email: string | null; totp: boolean }
}

export function Oeffnungssperre() {
  const { user, logout } = useAuth()
  const [lage, setLage] = useState<Lage | null>(null)
  const [code, setCode] = useState('')
  const [fehler, setFehler] = useState('')
  const [hinweis, setHinweis] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [sendet, setSendet] = useState(false)
  const weggelegtSeit = useRef<number | null>(null)

  const standHolen = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/oeffnung')
      if (!r.ok) { setLage(null); return }
      const d = await r.json()
      setLage({ aktiv: !!d.aktiv, frei: !!d.frei, wege: d.wege ?? { sms: null, email: null, totp: false } })
    } catch {
      /*
       * Ohne Netz wird NICHT gesperrt. Das ist eine bewusste Entscheidung
       * gegen die Gewohnheit „im Zweifel zu": Ohne Netz käme auch kein Code
       * an, und die Sperre wäre eine Tür, zu der das Schloss fehlt — genau
       * der Zustand, der in §288 jemanden ausgesperrt hat. Die Daten
       * dahinter sind ohnehin nur die zuletzt geladenen.
       */
      setLage(null)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    standHolen()
  }, [user, standHolen])

  /*
   * Zurück aus dem Hintergrund: Nur das Gerät weiß, wann die App weggelegt
   * wurde — der Server sieht es nicht. War sie länger als eine Minute weg,
   * wird das Siegel weggeworfen und neu gefragt.
   *
   * Die Minute ist der Weg, den es wirklich gibt: zur Kamera wechseln, den
   * Krankenschein fotografieren, zurückkommen. Wer dafür jedes Mal einen
   * neuen SMS-Code bräuchte, schaltet die Sperre nach zwei Tagen ab.
   */
  useEffect(() => {
    if (!user || !istApp()) return
    const plugin = import('@capacitor/app').then(({ App }) =>
      App.addListener('appStateChange', async ({ isActive }) => {
        if (!isActive) { weggelegtSeit.current = Date.now(); return }
        const weg = weggelegtSeit.current
        weggelegtSeit.current = null
        if (weg === null || Date.now() - weg < KARENZ_MS) return
        await fetch('/api/auth/oeffnung', { method: 'DELETE' }).catch(() => undefined)
        setCode(''); setFehler(''); setHinweis('')
        standHolen()
      }),
    ).catch(() => null)
    return () => { plugin.then(h => h?.remove()).catch(() => {}) }
  }, [user, standHolen])

  async function codeSenden(weg: 'sms' | 'email') {
    setSendet(true); setFehler(''); setHinweis('')
    try {
      const r = await fetch('/api/auth/oeffnung/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weg }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFehler(d.error ?? 'Der Code ließ sich nicht senden.'); return }
      setHinweis(weg === 'sms'
        ? 'Der Code ist unterwegs als SMS.'
        : 'Der Code ist unterwegs per E-Mail.')
    } catch {
      setFehler('Kein Netz — der Code ließ sich nicht anfordern.')
    } finally {
      setSendet(false)
    }
  }

  async function pruefen() {
    setLaeuft(true); setFehler('')
    try {
      const r = await fetch('/api/auth/oeffnung/pruefen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
      setCode('')
      setLage(l => (l ? { ...l, frei: true } : l))
    } catch {
      setFehler('Kein Netz — der Code ließ sich nicht prüfen.')
    } finally {
      setLaeuft(false)
    }
  }

  if (!user || !lage || !lage.aktiv || lage.frei) return null

  const { sms, email, totp } = lage.wege

  return (
    <div
      className="fixed inset-0 z-[100] bg-navy flex flex-col items-center justify-center
                 px-6 text-center overflow-y-auto py-10"
      role="dialog"
      aria-modal="true"
      aria-label="Bestätigung nötig"
    >
      <div className="w-20 h-20 rounded-3xl bg-brand/15 flex items-center justify-center mb-6">
        <ShieldCheck size={36} className="text-brand" />
      </div>
      <h1 className="text-white font-bold text-xl mb-2">Kurz bestätigen</h1>
      <p className="text-white/60 text-sm max-w-xs leading-relaxed">
        Hier stehen deine Dienst- und Lohndaten. Bestätige dich mit deinem
        zweiten Faktor — so, wie beim Anmelden.
      </p>

      <div className="mt-7 w-full max-w-xs space-y-2.5">
        {sms && (
          <button
            type="button"
            onClick={() => codeSenden('sms')}
            disabled={sendet || laeuft}
            className="w-full h-12 rounded-2xl bg-white/10 text-white font-semibold text-sm
                       flex items-center justify-center gap-2 active:scale-[0.98]
                       transition-transform disabled:opacity-50"
          >
            {sendet ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
            Code per SMS an {sms}
          </button>
        )}
        {email && (
          <button
            type="button"
            onClick={() => codeSenden('email')}
            disabled={sendet || laeuft}
            className="w-full h-12 rounded-2xl bg-white/10 text-white font-semibold text-sm
                       flex items-center justify-center gap-2 active:scale-[0.98]
                       transition-transform disabled:opacity-50"
          >
            {sendet ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            Code per E-Mail
          </button>
        )}
        {totp && !sms && !email && (
          <p className="text-white/50 text-xs flex items-center justify-center gap-2">
            <Smartphone size={14} /> Code aus deiner Authenticator-App
          </p>
        )}

        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          aria-label="Code"
          className="w-full h-14 rounded-2xl bg-white/10 text-white text-center text-2xl
                     font-bold tracking-[0.3em] tabular-nums placeholder-white/25
                     focus:outline-none focus:ring-2 focus:ring-brand/50"
        />

        <button
          type="button"
          onClick={pruefen}
          disabled={code.length < 6 || laeuft}
          className="w-full h-14 rounded-2xl bg-brand text-navy font-bold text-base
                     flex items-center justify-center gap-2 active:scale-[0.98]
                     transition-transform disabled:opacity-40"
        >
          {laeuft && <Loader2 size={18} className="animate-spin" />}
          Weiter
        </button>
      </div>

      {(fehler || hinweis) && (
        <p className={`text-xs mt-4 max-w-xs ${fehler ? 'text-amber-200' : 'text-white/60'}`}>
          {fehler || hinweis}
        </p>
      )}

      {/*
        §288 DER AUSWEG, UND DIESMAL FÜHRT ER HINAUS.
        Die alte Sperre hatte denselben Knopf — er führte zur Anmeldung, und
        die ließ durch, worauf die Sperre wieder zuschlug. Hier verlangt die
        Anmeldung GENAU DASSELBE wie dieser Bildschirm. Wer sich anmelden
        kann, kommt also auch hier hindurch; wer nicht, dem hilft kein Ausweg,
        aber er hätte sich ohnehin nicht anmelden können.
      */}
      <button
        onClick={() => { setLage(null); logout() }}
        className="mt-7 text-white/40 text-xs font-semibold"
      >
        Stattdessen abmelden
      </button>
    </div>
  )
}
