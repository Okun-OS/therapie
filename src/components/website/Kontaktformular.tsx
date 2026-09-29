'use client'

import { useState } from 'react'
import { Check, AlertTriangle, Loader } from 'lucide-react'

/**
 * §177 Das Kontaktformular.
 *
 * ZWEI ENTSCHEIDUNGEN, DIE MAN NICHT SIEHT
 *
 *   Nur drei Pflichtfelder. Jedes weitere kostet Anfragen — und Telefon und
 *   Einrichtung kann man auch im Gespräch erfragen.
 *
 *   Ein Köderfeld für Bots (`webseite`). Es ist für Menschen unsichtbar,
 *   aber nicht mit `display: none` versteckt, weil manche Bots genau darauf
 *   achten. Wer es ausfüllt, bekommt dieselbe freundliche Antwort und wird
 *   nicht gespeichert.
 */

const LEER = { name: '', email: '', einrichtung: '', telefon: '', nachricht: '', webseite: '' }

export function Kontaktformular() {
  const [werte, setWerte] = useState(LEER)
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  const [gesendet, setGesendet] = useState(false)

  const setzen = (feld: keyof typeof LEER) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setWerte(w => ({ ...w, [feld]: e.target.value }))

  async function absenden(e: React.FormEvent) {
    e.preventDefault()
    setFehler('')
    setLaeuft(true)
    try {
      const res = await fetch('/api/kontakt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(werte),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFehler(d.error ?? 'Das hat gerade nicht geklappt. Bitte noch einmal versuchen.')
        return
      }
      setGesendet(true)
      setWerte(LEER)
    } catch {
      setFehler(
        'Keine Verbindung. Bitte noch einmal versuchen — oder uns direkt '
        + 'eine E-Mail schreiben.')
    } finally {
      setLaeuft(false)
    }
  }

  if (gesendet) {
    return (
      <div
        data-test="kontakt-danke"
        className="flex flex-col items-start justify-center rounded-3xl border border-brand/25 bg-brand/5 p-8 sm:p-10"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/15">
          <Check size={20} className="text-brand" />
        </span>
        <p className="mt-5 text-xl font-bold text-white">Angekommen.</p>
        <p className="mt-2 max-w-sm leading-relaxed text-navy-300">
          Wir melden uns innerhalb eines Werktags. Wenn es eilt, schreiben
          Sie uns gern zusätzlich direkt — die Adresse steht links.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={absenden}
      data-test="kontaktformular"
      className="rounded-3xl border border-white/8 bg-navy-800/40 p-6 sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Feld label="Ihr Name" pflicht>
          <input
            required value={werte.name} onChange={setzen('name')}
            data-test="kontakt-name" autoComplete="name"
            className={EINGABE} placeholder="Vor- und Nachname"
          />
        </Feld>
        <Feld label="E-Mail" pflicht>
          <input
            required type="email" value={werte.email} onChange={setzen('email')}
            data-test="kontakt-email" autoComplete="email"
            className={EINGABE} placeholder="name@einrichtung.de"
          />
        </Feld>
        <Feld label="Einrichtung">
          <input
            value={werte.einrichtung} onChange={setzen('einrichtung')}
            data-test="kontakt-einrichtung" autoComplete="organization"
            className={EINGABE} placeholder="Name und Ort"
          />
        </Feld>
        <Feld label="Telefon">
          <input
            type="tel" value={werte.telefon} onChange={setzen('telefon')}
            data-test="kontakt-telefon" autoComplete="tel"
            className={EINGABE} placeholder="für den kurzen Weg"
          />
        </Feld>
      </div>

      <div className="mt-4">
        <Feld label="Worum geht es?" pflicht>
          <textarea
            required rows={5} value={werte.nachricht} onChange={setzen('nachricht')}
            data-test="kontakt-nachricht"
            className={`${EINGABE} resize-none`}
            placeholder="Wie viele Standorte, wie viele Beschäftigte — und was beim Planen jedes Mal weh tut."
          />
        </Feld>
      </div>

      {/*
        §177 Das Köderfeld. Für Menschen unsichtbar, für Bots verlockend.
        Nicht `display: none`, weil manche Bots genau darauf prüfen.
      */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Webseite
          <input
            tabIndex={-1} autoComplete="off"
            value={werte.webseite} onChange={setzen('webseite')}
          />
        </label>
      </div>

      {fehler && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-400" />
          <p className="text-sm text-amber-200" data-test="kontakt-fehler">{fehler}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={laeuft}
        data-test="kontakt-senden"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3.5 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
      >
        {laeuft && <Loader size={15} className="animate-spin" />}
        {laeuft ? 'Wird gesendet …' : 'Anfrage senden'}
      </button>
    </form>
  )
}

const EINGABE =
  'w-full rounded-xl border border-white/10 bg-navy-900 px-3.5 py-2.5 text-sm '
  + 'text-white placeholder:text-navy-500 focus:border-brand/50 focus:outline-none '
  + 'focus:ring-1 focus:ring-brand/30'

function Feld({ label, pflicht, children }: {
  label: string
  pflicht?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-navy-400">
        {label}
        {pflicht && <span className="ml-1 text-gold">*</span>}
      </span>
      {children}
    </label>
  )
}
