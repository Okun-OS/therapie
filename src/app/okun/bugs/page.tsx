'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * §133 Aus „Bug-Management" ist „Funde" geworden — dieselbe Tabelle, aber mit
 * Verbesserungsvorschlägen, Freigaben und Rückfragen. Die alte Adresse bleibt
 * gültig und leitet weiter: Lesezeichen sollen nicht ins Leere laufen.
 */
export default function AlteBugSeite() {
  const router = useRouter()
  useEffect(() => { router.replace('/funde') }, [router])
  return null
}
