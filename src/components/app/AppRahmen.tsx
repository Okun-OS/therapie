'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import {
  istApp, anzeigeEinrichten, pushAnmelden, pushAntippenBehandeln,
} from '@/lib/nativ'
import { Geraetesperre } from './Geraetesperre'

/**
 * §139 Was die native Hülle beim Start tut.
 *
 * Vier Handgriffe, die im Browser nichts tun und in der App alles ausmachen:
 *
 *   1. Die Statusleiste einfärben und den Startbildschirm wegnehmen. Ohne das
 *      sieht die App aus wie eine Seite in einem Browser ohne Adressleiste —
 *      und genau danach sucht die Prüfung bei Apple (Richtlinie 4.2).
 *   2. Das Gerät für echte Benachrichtigungen anmelden. Erst wenn jemand
 *      angemeldet ist: Eine Gerätekennung ohne Person ist nutzlos, und die
 *      Systemfrage „Mitteilungen erlauben?" beim allerersten Start, noch vor
 *      dem Anmeldebildschirm, beantworten die meisten Menschen mit Nein.
 *   3. Das Antippen einer Benachrichtigung dorthin führen, wovon sie handelt.
 *      Sonst landet man auf der Startseite und sucht selbst — bei „Dienst am
 *      Samstag frei geworden" ist das die Reibung, an der das Einspringen
 *      scheitert.
 *   4. Die Sperre (Face ID) hängen, falls sie eingeschaltet ist.
 *
 * Alles hier ist beiläufig: Schlägt etwas davon fehl, läuft die Anwendung
 * weiter. Eine App, die nicht startet, weil Google keine Gerätekennung
 * ausgibt, wäre der schlechteste Tausch von allen.
 */
export function AppRahmen() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!istApp()) return
    anzeigeEinrichten()
    pushAntippenBehandeln(pfad => router.push(pfad))
  }, [router])

  useEffect(() => {
    if (!istApp() || !user?.employeeId) return
    // Nur einmal je Anmeldung fragen. Wer „Nein" gesagt hat, wird nicht bei
    // jedem Start erneut gefragt — das ist der sicherste Weg, jemanden dazu
    // zu bringen, Benachrichtigungen dauerhaft abzustellen.
    const schluessel = `okun_push_gefragt_${user.employeeId}`
    try {
      if (window.localStorage.getItem(schluessel)) return
      window.localStorage.setItem(schluessel, '1')
    } catch { /* ohne Speicher halt bei jedem Start */ }
    pushAnmelden()
  }, [user?.employeeId])

  return <Geraetesperre />
}
