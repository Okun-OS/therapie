'use client'

import { useState, useRef } from 'react'
import { Loader2, CheckCircle2, Paperclip, X } from 'lucide-react'

/**
 * §148 Das Bewerbungsformular.
 *
 * WARUM SO WENIGE FELDER
 * Weil jedes Pflichtfeld Bewerber kostet. Name und E-Mail müssen sein, alles
 * andere ist freiwillig. Wer einen Lebenslauf hat, lädt ihn hoch; wer gerade
 * am Handy in der Bahn sitzt, schreibt drei Sätze und wird zurückgerufen.
 *
 * DAS UNSICHTBARE FELD
 * `webseite` sieht kein Mensch — es liegt außerhalb des Bildschirms und ist
 * für Vorlesegeräte ausgeblendet. Ein Automat, der Formulare ausfüllt, füllt
 * es aus, und der Server verwirft die Sendung wortlos. Ein Captcha würde
 * dasselbe leisten und dabei echte Bewerber vertreiben.
 *
 * WAS NACH DEM ABSCHICKEN PASSIERT
 * Die Seite zeigt eine Bestätigung und lädt nicht neu. Der Bewerber bekommt
 * zusätzlich eine E-Mail — sonst weiß er am Abend nicht mehr, ob er auf
 * „Absenden" gedrückt hat.
 */

export function Bewerbungsformular({ kunde, stelle, stellenTitel, betrieb }: {
  kunde: string
  stelle: string | null
  stellenTitel: string | null
  betrieb: string
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [telefon, setTelefon] = useState('')
  const [nachricht, setNachricht] = useState('')
  const [webseite, setWebseite] = useState('')
  const [datei, setDatei] = useState<File | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [fertig, setFertig] = useState(false)
  const dateiFeld = useRef<HTMLInputElement>(null)

  async function absenden(e: React.FormEvent) {
    e.preventDefault()
    setFehler(null)
    setLaeuft(true)
    try {
      const form = new FormData()
      form.set('name', name)
      form.set('email', email)
      form.set('telefon', telefon)
      form.set('nachricht', nachricht)
      form.set('webseite', webseite)
      if (stelle) form.set('stelle', stelle)
      if (datei) form.set('datei', datei)

      const res = await fetch(`/api/karriere/${encodeURIComponent(kunde)}`, {
        method: 'POST', body: form,
      })
      const daten = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(daten.error ?? 'Das hat gerade nicht geklappt.')
      setFertig(true)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Das hat gerade nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  if (fertig) {
    return (
      <div className="mt-5 bg-white border border-teal-200 rounded-2xl p-6 sm:p-8
                      flex gap-4 items-start">
        <CheckCircle2 size={26} className="text-teal-600 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-bold text-navy text-lg">Angekommen.</h2>
          <p className="text-gray-600 mt-1.5 leading-relaxed">
            Danke, {name.split(' ')[0]} — deine Bewerbung
            {stellenTitel ? ` auf „${stellenTitel}“` : ''} liegt bei uns.
            Wir haben dir eine Bestätigung an {email} geschickt und melden uns.
          </p>
          <p className="text-sm text-gray-400 mt-3">{betrieb}</p>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={absenden}
      className="mt-5 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
      <h2 className="font-bold text-navy text-lg">
        {stellenTitel ? 'Jetzt bewerben' : 'Initiativ bewerben'}
      </h2>
      <p className="text-sm text-gray-500 mt-1">
        Name und E-Mail genügen. Alles Weitere gern, muss aber nicht.
      </p>

      <div className="mt-5 grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs font-semibold text-gray-500">Name *</span>
          <input
            id="bewerbung-name"
            value={name} onChange={e => setName(e.target.value)}
            required autoComplete="name"
            className="mt-1 w-full border border-gray-300 rounded-xl px-3.5 py-2.5
                       focus:border-teal-500 focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-500">E-Mail *</span>
          <input
            id="bewerbung-email" type="email"
            value={email} onChange={e => setEmail(e.target.value)}
            required autoComplete="email"
            className="mt-1 w-full border border-gray-300 rounded-xl px-3.5 py-2.5
                       focus:border-teal-500 focus:outline-none" />
        </label>
      </div>

      <label className="block mt-4">
        <span className="text-xs font-semibold text-gray-500">Telefon</span>
        <input
          id="bewerbung-telefon" value={telefon} onChange={e => setTelefon(e.target.value)}
          autoComplete="tel"
          className="mt-1 w-full border border-gray-300 rounded-xl px-3.5 py-2.5
                     focus:border-teal-500 focus:outline-none" />
      </label>

      <label className="block mt-4">
        <span className="text-xs font-semibold text-gray-500">
          Deine Nachricht
        </span>
        <textarea
          id="bewerbung-nachricht" rows={5}
          value={nachricht} onChange={e => setNachricht(e.target.value)}
          placeholder={stellenTitel
            ? 'Was dich an der Stelle reizt, was du mitbringst, ab wann du kannst.'
            : 'Was du suchst und was du mitbringst.'}
          className="mt-1 w-full border border-gray-300 rounded-xl px-3.5 py-2.5
                     focus:border-teal-500 focus:outline-none resize-y" />
      </label>

      {/* Der Honigtopf — außerhalb des Bildschirms und für Vorlesegeräte aus. */}
      <div aria-hidden="true" className="absolute left-[-9999px] w-px h-px overflow-hidden">
        <label htmlFor="bewerbung-webseite">Webseite (bitte frei lassen)</label>
        <input
          id="bewerbung-webseite" name="webseite" tabIndex={-1} autoComplete="off"
          value={webseite} onChange={e => setWebseite(e.target.value)} />
      </div>

      <div className="mt-4">
        <input
          ref={dateiFeld} type="file" className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
          onChange={e => setDatei(e.target.files?.[0] ?? null)} />
        {datei ? (
          <div className="flex items-center gap-2 text-sm bg-gray-50 border
                          border-gray-200 rounded-xl px-3.5 py-2.5">
            <Paperclip size={15} className="text-gray-400" />
            <span className="flex-1 truncate">{datei.name}</span>
            <span className="text-gray-400 text-xs">
              {(datei.size / 1024 / 1024).toFixed(1)} MB
            </span>
            <button
              type="button" onClick={() => { setDatei(null); if (dateiFeld.current) dateiFeld.current.value = '' }}
              className="text-gray-400 hover:text-gray-600" aria-label="Datei entfernen">
              <X size={15} />
            </button>
          </div>
        ) : (
          <button
            type="button" onClick={() => dateiFeld.current?.click()}
            className="flex items-center gap-2 text-sm font-medium text-gray-600
                       border border-dashed border-gray-300 rounded-xl px-3.5 py-2.5
                       w-full hover:border-teal-500">
            <Paperclip size={15} /> Lebenslauf anhängen (PDF oder Foto, optional)
          </button>
        )}
      </div>

      {fehler && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200
                      rounded-xl px-3.5 py-2.5">{fehler}</p>
      )}

      <button
        type="submit" disabled={laeuft}
        className="mt-5 w-full sm:w-auto bg-teal-600 text-white font-semibold
                   px-6 py-3 rounded-xl flex items-center justify-center gap-2
                   disabled:opacity-60">
        {laeuft && <Loader2 size={16} className="animate-spin" />}
        {laeuft ? 'Wird gesendet…' : 'Bewerbung absenden'}
      </button>

      <p className="mt-4 text-xs text-gray-400 leading-relaxed">
        Mit dem Absenden willigst du ein, dass {betrieb} deine Angaben zur
        Bearbeitung deiner Bewerbung verarbeitet. Kommt es nicht zu einer
        Einstellung, werden sie sechs Monate nach Abschluss des Verfahrens
        gelöscht. Näheres unter &bdquo;Datenschutz&ldquo;.
      </p>
    </form>
  )
}
