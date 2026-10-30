'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

/**
 * §177 Wer angemeldet ist, sieht die Verkaufsseite nicht.
 *
 * Eine Leitung, die morgens `okun-workforce.com` eintippt, will in ihren
 * Dienstplan — nicht lesen, warum sie das Programm kaufen sollte.
 *
 * §245 UND SIE SIEHT SIE AUCH NICHT FÜR EINE SEKUNDE
 *
 * Hier stand: „Die Verkaufsseite ist dabei kurz sichtbar. Das ist gewollt."
 * Für §177 war das eine vertretbare Abwägung, §201 hat die Weiterleitung
 * deshalb auf den Server verlegt. Gemeldet kam trotzdem zum zweiten Mal:
 * „Ich sehe immer noch, wenn ich auf die App gehe, erstmal für eine Sekunde
 * die Website und dann erst werde ich in die App geschickt."
 *
 * Örtlich ließ sich das nicht nachstellen — im echten Browser, angemeldet,
 * mit eingetragenem Dienst-Arbeiter, erscheint die Verkaufsseite zu keinem
 * Zeitpunkt. Die Ursache im Betrieb kenne ich also nicht. Was ich kenne, ist
 * die Stelle, an der sie sichtbar WIRD: hier.
 *
 * Darum blendet dieses Bauteil die Seite jetzt aus, sobald im Browser noch
 * eine Sitzung liegt — und zwar SYNCHRON beim ersten Aufbau, nicht erst wenn
 * `/api/auth/me` geantwortet hat. Genau dieses Warten war die eine Sekunde.
 *
 * WAS ES NICHT TUT
 * Es blendet nichts aus, wenn keine Sitzung im Browser liegt. Jeder
 * Interessent und jede Suchmaschine bekommt die Seite unverändert und sofort
 * — das war der Grund, warum sie überhaupt auf dem Server entsteht.
 */

/** Liegt im Browser noch eine Sitzung? Ohne auf den Server zu warten. */
function sitzungImBrowser(): boolean {
  try {
    return Boolean(sessionStorage.getItem('dienstplan_user'))
  } catch {
    // Privater Modus, gesperrte Speicher: dann eben nicht.
    return false
  }
}

export function AngemeldeteWeiterleiten() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  /*
   * Erst nach dem Aufbau gesetzt, nicht beim ersten Zeichnen: Server und
   * Browser müssen dasselbe ausliefern, sonst verwirft React den Baum und
   * zeichnet alles neu — was das Flackern schlimmer machte statt besser.
   */
  const [verbergen, setVerbergen] = useState(false)
  useEffect(() => { setVerbergen(sitzungImBrowser()) }, [])

  /*
   * §245 Das Merkmal am Dokument wieder wegnehmen, sobald feststeht, dass
   * KEINE Sitzung besteht.
   *
   * Es wird von einem Skript beim Einlesen gesetzt, das nur in den Browser
   * sehen kann. Hat der Server die Sitzung inzwischen abgelehnt — abgelaufen,
   * abgemeldet, anderes Gerät —, dann stünde die Seite sonst dauerhaft auf
   * unsichtbar, und ein Interessent sähe einen leeren Bildschirm.
   */
  useEffect(() => {
    if (isLoading || user) return
    try {
      document.documentElement.removeAttribute('data-sitzung')
      sessionStorage.removeItem('dienstplan_user')
    } catch { /* gesperrte Speicher: dann eben nicht */ }
    setVerbergen(false)
  }, [user, isLoading])

  useEffect(() => {
    if (isLoading || !user) return
    const ziel = user.role === 'employee' ? '/employee'
      : user.role === 'admin' ? '/admin'
        : user.role === 'okun' ? '/okun'
          : '/company'
    router.replace(ziel)
  }, [user, isLoading, router])

  /*
   * Eine Decke über der Seite statt sie zu entfernen: Der Inhalt bleibt im
   * Dokument, nur sichtbar ist er nicht. Das hält die Seite für
   * Suchmaschinen unverändert und spart das Neuaufbauen beim Weiterleiten.
   */
  if (!verbergen) return null
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] bg-navy-900"
      data-test="verkaufsseite-verdeckt"
    />
  )
}
