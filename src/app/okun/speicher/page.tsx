'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CheckCircle, AlertTriangle, Database, MoveRight } from 'lucide-react'

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

interface Lage {
  eingerichtet: boolean
  inDerDatenbank: number
  imSpeicher: number
  bytesInDerDatenbank: number
}

interface UmzugErgebnis {
  umgezogen: number
  uebrig: number
  bytesBewegt: number
  fehler: { id: string; dateiname: string; grund: string }[]
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

export default function Speicher() {
  const [laeuft, setLaeuft] = useState(false)
  const [erg, setErg] = useState<Ergebnis | null>(null)

  const [lage, setLage] = useState<Lage | null>(null)
  const [zieht, setZieht] = useState(false)
  const [umzug, setUmzug] = useState<UmzugErgebnis | null>(null)
  const [umzugFehler, setUmzugFehler] = useState('')

  const lageLaden = useCallback(async () => {
    try {
      const r = await fetch('/api/okun/speicher-umzug')
      if (r.ok) setLage(await r.json())
    } catch { /* Die Anzeige ist Beiwerk — sie darf die Seite nicht aufhalten. */ }
  }, [])

  useEffect(() => { lageLaden() }, [lageLaden])

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

  /**
   * §262 Ein Häppchen umziehen.
   *
   * Bewusst nicht „alles auf einen Klick": Eine Anfrage, die 1350 Dateien
   * bewegt, läuft in jede Zeitgrenze. Jeder Klick nimmt zwanzig, und darunter
   * steht, wie viele noch übrig sind.
   */
  async function umziehen() {
    setZieht(true); setUmzugFehler('')
    try {
      const r = await fetch('/api/okun/speicher-umzug', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ anzahl: 20 }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setUmzugFehler(d.error ?? `Fehler ${r.status}`); return }
      setUmzug(d)
      await lageLaden()
    } catch {
      setUmzugFehler('Die Anfrage kam nicht durch.')
    } finally {
      setZieht(false)
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

      {/*
        * §262 Der Umzug der Dateien, die schon in der Datenbank liegen.
        *
        * Steht unter dem Prüfknopf, und das ist Absicht: Wer umzieht, bevor
        * der Selbsttest grün war, zieht in einen Speicher um, von dem er
        * nicht weiß, ob er antwortet.
        */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MoveRight size={16} className="text-navy" />
            <CardTitle>Bestehende Dateien umziehen</CardTitle>
          </div>
        </CardHeader>

        <p className="text-sm text-gray-600">
          Dateien, die schon vor der Umstellung hochgeladen wurden, liegen als
          Spalte in der Datenbank. Jeder Klick holt zwanzig davon heraus, legt
          sie im Objektspeicher ab, liest sie vollständig zurück und vergleicht
          sie Byte für Byte. <strong>Erst danach</strong> wird der Inhalt aus der
          Datenbank entfernt — scheitert irgendetwas, bleibt die Zeile
          unverändert.
        </p>

        {lage && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Noch in der Datenbank</p>
              <p className="text-xl font-semibold text-navy tabular-nums">
                {lage.inDerDatenbank}
              </p>
              <p className="text-xs text-gray-500">{mb(lage.bytesInDerDatenbank)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700">Im Objektspeicher</p>
              <p className="text-xl font-semibold text-emerald-800 tabular-nums">
                {lage.imSpeicher}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4">
          <Button
            onClick={umziehen}
            disabled={zieht || (lage ? !lage.eingerichtet || lage.inDerDatenbank === 0 : false)}
          >
            {zieht ? 'Zieht um…'
              : lage?.inDerDatenbank === 0 ? 'Alles umgezogen'
                : 'Zwanzig umziehen'}
          </Button>
        </div>

        {umzugFehler && (
          <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">{umzugFehler}</p>
          </div>
        )}

        {umzug && (
          <div className="mt-4 space-y-3">
            <div className={`flex gap-2 rounded-xl p-3 ${
              umzug.fehler.length === 0 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              {umzug.fehler.length === 0
                ? <CheckCircle size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                : <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />}
              <p className={`text-sm ${
                umzug.fehler.length === 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                {umzug.umgezogen} Dateien umgezogen ({mb(umzug.bytesBewegt)}),
                {' '}{umzug.uebrig} noch übrig.
                {umzug.fehler.length > 0 && ` ${umzug.fehler.length} sind liegen geblieben —
                  ihr Inhalt steht unverändert in der Datenbank.`}
              </p>
            </div>

            {umzug.fehler.length > 0 && (
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {umzug.fehler.map(f => (
                  <div key={f.id} className="px-3 py-2.5">
                    <p className="text-sm font-medium text-navy break-words">{f.dateiname}</p>
                    <p className="text-xs text-gray-600 mt-0.5 break-words">{f.grund}</p>
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
