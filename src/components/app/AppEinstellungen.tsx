'use client'

import { useState, useEffect } from 'react'
import { Bell, Loader2, Check } from 'lucide-react'
import { istApp, pushAnmelden } from '@/lib/nativ'

/**
 * §139 Der Schalter, den es nur in der App gibt.
 *
 * Er steht bewusst NICHT bei den übrigen Einstellungen im Profil: Es ist eine
 * Eigenschaft DIESES Telefons, nicht des Kontos. Wer zwei Geräte hat, will
 * vielleicht nur auf einem Benachrichtigungen — und eine Einstellung, die im
 * Konto liegt, könnte das gar nicht abbilden.
 *
 * Im Browser rendert die ganze Gruppe nichts. Ein ausgegrauter Schalter mit
 * „geht nur in der App" wäre eine Frage, die niemand gestellt hat.
 *
 * §288 HIER STAND EIN ZWEITER SCHALTER: „Mit Fingerabdruck sperren".
 *
 * GEMELDET: „Er hat eingetragen, dass er sich über Fingerabdruck anmeldet,
 * und das funktioniert nicht. Es wird immer eine Fehlermeldung angezeigt, er
 * kommt nicht mehr rein in die App."
 *
 * Woran es lag, steht in `altlasten.ts`: Der einzige Ausweg aus der Sperre
 * war „Abmelden", und der führte zurück in die Sperre, weil der Schalter zum
 * Gerät gehörte und die Abmeldung ihn nicht anfasste.
 *
 * Entscheidung des Eigentümers, den Schalter ganz zu entfernen: „Wenn wir es
 * selber anbieten, muss es doch funktionieren, ansonsten machen wir das, was
 * das Handy von alleine sowieso anbietet."
 *
 * WAS DAS HANDY ANBIETET — nachgesehen, nicht erinnert:
 *   iPhone ab iOS 18: Symbol lange drücken → „Face ID erforderlich". Gilt für
 *   jede App, auch für solche, die selbst nichts dafür eingebaut haben.
 *   Android: KEINE einheitliche Sperre je App. Samsung kennt nur den
 *   „Sicheren Ordner", andere Hersteller (Xiaomi, OnePlus, Oppo) bringen
 *   eigene App-Sperren mit, reines Android hat nichts dergleichen.
 *
 * Deshalb steht hier kein Hinweis „sperr die App doch selbst": Auf dem
 * verbreitetsten Gerät stimmt er nicht. Ein Ratschlag, der ins Leere führt,
 * ist schlimmer als keiner.
 */
export function AppEinstellungen() {
  const [inApp, setInApp] = useState(false)
  const [pushLaeuft, setPushLaeuft] = useState(false)
  const [pushStand, setPushStand] = useState<'offen' | 'an' | 'abgelehnt'>('offen')

  useEffect(() => {
    if (istApp()) setInApp(true)
  }, [])

  if (!inApp) return null

  async function pushEinschalten() {
    setPushLaeuft(true)
    const { ok } = await pushAnmelden()
    setPushStand(ok ? 'an' : 'abgelehnt')
    setPushLaeuft(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
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
    </div>
  )
}
