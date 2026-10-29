'use client'

import { useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'

/**
 * §264 Der Stand, der hier läuft — und ein Knopf, der ihn erzwingt.
 *
 * WARUM ES DAS GEBEN MUSS
 * „Hat sich gar nichts verändert. Ich sehe immer noch die URL und auch immer
 *  noch die Website. 15 Mal habe ich das bestimmt schon gesagt."
 *
 * Nachgemessen war der Server längst richtig. Auf dem Telefon lag eine alte
 * Kopie der Verkaufsseite im Speicher des Dienst-Arbeiters und wurde von dort
 * ausgeliefert, ohne dass je jemand den Server fragte. Jede Verbesserung am
 * Server konnte dieses Gerät gar nicht erreichen.
 *
 * Das Unangenehme daran ist nicht der Fehler, sondern die Blindheit: Niemand
 * — weder der Mensch davor noch ich — konnte sagen, welcher Stand auf diesem
 * Gerät überhaupt läuft. Fünfzehn Runden lang wurde über etwas gesprochen,
 * das sich in zehn Sekunden hätte ablesen lassen.
 *
 * Also steht die Nummer jetzt da. Und daneben ein Knopf, der jeden
 * gespeicherten Rest wegräumt und neu lädt — damit „mach die App einmal ganz
 * zu und wieder auf" nicht die beste Antwort bleibt, die wir haben.
 *
 * WAS DER KNOPF NICHT ANFASST
 * Die Anmeldung und die Warteschlange für Offline-Betrieb. Geräumt werden
 * Kopien, die der Server jederzeit wieder liefert — nichts, was ein Mensch
 * eingegeben hat.
 */
export function Auffrischen() {
  const [stand, setStand] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(d => setStand(typeof d.stand === 'string' ? d.stand : null))
      .catch(() => setStand(null))
  }, [])

  async function auffrischen() {
    setLaeuft(true)
    try {
      const arbeiter = await navigator.serviceWorker?.getRegistrations?.() ?? []
      await Promise.all(arbeiter.map(r => r.unregister().catch(() => undefined)))
    } catch { /* Ohne Dienst-Arbeiter gibt es nichts abzumelden. */ }
    try {
      const namen = await caches.keys()
      await Promise.all(namen.map(n => caches.delete(n).catch(() => undefined)))
    } catch { /* Kein Speicher da — dann ist auch nichts zu räumen. */ }
    // `replace`, damit der Zurück-Knopf nicht auf die eben geräumte Seite führt.
    location.replace('/app')
  }

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
      <p className="text-[11px] text-gray-400">
        Stand der App: <span className="tabular-nums">{stand ?? '…'}</span>
      </p>
      <button
        type="button"
        onClick={auffrischen}
        disabled={laeuft}
        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200
                   px-3 py-1.5 text-xs font-medium text-navy
                   hover:bg-gray-50 active:bg-gray-100 disabled:opacity-60"
      >
        <RotateCw size={13} className={laeuft ? 'animate-spin' : ''} />
        {laeuft ? 'Wird aufgefrischt …' : 'App auffrischen'}
      </button>
    </div>
  )
}
