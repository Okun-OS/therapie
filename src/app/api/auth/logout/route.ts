import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/session'
import { OEFFNUNG_KEKS, KEKS_OPTIONEN } from '@/lib/oeffnungssiegel'
import { SIEGEL_KEKS, KEKS_OPTIONEN as LOHN_OPTIONEN } from '@/lib/lohnsiegel'

export const dynamic = 'force-dynamic'

/**
 * Abmelden — und dabei ALLES abräumen, was die Sitzung begleitet hat.
 *
 * §289 Hier lag der Kern des Fehlers aus §288: Die alte Gerätesperre merkte
 * sich ihren Zustand neben der Sitzung, und das Abmelden fasste ihn nicht an.
 * Der Ausweg führte damit in dieselbe Sperre zurück.
 *
 * Deshalb fällt hier jetzt jede Marke, die an die Person gebunden ist: die
 * Sitzung, das Siegel für die Lohndaten (§201) und das für die Bestätigung
 * beim Öffnen (§289). Das Lohnsiegel prüft zwar ohnehin, zu WEM es gehört —
 * auf einem geteilten Tablet ist es trotzdem richtig, nichts von der
 * Vorgängerin liegen zu lassen.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true })
  clearSessionCookie(res)
  res.cookies.set(OEFFNUNG_KEKS, '', { ...KEKS_OPTIONEN, maxAge: 0 })
  res.cookies.set(SIEGEL_KEKS, '', { ...LOHN_OPTIONEN, maxAge: 0 })
  return res
}
