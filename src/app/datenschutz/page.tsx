import type { Metadata } from 'next'
import { datenschutzerklaerung } from '@/lib/rechtstexte'
import { Rechtsseite, Angabe } from '@/components/recht/Rechtsseite'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Datenschutzerklärung',
  description: 'Wie OKUN Workforce mit personenbezogenen Daten umgeht.',
}

/**
 * §153 Datenschutzerklärung nach Art. 13 DSGVO.
 *
 * Die Abschnitte werden zum Teil aus dem Datenkatalog und der Liste der
 * Dienstleister erzeugt (§128, §152). Der Teil, der am schnellsten veraltet —
 * wer die Daten sieht und wie lange sie bleiben —, steht damit nur an einer
 * Stelle und kann nicht auseinanderlaufen.
 */
export default function DatenschutzSeite() {
  const d = datenschutzerklaerung()

  return (
    <Rechtsseite
      titel="Datenschutzerklärung"
      untertitel={`Stand ${new Date(d.stand).toLocaleDateString('de-DE')}`}
      fehlt={d.fehlt}
    >
      <section>
        <h2 className="font-bold text-navy">Verantwortlicher für diese Seiten</h2>
        <dl className="mt-3 space-y-2">
          <Angabe k="Name" w={d.anbieter.name} />
          <Angabe k="Anschrift" w={d.anbieter.anschrift} />
          <Angabe k="E-Mail" w={d.anbieter.kontakt} />
          <Angabe k="Datenschutzbeauftragter" w={d.anbieter.datenschutzbeauftragter} />
        </dl>
      </section>

      {d.abschnitte.map(a => (
        <section key={a.id}>
          <h2 className="font-bold text-navy">{a.ueberschrift}</h2>
          {a.grundlage && (
            <p className="text-xs text-gray-400 mt-0.5">{a.grundlage}</p>
          )}
          <div className="mt-2 space-y-2.5">
            {a.absaetze.filter(Boolean).map((p, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">{p}</p>
            ))}
          </div>
          {a.punkte && a.punkte.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {a.punkte.map((p, i) => (
                <li key={i} className="text-sm text-gray-600 flex gap-2">
                  <span className="text-teal-600">•</span><span>{p}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </Rechtsseite>
  )
}
