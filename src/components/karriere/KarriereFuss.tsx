'use client'

import { useState } from 'react'

/**
 * §148 Der Fuß der Karriereseite — Impressum und Datenschutz.
 *
 * WARUM DAS NICHT NUR EIN LINK IST
 * Weil es sonst eine zweite Seite bräuchte, die wieder gepflegt werden will.
 * Hier steht der Text, den der Betrieb hinterlegt hat, und er klappt auf. Das
 * genügt der Pflicht aus §5 DDG: „leicht erkennbar, unmittelbar erreichbar und
 * ständig verfügbar".
 *
 * WARUM DER DATENSCHUTZHINWEIS EINEN VORGEGEBENEN TEIL HAT
 * Weil er für alle gleich ist: Was mit einer Bewerbung geschieht, wie lange
 * sie liegt und wann sie gelöscht wird, hängt am Programm und nicht am
 * Betrieb. Den Rest — Verantwortlicher, Datenschutzbeauftragter — trägt der
 * Betrieb ein.
 */
export function KarriereFuss({ betrieb, impressum, datenschutz }: {
  betrieb: string
  impressum: string
  datenschutz: string | null
}) {
  const [offen, setOffen] = useState<'impressum' | 'datenschutz' | null>(null)

  return (
    <footer className="border-t border-gray-200 bg-white mt-8">
      <div className="max-w-3xl mx-auto px-5 py-8 text-sm">
        <div className="flex flex-wrap gap-4">
          {(['impressum', 'datenschutz'] as const).map(was => (
            <button
              key={was}
              onClick={() => setOffen(offen === was ? null : was)}
              className={`font-semibold ${offen === was ? 'text-navy' : 'text-gray-500'}`}>
              {was === 'impressum' ? 'Impressum' : 'Datenschutz'}
            </button>
          ))}
        </div>

        {offen === 'impressum' && (
          <div className="mt-4 text-gray-600 whitespace-pre-line leading-relaxed">
            {impressum}
          </div>
        )}

        {offen === 'datenschutz' && (
          <div className="mt-4 text-gray-600 whitespace-pre-line leading-relaxed space-y-3">
            {datenschutz && <p>{datenschutz}</p>}
            <p>
              Deine Bewerbungsdaten verarbeiten wir ausschließlich, um über
              deine Bewerbung zu entscheiden (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b
              DSGVO, §26 BDSG). Kommt es nicht zu einer Einstellung, löschen wir
              sie sechs Monate nach Abschluss des Verfahrens — es sei denn, du
              willigst ausdrücklich ein, dass wir sie länger aufbewahren dürfen.
            </p>
            <p>
              Du kannst jederzeit Auskunft über deine Daten verlangen und ihre
              Löschung fordern. Wende dich dafür an {betrieb}.
            </p>
          </div>
        )}

        <p className="mt-6 text-xs text-gray-400">
          Bewerbungen laufen über OKUN Workforce.
        </p>
      </div>
    </footer>
  )
}
