'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

/**
 * §177 Wer angemeldet ist, sieht die Verkaufsseite nicht.
 *
 * Eine Leitung, die morgens `okun-workforce.com` eintippt, will in ihren
 * Dienstplan — nicht lesen, warum sie das Programm kaufen sollte. Also wird
 * sie durchgereicht, sobald feststeht, dass sie angemeldet ist.
 *
 * WARUM DAS NICHT AUF DEM SERVER PASSIERT
 * Dann könnte die Startseite nicht statisch ausgeliefert werden: Jeder
 * Aufruf müsste erst das Sitzungs-Cookie prüfen. Für eine Seite, die bei
 * Google gefunden werden soll und beim ersten Laden sofort dastehen muss,
 * wäre das der falsche Tausch — zumal die Weiterleitung nur Angemeldete
 * betrifft, die ohnehin wissen, wo sie hinwollen.
 *
 * Die Verkaufsseite ist dabei kurz sichtbar. Das ist gewollt: Lieber ein
 * kurzer Blick auf die richtige Seite als ein leerer Bildschirm für alle
 * anderen.
 */
export function AngemeldeteWeiterleiten() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading || !user) return
    const ziel = user.role === 'employee' ? '/employee'
      : user.role === 'admin' ? '/admin'
        : user.role === 'okun' ? '/okun'
          : '/company'
    router.replace(ziel)
  }, [user, isLoading, router])

  return null
}
