import { NextResponse } from 'next/server'
import { r2Eingerichtet } from '@/lib/r2'

/**
 * §236 Der Lebenszeichen-Pfad für die Anlage.
 *
 * WARUM ES IHN GIBT
 * Railway prüft nach jedem Ausrollen, ob die neue Fassung antwortet. Bis
 * hierher prüfte es `/` — die Startseite, die durch die Middleware läuft. Das
 * ging gut, bis §235 eine Weiterleitung auf die kanonische Domain einbaute:
 * Der Prüfer kommt mit `Host: healthcheck.railway.app`, bekam ein 308 statt
 * eines 200 und wertete das als „antwortet nicht". Drei Ausrollungen wurden so
 * verworfen, obwohl Build und Migration sauber durchliefen.
 *
 * Die Ausnahme für diesen Host steht in `kanonische-domain.ts`. Dieser Pfad
 * ist die zweite Absicherung, und zwar die haltbarere: Er liegt unter `/api`,
 * und damit greift die Weiterleitung hier NIE — auch dann nicht, wenn Railway
 * seinen Prüfer eines Tages anders nennt. Eine Ausnahmeliste, die jemand
 * pflegen muss, ist eine Ausnahmeliste, die irgendwann veraltet.
 *
 * WAS ER NICHT TUT
 * Keine Datenbankabfrage. Ein Lebenszeichen beantwortet „läuft der Dienst",
 * nicht „ist alles in Ordnung". Hinge es an der Datenbank, nähme eine kurze
 * Störung dort die ganze Anwendung mit — Railway würde die laufende Fassung
 * verwerfen und eine neue starten, die genau dieselbe Datenbank nicht
 * erreicht.
 */
export const dynamic = 'force-dynamic'

export function GET() {
  /*
   * §258 Ein zweites Feld: ob der Objektspeicher eingerichtet ist.
   *
   * WARUM HIER UND NICHT HINTER EINER ANMELDUNG
   * Weil es die einzige Angabe ist, die beim Einrichten gebraucht wird und
   * die von außen prüfbar sein muss: Sind die fünf Werte in Railway
   * angekommen? Ohne sie lässt sich das nur erraten — und Raten hat in diesem
   * Vorhaben schon genug Zeit gekostet.
   *
   * WAS DABEI NICHT HERAUSGEHT
   * Nur ein Ja oder Nein. Kein Eimername, keine Kontonummer, kein Schlüssel.
   * Dass ein Dienst einen Objektspeicher benutzt, ist keine Auskunft, die
   * jemandem nützt; die Zugangsdaten wären eine.
   */
  /*
   * §259 Zwei getrennte Speicher, zwei getrennte Auskünfte. `programm` hält
   * die Windows-Aktualisierungen (§210), `dateien` die Anhänge und
   * Bescheinigungen. Sie in eine Angabe zusammenzufassen hieße, nicht sehen
   * zu können, welcher von beiden fehlt.
   */
  /*
   * §264 Welcher Stand hier läuft — und warum das hier steht.
   *
   * „Hat sich gar nichts verändert." Dieser Satz ist fünfzehnmal gefallen,
   * und jedes Mal stand die Frage dahinter, die niemand beantworten konnte:
   * Läuft auf diesem Gerät überhaupt schon der neue Stand?
   *
   * Der Server war längst richtig; auf dem Telefon lag eine alte Kopie im
   * Speicher des Dienst-Arbeiters. Beides hätte sich in zehn Sekunden klären
   * lassen, wenn irgendwo eine Nummer gestanden hätte, die man vergleichen
   * kann. Es stand keine da.
   *
   * Jetzt steht sie hier — und in der App unter „Profil", damit sie auch
   * jemand ablesen kann, der kein Fenster zum Server hat.
   */
  const stand = process.env.RAILWAY_GIT_COMMIT_SHA
    ?? process.env.VERCEL_GIT_COMMIT_SHA
    ?? null

  return NextResponse.json({
    status: 'ok',
    stand: stand ? stand.slice(0, 7) : 'unbekannt',
    gebautAm: process.env.RAILWAY_DEPLOYMENT_CREATED_AT ?? null,
    speicher: {
      programm: r2Eingerichtet('programm') ? 'eingerichtet' : 'fehlt',
      dateien: r2Eingerichtet('dateien') ? 'eingerichtet' : 'fehlt',
    },
  })
}
