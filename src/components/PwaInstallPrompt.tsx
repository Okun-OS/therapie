'use client'

import { useEffect, useState } from 'react'
import { Share, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'

const DISMISSED_KEY = 'okun_pwa_install_dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export function PwaInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY) === 'true') return
    setDismissed(false)

    if (isIos()) {
      setShowIosHint(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setDeferredEvent(null)
    setShowIosHint(false)
  }

  const install = async () => {
    if (!deferredEvent) return
    await deferredEvent.prompt()
    dismiss()
  }

  if (dismissed || (!deferredEvent && !showIosHint)) return null

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-96 z-50">
      <div className="bg-navy rounded-2xl shadow-2xl px-4 py-3.5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center flex-shrink-0 overflow-hidden">
          <Logo variant="icon" iconSize={24} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">OKUN Workforce installieren</p>
          {showIosHint ? (
            <p className="text-navy-100 text-xs mt-0.5">
              Tippe auf <Share size={11} className="inline -mt-0.5" /> &ldquo;Teilen&rdquo; und dann &ldquo;Zum Home-Bildschirm&rdquo;.
            </p>
          ) : (
            <p className="text-navy-100 text-xs mt-0.5">Wie eine native App nutzen – inklusive Push-Benachrichtigungen.</p>
          )}
          {!showIosHint && (
            <Button size="sm" className="mt-2" onClick={install}>
              Installieren
            </Button>
          )}
        </div>
        <button onClick={dismiss} className="text-navy-100 hover:text-white flex-shrink-0" aria-label="Schließen">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
