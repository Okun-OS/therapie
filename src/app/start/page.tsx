import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/session'
import { Logo } from '@/components/ui/Logo'

/**
 * §254 Was unter `/` steht, wenn jemand angemeldet ist.
 *
 * DIE MELDUNG, ZUM VIERTEN MAL
 * „Ich sehe immer noch die Webseite, wenn ich auf die App gehe. Immer noch."
 *
 * MEIN DENKFEHLER, VIERMAL WIEDERHOLT
 * Ich habe dreimal die Weiterleitung repariert — in der Middleware, im
 * Dienst-Arbeiter, in den Kopfzeilen. Jedes Mal nachgemessen, jedes Mal
 * richtig. Und jedes Mal am Problem vorbei.
 *
 * Denn eine Weiterleitung ZEICHNET NICHTS. Ein iPhone zeigt beim Öffnen einer
 * Adresse zuerst ein Standbild dessen, was dort zuletzt zu sehen war, und
 * holt die Seite im Hintergrund. Unter `/` war zuletzt die Verkaufsseite zu
 * sehen — und seit meinen Korrekturen wird dort NIE WIEDER etwas gezeichnet,
 * weil sofort weitergeleitet wird. Das alte Standbild ist damit eingefroren.
 * Jede weitere Verbesserung an der Weiterleitung konnte daran nichts ändern;
 * sie hat das Standbild im Gegenteil für immer festgenagelt.
 *
 * Das ist die unangenehmste Art Fehler: Jede einzelne Messung war richtig,
 * und die Schlussfolgerung trotzdem falsch, weil ich die falsche Frage
 * gemessen habe.
 *
 * WAS JETZT PASSIERT
 * Die Middleware LEITET `/` für Angemeldete nicht mehr WEITER, sondern
 * SCHREIBT es auf diese Seite UM. Die Adresse bleibt `/`, und hier steht
 * etwas: der dunkle Hintergrund der App mit dem Wappen. Damit ist das
 * Standbild unter `/` ab dem ersten Öffnen die App und nicht mehr die
 * Verkaufsseite.
 *
 * Danach geht es sofort weiter — im Browser, ohne weitere Anfrage an den
 * Server, weil das Ziel schon hier feststeht.
 *
 * WARUM NICHT GLEICH DIE ANWENDUNG HIER
 * Weil `/` dann für jeden Aufruf die ganze Anwendung laden müsste, auch für
 * Suchmaschinen und Interessenten. Diese Seite wiegt nichts und ist in dem
 * Augenblick fertig, in dem sie ankommt.
 */

export const dynamic = 'force-dynamic'

const ZIELE: Record<string, string> = {
  employee: '/employee',
  admin: '/admin',
  okun: '/okun',
  company: '/company',
}

export default async function Start() {
  const marke = (await cookies()).get('okun_session')?.value
  const sitzung = verifySessionToken(marke)
  const ziel = sitzung ? ZIELE[sitzung.role] ?? '/login' : '/login'

  return (
    <div
      className="min-h-screen bg-navy-900 flex items-center justify-center"
      data-test="app-start"
    >
      {/*
        §254 Kein Text, kein Ladebalken.
        Diese Seite ist im Normalfall einen Wimpernschlag zu sehen. Was hier
        steht, muss nur eines leisten: so aussehen wie die App und nicht wie
        eine Werbeseite — denn genau als Standbild wird es wiederverwendet.
      */}
      <Logo className="h-12 w-auto opacity-90" />

      {/*
        Weiterleiten, sobald das Dokument gelesen ist. `replace` statt
        `assign`: Sonst läge diese Zwischenstation im Verlauf, und der
        Zurück-Knopf führte im Kreis.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: `location.replace(${JSON.stringify(ziel)})`,
        }}
      />
      <noscript>
        {/* Ohne Skript bleibt der Weg über einen Verweis offen. */}
        <a href={ziel} className="text-white underline">Weiter zur App</a>
      </noscript>
    </div>
  )
}
