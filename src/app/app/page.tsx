import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken } from '@/lib/session'

/**
 * §239 Die Startadresse der App — und zwar eine ohne Verkaufsseite darauf.
 *
 * DIE MELDUNG
 * „Wenn ich auf die App gehe, dann kommt immer erst diese Kack-Website. Das
 * darf aber nicht sein. Ich muss direkt, wenn ich angemeldet bin, auch auf die
 * Seite kommen und nicht erst die Website kommen. Das hatten wir ja schon mal."
 *
 * WARUM §201 DAS NICHT ERLEDIGT HAT
 * §201 hat die Weiterleitung vom Browser in die Middleware verlegt, damit die
 * Verkaufsseite nicht mehr aufblitzt. Nachgemessen tut sie das auch: `/` mit
 * gültiger Sitzung antwortet mit 307 auf `/employee`.
 *
 * Nur erreicht die App diese Weiterleitung gar nicht. Zwei Dinge wirken
 * zusammen:
 *
 *   1. Im Manifest stand `start_url: "/"` — die App fragte also immer nach der
 *      Adresse der Verkaufsseite.
 *   2. Der Dienst-Arbeiter hatte genau diese Seite VORGESPEICHERT
 *      (`STATIC_ASSETS` enthielt `'/'`). Beim Öffnen wird sie aus dem
 *      Zwischenspeicher ausgeliefert, sobald das Netz langsam ist — und dann
 *      läuft keine Middleware, sondern es erscheint die Verkaufsseite.
 *      Danach greift die Weiterleitung im Browser. Genau das sieht man:
 *      erst die Website, dann die App.
 *
 * Eine Weiterleitung kann man nicht zwischenspeichern — eine Seite schon.
 * Darum bekommt die App eine eigene Startadresse, auf der nie etwas anderes
 * steht als eine Weiterleitung. Der Dienst-Arbeiter speichert `/` nicht mehr
 * vor, und die Fassung der Zwischenspeicher wurde erhöht, damit die alte
 * gespeicherte Verkaufsseite auf allen Geräten verschwindet.
 *
 * WARUM HIER NICHTS ZU SEHEN IST
 * Es gibt keinen Inhalt — nur die Entscheidung, wohin. Wer keine gültige
 * Sitzung mitbringt, landet bei der Anmeldung; die Verkaufsseite bleibt unter
 * `/` für alle, die sie suchen.
 */

export const dynamic = 'force-dynamic'

const ZIELE: Record<string, string> = {
  employee: '/employee',
  admin: '/admin',
  okun: '/okun',
  company: '/company',
}

export default async function AppStart() {
  const marke = (await cookies()).get('okun_session')?.value
  const sitzung = verifySessionToken(marke)
  redirect(sitzung ? ZIELE[sitzung.role] ?? '/login' : '/login')
}
