'use client'

import { useState, useEffect } from 'react'
import { Bell, ShieldCheck, Loader2, Check } from 'lucide-react'
import { istApp, pushAnmelden, biometrielage, biometriePruefen } from '@/lib/nativ'
import { sperreAn, sperreSetzen } from './Geraetesperre'

/**
 * §139 Die zwei Schalter, die es nur in der App gibt.
 *
 * Sie stehen bewusst NICHT bei den übrigen Einstellungen im Profil: Beides sind
 * Eigenschaften DIESES Telefons, nicht des Kontos. Wer zwei Geräte hat, will
 * auf dem privaten vielleicht die Sperre und auf dem Diensttelefon nicht — und
 * eine Einstellung, die im Konto liegt, könnte das gar nicht abbilden.
 *
 * Im Browser rendert die ganze Gruppe nichts. Ein ausgegrauter Schalter mit
 * „geht nur in der App" wäre eine Frage, die niemand gestellt hat.
 */
export function AppEinstellungen() {
  const [inApp, setInApp] = useState(false)
  const [sperre, setSperre] = useState(false)
  const [biometrie, setBiometrie] = useState<{ moeglich: boolean; name: string }>(
    { moeglich: false, name: '' })
  const [pushLaeuft, setPushLaeuft] = useState(false)
  const [pushStand, setPushStand] = useState<'offen' | 'an' | 'abgelehnt'>('offen')

  useEffect(() => {
    if (!istApp()) return
    setInApp(true)
    setSperre(sperreAn())
    biometrielage().then(setBiometrie)
  }, [])

  if (!inApp) return null

  async function pushEinschalten() {
    setPushLaeuft(true)
    const { ok } = await pushAnmelden()
    setPushStand(ok ? 'an' : 'abgelehnt')
    setPushLaeuft(false)
  }

  async function sperreUmschalten() {
    if (sperre) { sperreSetzen(false); setSperre(false); return }
    // Vor dem Einschalten einmal ausprobieren. Wer die Sperre einschaltet und
    // beim nächsten Start merkt, dass sein Gerät sie gar nicht kann, kommt
    // nicht mehr hinein — das wäre der schlechteste denkbare Ausgang.
    const ok = await biometriePruefen('Sperre einschalten')
    if (!ok) return
    sperreSetzen(true); setSperre(true)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50
                    overflow-hidden">
      <button
        onClick={pushEinschalten}
        disabled={pushLaeuft || pushStand === 'an'}
        className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 w-full text-left"
      >
        <Bell size={18} className="text-teal-600 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-navy">Benachrichtigungen</span>
          <span className="block text-xs text-gray-400">
            {pushStand === 'an'
              ? 'Eingeschaltet — du wirst bei Ausfällen und Planänderungen benachrichtigt'
              : pushStand === 'abgelehnt'
                ? 'Nicht erlaubt. In den Einstellungen des Telefons freigeben.'
                : 'Auch wenn die App zu ist — etwa bei kurzfristigem Ausfall'}
          </span>
        </span>
        {pushLaeuft
          ? <Loader2 size={16} className="animate-spin text-gray-300 shrink-0" />
          : pushStand === 'an'
            ? <Check size={16} className="text-green-600 shrink-0" />
            : null}
      </button>

      {biometrie.moeglich && (
        <button
          onClick={sperreUmschalten}
          className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 w-full text-left"
        >
          <ShieldCheck size={18} className="text-navy shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-navy">
              Mit {biometrie.name} sperren
            </span>
            <span className="block text-xs text-gray-400">
              {sperre
                ? 'Eingeschaltet — nach einer Minute Pause wird wieder gefragt'
                : 'Schützt Lohn- und Dienstdaten, wenn das Telefon liegen bleibt'}
            </span>
          </span>
          <span className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${
            sperre ? 'bg-brand' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow
                              transition-all ${sperre ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
        </button>
      )}
    </div>
  )
}
