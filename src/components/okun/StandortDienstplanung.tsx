'use client'

import { Lock, Unlock, Package, AlertTriangle, Check } from 'lucide-react'
import { paketName, musterHinweis, type Regelpaket } from '@/lib/regelpakete'
import { BelegschaftEinspielen } from '@/components/okun/BelegschaftEinspielen'

/**
 * §200 Dienstplanung eines einzelnen Standorts einrichten.
 *
 * Vorher lag das auf einer eigenen Seite `/okun/dienstplanung`, die alle
 * Standorte aller Kunden untereinander zeigte. Dort arbeitet niemand: Wer
 * einen Kunden einrichtet, ist unter Kunden → Kunde → Standort. Und es ist
 * ausdrücklich JE STANDORT — ein Kunde mit zehn Standorten kann zehn
 * verschiedene Regelpakete haben. Deshalb hängt diese Bedienung jetzt am
 * aufgeklappten Standort in `/okun/customers`.
 *
 * Inhalt und Warnungen sind unverändert aus der alten Seite übernommen
 * (§126/§127/§132/§161/§183) — nur der Ort ist neu.
 */

export interface DienstplanungStandort {
  id: string
  name: string
  kunde: string | null
  rulePackId: string | null
  dienstplanungFrei: boolean
  dienstplanungFreiSeit: string | null
  dienstplanungFreiVon: string | null
  dienstplanungHinweis: string | null
  paketFehlt: boolean
  /** §202 Was am Standort eingerichtet ist. */
  dienstzeiten: number
  einheiten: number
}

/**
 * §200 Braucht der Standort Aufmerksamkeit? Für die zugeklappte Zeile —
 * sonst sieht man ein Problem erst, wenn man jeden Standort einzeln öffnet.
 */
export function dienstplanungProblem(s: DienstplanungStandort): string | null {
  if (s.paketFehlt) return 'Regelpaket fehlt im Rechendienst'
  if (s.dienstplanungFrei && !s.rulePackId) return 'Freigeschaltet ohne Regelpaket'
  // §202 Ohne Dienstzeiten entsteht kein Plan — das soll schon die
  // zugeklappte Zeile sagen, nicht erst der Kunde, der „Plan erstellen" drückt.
  if (s.rulePackId && s.dienstzeiten === 0) return 'Noch keine Dienstzeiten'
  return null
}

export function StandortDienstplanung({
  standort: s, pakete, erreichbar, arbeitet, gruppen, aendern,
}: {
  standort: DienstplanungStandort
  pakete: Regelpaket[]
  erreichbar: boolean
  arbeitet: boolean
  gruppen: string[]
  aendern: (locationId: string, daten: Record<string, unknown>) => void
}) {
  const paket = pakete.find(p => p.id === s.rulePackId)

  return (
    <div data-test="standort-dienstplanung" className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 space-y-3">
      <div className="flex items-start gap-3 flex-wrap">
        {s.dienstplanungFrei
          ? <Unlock size={16} className="text-teal-600 shrink-0 mt-0.5" />
          : <Lock size={16} className="text-gray-400 shrink-0 mt-0.5" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy">Dienstplanung</p>
          <p className="text-xs text-gray-400">
            {s.dienstplanungFrei
              ? 'Freigeschaltet — der Standort kann Pläne rechnen.'
              : 'Gesperrt — der Kunde sieht den Hinweis unten statt eines Plans.'}
          </p>
        </div>
        <button
          onClick={() => aendern(s.id, { dienstplanungFrei: !s.dienstplanungFrei })}
          disabled={arbeitet}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl disabled:opacity-40 ${
            s.dienstplanungFrei
              ? 'text-gray-600 border border-gray-200 bg-white hover:bg-gray-50'
              : 'text-white bg-brand'}`}>
          {s.dienstplanungFrei
            ? <><Lock size={13} /> Sperren</>
            : <><Unlock size={13} /> Freischalten</>}
        </button>
      </div>

      {/*
        §132 Freigeschaltet, aber nichts gebaut — der stille Fall.
        Der Kunde plant dann mit Standardregeln, die seinen Betrieb
        nicht kennen, und haelt das Ergebnis fuer unser Produkt.
      */}
      {s.dienstplanungFrei && !s.rulePackId && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">
            Freigeschaltet, aber ohne Regelpaket. Der Standort plant mit den
            Standardregeln — die kennen seinen Betrieb nicht. Entweder ein Paket
            zuordnen oder wieder sperren, bis es steht.
          </p>
        </div>
      )}

      {s.paketFehlt && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">
            Das zugeordnete Regelpaket &bdquo;{s.rulePackId}&ldquo; gibt es im Rechendienst
            nicht mehr. Der Plan läuft dann ohne die Regeln dieses Betriebs.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">
            Regelpaket
          </label>
          <select
            value={s.rulePackId ?? ''}
            disabled={!erreichbar || arbeitet}
            onChange={e => aendern(s.id, { rulePackId: e.target.value })}
            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white disabled:opacity-50">
            <option value="">— keines (Standardregeln) —</option>
            {pakete.map(p => (
              <option key={p.id} value={p.id}>
                {paketName(p)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">
            Hinweis für den Kunden, solange gesperrt
          </label>
          <input
            defaultValue={s.dienstplanungHinweis ?? ''}
            disabled={arbeitet}
            placeholder="Standardtext verwenden"
            onBlur={e => {
              if (e.target.value !== (s.dienstplanungHinweis ?? '')) {
                aendern(s.id, { hinweis: e.target.value })
              }
            }}
            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white" />
        </div>
      </div>

      {s.dienstplanungFrei && s.dienstplanungFreiSeit && (
        <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
          <Check size={12} className="text-teal-600" />
          Freigeschaltet am {s.dienstplanungFreiSeit.split('-').reverse().join('.')}
          {s.dienstplanungFreiVon ? ` von ${s.dienstplanungFreiVon}` : ''}
        </p>
      )}
      {/*
        §202 Die Einrichtung, die mit dem Paket kommt. Angelegt wird sie beim
        Zuweisen — und für Standorte, deren Paket schon vorher zugewiesen war,
        hier per Knopf oder spätestens beim ersten Planungslauf.
      */}
      {s.rulePackId && !s.paketFehlt && (
        <div data-test="einrichtung" className="rounded-xl bg-white border border-gray-100 p-2.5 space-y-1.5">
          <p className="text-xs text-gray-600">
            <span className="font-semibold text-navy">Am Standort:</span>{' '}
            {s.dienstzeiten} Dienstzeiten · {s.einheiten} Etagen/Gruppen
          </p>
          {s.dienstzeiten === 0 && (paket?.einrichtung ? (
            <button
              onClick={() => aendern(s.id, { einrichtungAnwenden: true })}
              disabled={arbeitet}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white bg-brand disabled:opacity-40">
              Einrichtung aus dem Paket anlegen ({paket.einrichtung.dienstzeiten.length} Dienstzeiten)
            </button>
          ) : (
            <p className="text-xs text-amber-800">
              Dieses Paket bringt keine Dienstzeiten mit. Ohne sie entsteht kein Plan — sie
              gehören ins Paket ({s.rulePackId}).
            </p>
          ))}
          {paket?.einrichtungFehler && (
            <p className="text-xs text-amber-800">
              Die Einrichtung im Paket ist fehlerhaft: {paket.einrichtungFehler.join('; ')}
            </p>
          )}
        </div>
      )}

      {s.rulePackId && !s.paketFehlt && (
        <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
          <Package size={12} />
          {paket?.beschreibung ?? s.rulePackId}
        </p>
      )}

      {/* §161 Ein zugeordnetes Musterpaket ist ein Zwischenstand. Wer
          es zuordnet und dann vergisst, plant dauerhaft mit Regeln,
          die fuer niemanden gemacht wurden. */}
      {musterHinweis(paket) && (
        <div className="flex items-start gap-2 rounded-xl bg-sky-50 border border-sky-200 p-2.5">
          <Package size={14} className="text-sky-600 shrink-0 mt-0.5" />
          <p className="text-xs text-sky-900">{musterHinweis(paket)}</p>
        </div>
      )}

      {/*
        §183 Die Belegschaft gehört zum Einrichten dazu. Wer das
        Regelpaket baut, hat die Liste ohnehin vor sich — und ohne
        Mitarbeiter mit Stunden und Tagesmustern läuft kein erster
        Plan, egal wie gut das Paket ist.
      */}
      <BelegschaftEinspielen
        locationId={s.id}
        standortName={s.kunde ?? s.name}
        gruppen={gruppen}
      />
    </div>
  )
}
