'use client'

import { useEffect, useState } from 'react'
import { Sparkles, X } from 'lucide-react'

// Ergänzung 2 zu 02_ONBOARDING_CHAT.md: "Intelligente Einführung neuer Nutzer" –
// kurze, kontextbezogene Erklärung direkt in der Anwendung beim ersten Öffnen
// einer Funktion, statt Video/PDF-Schulung.
export function FeatureIntro({ featureKey, text }: { featureKey: string; text: string }) {
  const storageKey = `featureIntroSeen:${featureKey}`
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(storageKey)) setVisible(true)
  }, [storageKey])

  function dismiss() {
    localStorage.setItem(storageKey, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 mb-4">
      <Sparkles size={16} className="flex-shrink-0 mt-0.5 text-indigo-500" />
      <p className="flex-1 text-sm text-indigo-900">{text}</p>
      <button onClick={dismiss} className="text-indigo-400 hover:text-indigo-600 flex-shrink-0">
        <X size={16} />
      </button>
    </div>
  )
}
