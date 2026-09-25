import type { Metadata } from 'next'
import { impressum, fehltAmImpressum, hinweiseZumImpressum } from '@/lib/rechtstexte'
import { Rechtsseite, Angabe } from '@/components/recht/Rechtsseite'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Anbieterkennzeichnung nach §5 DDG.',
}

/**
 * §153 Impressum nach §5 DDG.
 *
 * Pflicht für jedes geschäftsmäßige Online-Angebot — auch für eines, das
 * hinter der Anmeldung nur Betriebe bedient. Die Anmeldeseite selbst ist
 * öffentlich, und das genügt.
 */
export default function ImpressumSeite() {
  const i = impressum()
  const hinweise = hinweiseZumImpressum(i)

  return (
    <Rechtsseite
      titel="Impressum"
      untertitel="Angaben gemäß §5 DDG"
      fehlt={[...fehltAmImpressum(i), ...hinweise]}
    >
      <section>
        <h2 className="font-bold text-navy">Anbieter</h2>
        <dl className="mt-3 space-y-2">
          <Angabe k="Name" w={i.anbieter.name} />
          <Angabe k="Anschrift" w={i.anbieter.anschrift} />
          <Angabe k="Vertreten durch" w={i.anbieter.vertreten} />
          <Angabe k="E-Mail" w={i.anbieter.kontakt} />
          <Angabe k="Registergericht" w={i.register} />
          <Angabe k="Umsatzsteuer-ID" w={i.umsatzsteuerId} />
        </dl>
      </section>

      <section>
        <h2 className="font-bold text-navy">
          Inhaltlich verantwortlich (§18 Abs. 2 MStV)
        </h2>
        <dl className="mt-3">
          <Angabe k="Verantwortlich" w={i.inhaltlichVerantwortlich} />
        </dl>
      </section>

      <section>
        <h2 className="font-bold text-navy">Datenschutz</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">
          Wie wir mit personenbezogenen Daten umgehen, steht in der{' '}
          <a href="/datenschutz" className="text-teal-700 underline">
            Datenschutzerklärung
          </a>. Für die Daten, die ein Betrieb über seine Beschäftigten in
          diesem Programm führt, ist der jeweilige Betrieb Verantwortlicher —
          wir verarbeiten sie in seinem Auftrag.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-navy">Streitbeilegung</h2>
        <p className="mt-2 text-sm text-gray-700 leading-relaxed">
          {i.streitbeilegung}
        </p>
      </section>
    </Rechtsseite>
  )
}
