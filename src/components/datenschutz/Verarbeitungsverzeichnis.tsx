'use client'

import { useState, useEffect } from 'react'
import {
  Loader2, FileText, Printer, AlertTriangle, ShieldCheck, ChevronDown,
} from 'lucide-react'

/**
 * §152 Das Verarbeitungsverzeichnis, wie man es einer Aufsichtsbehörde vorlegt.
 *
 * WARUM DRUCKEN UND NICHT HERUNTERLADEN
 * Weil die Behörde ein Dokument will und der Browser eins erzeugen kann. Ein
 * eigener PDF-Erzeuger wäre eine Abhängigkeit mehr, die bei jeder Änderung des
 * Verzeichnisses gepflegt werden müsste — und das Ergebnis sähe schlechter aus.
 *
 * WARUM DIE OFFENEN PUNKTE OBEN STEHEN UND NICHT IM ANHANG
 * Weil sie der Teil sind, den man kennen muss, bevor man das Dokument aus der
 * Hand gibt. Ein Verzeichnis, das seine eigenen Lücken versteckt, ist im
 * Ernstfall schlimmer als keines.
 */

interface Taetigkeit {
  id: string
  bezeichnung: string
  zweck: string
  rechtsgrundlage: string
  betroffene: string
  daten: string
  empfaenger: string[]
  loeschung: string
}

interface Massnahme {
  id: string
  rubrik: string
  bezeichnung: string
  beschreibung: string
  stand: string
  beleg?: string
  luecke?: string
}

interface Antwort {
  art: 'verantwortlicher' | 'auftragsverarbeiter'
  verzeichnis: {
    stand: string
    verantwortlicher?: { name: string; anschrift: string | null; kontakt: string | null }
    auftragsverarbeiter?: unknown
    auftraggeber?: string
    taetigkeiten?: Taetigkeit[]
    kategorien?: { bezeichnung: string; beschreibung: string }[]
    unterauftraege?: {
      name: string; zweck: string; ort: string; daten: string
      vertrag: string; drittland?: string
    }[]
    drittlaender?: { empfaenger: string; land: string; grundlage: string }[]
    ergaenzen?: string[]
    offen?: string[]
  }
  massnahmen: {
    rubriken: Record<string, string>
    standText: Record<string, string>
    eintraege: Massnahme[]
    zusammenfassung: Record<string, number>
  }
  auftragsverarbeiter?: { name: string }
}

const STAND_FARBE: Record<string, string> = {
  umgesetzt: 'bg-teal-50 text-teal-700',
  betreiber: 'bg-blue-50 text-blue-700',
  teilweise: 'bg-amber-50 text-amber-800',
  offen: 'bg-red-50 text-red-700',
}

export function Verarbeitungsverzeichnis() {
  const [d, setD] = useState<Antwort | null>(null)
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [zeigeMassnahmen, setZeigeMassnahmen] = useState(false)

  useEffect(() => {
    fetch('/api/dsgvo/verzeichnis')
      .then(async r => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error ?? 'Das Verzeichnis ist nicht abrufbar.')
        return j
      })
      .then(setD)
      .catch(e => setFehler(e.message))
      .finally(() => setLaden(false))
  }, [])

  if (laden) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-gray-300" />
      </div>
    )
  }
  if (fehler || !d) {
    return (
      <p className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm
                    text-red-700">{fehler}</p>
    )
  }

  const v = d.verzeichnis
  const offen = [...(v.offen ?? []), ...(v.ergaenzen ?? [])]

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 print:hidden">
        <p className="text-sm text-gray-500 max-w-2xl">
          {d.art === 'verantwortlicher'
            ? 'Euer Verzeichnis nach Art. 30 Abs. 1 DSGVO — erzeugt aus dem, '
              + 'was das Programm tatsächlich speichert. Die Maßnahmen des '
              + 'Auftragsverarbeiters (Art. 32) gehören als Anlage dazu.'
            : 'Das Verzeichnis nach Art. 30 Abs. 2 DSGVO für OKUN als '
              + 'Auftragsverarbeiter.'}
        </p>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 bg-navy text-white text-xs
                     font-semibold px-3.5 py-2 rounded-lg shrink-0">
          <Printer size={14} /> Drucken / als PDF sichern
        </button>
      </div>

      {offen.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="flex items-center gap-2 font-bold text-amber-900">
            <AlertTriangle size={16} />
            {offen.length} {offen.length === 1 ? 'Punkt' : 'Punkte'} fehlen noch
          </p>
          <p className="text-sm text-amber-800 mt-1.5">
            Das Verzeichnis ist erst vollständig, wenn diese Angaben ergänzt
            sind. Es hier zu verschweigen wäre gefährlicher, als es zu zeigen.
          </p>
          <ul className="mt-3 space-y-1.5">
            {offen.map((o, i) => (
              <li key={i} className="text-sm text-amber-900 flex gap-2">
                <span>•</span><span>{o}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <article className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8
                          space-y-6 print:border-0 print:p-0">
        <header>
          <h2 className="text-xl font-bold text-navy">
            Verzeichnis von Verarbeitungstätigkeiten
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {d.art === 'verantwortlicher'
              ? 'nach Art. 30 Abs. 1 DSGVO (Verantwortlicher)'
              : 'nach Art. 30 Abs. 2 DSGVO (Auftragsverarbeiter)'}
            {' · '}Stand {new Date(v.stand).toLocaleDateString('de-DE')}
          </p>
        </header>

        {v.verantwortlicher && (
          <section>
            <h3 className="font-bold text-navy text-sm uppercase tracking-wide">
              Verantwortlicher
            </h3>
            <dl className="mt-2 text-sm space-y-1">
              <Zeile k="Name" w={v.verantwortlicher.name} />
              <Zeile k="Anschrift" w={v.verantwortlicher.anschrift} />
              <Zeile k="Kontakt" w={v.verantwortlicher.kontakt} />
              <Zeile k="Auftragsverarbeiter"
                w={d.auftragsverarbeiter?.name ?? null} />
            </dl>
          </section>
        )}

        {v.auftraggeber && (
          <section>
            <h3 className="font-bold text-navy text-sm uppercase tracking-wide">
              Für wen verarbeitet wird
            </h3>
            <p className="text-sm text-gray-700 mt-2 leading-relaxed">
              {v.auftraggeber}
            </p>
          </section>
        )}

        {v.kategorien && v.kategorien.length > 0 && (
          <section>
            <h3 className="font-bold text-navy text-sm uppercase tracking-wide">
              Kategorien der Verarbeitungen (Art. 30 Abs. 2 lit. b)
            </h3>
            <ul className="mt-2 space-y-2.5">
              {v.kategorien.map(k => (
                <li key={k.bezeichnung} className="text-sm">
                  <span className="font-semibold text-navy">{k.bezeichnung}</span>
                  <span className="block text-gray-600 leading-relaxed">
                    {k.beschreibung}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {v.taetigkeiten && v.taetigkeiten.length > 0 && (
          <section>
            <h3 className="font-bold text-navy text-sm uppercase tracking-wide">
              Verarbeitungstätigkeiten
            </h3>
            <div className="mt-2 space-y-4">
              {v.taetigkeiten.map(t => (
                <div key={t.id}
                  className="border border-gray-100 rounded-xl p-4 break-inside-avoid">
                  <p className="font-semibold text-navy">{t.bezeichnung}</p>
                  <dl className="mt-2 text-sm space-y-1">
                    <Zeile k="Zweck" w={t.zweck} />
                    <Zeile k="Rechtsgrundlage" w={t.rechtsgrundlage} />
                    <Zeile k="Betroffene" w={t.betroffene} />
                    <Zeile k="Daten" w={t.daten} />
                    <Zeile k="Empfänger"
                      w={t.empfaenger.length ? t.empfaenger.join(', ') : 'keine'} />
                    <Zeile k="Löschung" w={t.loeschung} />
                  </dl>
                </div>
              ))}
            </div>
          </section>
        )}

        {v.unterauftraege && v.unterauftraege.length > 0 && (
          <section>
            <h3 className="font-bold text-navy text-sm uppercase tracking-wide">
              Unterauftragsverarbeiter
            </h3>
            <div className="mt-2 space-y-3">
              {v.unterauftraege.map(u => (
                <div key={u.name}
                  className="border border-gray-100 rounded-xl p-4 break-inside-avoid">
                  <p className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-navy">{u.name}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5
                                      rounded-full ${u.vertrag === 'geschlossen'
                      ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-800'}`}>
                      {u.vertrag === 'geschlossen'
                        ? 'Vertrag geschlossen' : 'Vertrag offen'}
                    </span>
                  </p>
                  <dl className="mt-2 text-sm space-y-1">
                    <Zeile k="Zweck" w={u.zweck} />
                    <Zeile k="Ort" w={u.ort} />
                    <Zeile k="Daten" w={u.daten} />
                    {u.drittland && <Zeile k="Drittland" w={u.drittland} />}
                  </dl>
                </div>
              ))}
            </div>
          </section>
        )}
      </article>

      {/* Die Maßnahmen als Anlage — zugeklappt, weil sie lang sind, aber
          beim Drucken vollständig dabei. */}
      <section className="bg-white border border-gray-200 rounded-2xl
                          print:border-0">
        <button
          onClick={() => setZeigeMassnahmen(v2 => !v2)}
          className="w-full flex items-center justify-between gap-3 p-5 text-left
                     print:hidden">
          <span>
            <span className="font-bold text-navy flex items-center gap-2">
              <ShieldCheck size={16} className="text-teal-600" />
              Anlage: Technische und organisatorische Maßnahmen
            </span>
            <span className="block text-sm text-gray-500 mt-0.5">
              Art. 32 DSGVO · {d.massnahmen.eintraege.length} Maßnahmen ·{' '}
              {d.massnahmen.zusammenfassung.umgesetzt} umgesetzt
            </span>
          </span>
          <ChevronDown size={18}
            className={`text-gray-400 shrink-0 transition-transform
                        ${zeigeMassnahmen ? 'rotate-180' : ''}`} />
        </button>

        <div className={`px-5 pb-5 space-y-5 print:block
                         ${zeigeMassnahmen ? '' : 'hidden'}`}>
          <h3 className="hidden print:block font-bold text-navy">
            Anlage: Technische und organisatorische Maßnahmen (Art. 32 DSGVO)
          </h3>
          {Object.entries(d.massnahmen.rubriken).map(([r, titel]) => {
            const drin = d.massnahmen.eintraege.filter(m => m.rubrik === r)
            if (drin.length === 0) return null
            return (
              <div key={r} className="break-inside-avoid">
                <h4 className="text-sm font-bold text-navy">{titel}</h4>
                <ul className="mt-2 space-y-2.5">
                  {drin.map(m => (
                    <li key={m.id}
                      className="border border-gray-100 rounded-xl p-3.5">
                      <p className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-navy text-sm">
                          {m.bezeichnung}
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5
                                          rounded-full ${STAND_FARBE[m.stand]}`}>
                          {d.massnahmen.standText[m.stand]}
                        </span>
                      </p>
                      <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                        {m.beschreibung}
                      </p>
                      {m.luecke && (
                        <p className="text-sm text-amber-800 mt-1.5 leading-relaxed">
                          <strong>Offen:</strong> {m.luecke}
                        </p>
                      )}
                      {m.beleg && (
                        <p className="text-[11px] text-gray-400 mt-1.5 font-mono
                                      print:hidden">
                          {m.beleg}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      <p className="text-xs text-gray-400 flex items-start gap-2 print:hidden">
        <FileText size={13} className="shrink-0 mt-0.5" />
        Dieses Verzeichnis wird aus dem Datenkatalog des Programms erzeugt und
        bleibt damit auf dem Stand der Software. Es ersetzt nicht die Prüfung
        durch einen Datenschutzbeauftragten — und es kennt nur die
        Verarbeitungen, die über dieses Programm laufen.
      </p>
    </div>
  )
}

function Zeile({ k, w }: { k: string; w: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="text-gray-400 shrink-0 w-32">{k}</dt>
      <dd className={w ? 'text-gray-700' : 'text-amber-700 italic'}>
        {w ?? 'fehlt'}
      </dd>
    </div>
  )
}
