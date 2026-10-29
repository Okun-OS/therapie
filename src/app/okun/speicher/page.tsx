'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CheckCircle, AlertTriangle, Database } from 'lucide-react'

/**
 * §258 Der Prüfknopf für den Objektspeicher.
 *
 * Die Signatur nach AWS' Verfahren Version 4 lässt sich örtlich nicht prüfen —
 * ob Cloudflare sie annimmt, sagt nur Cloudflare. Und jeder denkbare Fehler
 * darin meldet sich mit derselben Auskunft: „SignatureDoesNotMatch", ohne
 * Hinweis worauf.
 *
 * Diese Seite macht daraus einen Knopf. Wer die Zugangsdaten einrichtet,
 * drückt einmal und weiß Bescheid — statt ein Foto in einen Chat zu laden und
 * aus einem Fehler 500 zu raten, woran es lag. Genau das hat in diesem
 * Vorhaben mehrere Runden gekostet.
 */

interface Schritt {
  name: string
  ok: boolean
  dauerMs: number
  hinweis?: string
}

interface Ergebnis {
  ok: boolean
  schritte: Schritt[]
  zusammenfassung: string
}

export default function Speicher() {
  const [laeuft, setLaeuft] = useState(false)
  const [erg, setErg] = useState<Ergebnis | null>(null)

  async function pruefen() {
    setLaeuft(true); setErg(null)
    try {
      const r = await fetch('/api/okun/speicher-test', { method: 'POST' })
      setErg(await r.json())
    } catch {
      setErg({
        ok: false, schritte: [],
        zusammenfassung: 'Die Anfrage kam nicht durch. Läuft der Dienst?',
      })
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database size={16} className="text-navy" />
            <CardTitle>Objektspeicher prüfen</CardTitle>
          </div>
        </CardHeader>

        <p className="text-sm text-gray-600">
          Legt eine kleine Testdatei im Speicher ab, holt sie zurück,
          vergleicht den Inhalt und räumt sie wieder weg. Es wird nichts
          überschrieben und nichts gelesen, was anderen gehört.
        </p>

        <div className="mt-4">
          <Button onClick={pruefen} disabled={laeuft}>
            {laeuft ? 'Wird geprüft…' : 'Jetzt prüfen'}
          </Button>
        </div>

        {erg && (
          <div className="mt-5 space-y-3">
            <div className={`flex gap-2 rounded-xl p-3 ${
              erg.ok ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              {erg.ok
                ? <CheckCircle size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                : <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />}
              <p className={`text-sm ${erg.ok ? 'text-emerald-800' : 'text-amber-800'}`}>
                {erg.zusammenfassung}
              </p>
            </div>

            {erg.schritte.length > 0 && (
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {erg.schritte.map(s => (
                  <div key={s.name} className="flex items-start gap-3 px-3 py-2.5">
                    {s.ok
                      ? <CheckCircle size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                      : <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-navy">{s.name}</p>
                      {s.hinweis && (
                        <p className="text-xs text-gray-600 mt-0.5 break-words">{s.hinweis}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">
                      {s.dauerMs} ms
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
