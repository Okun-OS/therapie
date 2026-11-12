/**
 * §238 Unter welcher Adresse dieses Programm erreichbar ist.
 *
 * DIE MELDUNG, DREIMAL
 * „Bei dieser Google-Kalender-Synchronisation steht immer noch diese
 * Therapie-Domain. Die kommt auch als Host, wenn ich eine Push-Nachricht
 * bekomme. Das muss auf okun-workforce.com gesetzt werden."
 *
 * WARUM ES BIS HIERHER NICHT GEHOLFEN HAT, `APP_URL` ZU LESEN
 * §228 hat die Abo-Adresse richtig auf `APP_URL` umgestellt. §237 hat am
 * laufenden System nachgemessen, was dort steht — und es war der von Railway
 * erzeugte Name. Jede Stelle, die `APP_URL` las, las ihn mit:
 *
 *     Kalender-Abo        die Adresse zum Abonnieren
 *     E-Mails             Registrierung, Passwort zurücksetzen
 *     Stellenmeldung      was Google als Adresse bekommt
 *     Push-Meldung        mittelbar: die Weiterleitung führte dorthin,
 *                         dort installierte die App, und die Meldung zeigt
 *                         die Adresse der Installation
 *
 * In `kanonische-domain.ts` steht dazu: Die Weiterleitung LEHNT diesen Wert
 * inzwischen ab, damit sie niemanden mehr auf den alten Namen schiebt. Das
 * machte die Einstellung unschädlich — richtig wurde sie dadurch nicht, und
 * die vier Stellen oben trugen weiter den falschen Namen.
 *
 * WARUM DIE ADRESSE JETZT IM CODE STEHT
 * Weil sonst eine Einstellung, an die niemand herankommt, bestimmt, was in
 * den E-Mails an echte Menschen steht. Eine Konfiguration gehört in die
 * Konfiguration — aber erst dann, wenn sie auch gesetzt werden kann. Bis
 * dahin ist eine Adresse im Code das kleinere Übel gegenüber kaputten
 * Links in jeder Einladung und jedem Passwort-Zurücksetzen.
 *
 * WAS DAS NICHT IST: EIN ERSATZ FÜR DIE EINSTELLUNG
 * `APP_URL` hat weiterhin Vorrang. Dieser Wert greift NUR, wenn dort nichts
 * steht oder der von Railway erzeugte Name — also genau im kaputten Zustand.
 * Steht dort eine eigene Adresse, gilt sie, und eine zweite Installation
 * (etwa eine Testumgebung) bleibt bei ihrer eigenen.
 *
 * Der Preis, offen gesagt: Eine Testumgebung, die `APP_URL` NICHT setzt,
 * verschickt Links auf den Betrieb. Das wäre vorher ein Link auf den
 * erzeugten Namen gewesen — also auch falsch, nur stiller. Die Middleware
 * schreibt beim Start eine Warnung ins Protokoll (§237), damit dieser Fall
 * nicht wieder unbemerkt bleibt.
 */

/** Die Adresse, unter der der Betrieb läuft. */
export const BETRIEBS_ADRESSE = 'https://okun-workforce.com'

/** Der von Railway erzeugte Name — nie die richtige Antwort. */
const ERZEUGT = /\.up\.railway\.app$/i

/**
 * Die Basisadresse für alles, was nach außen geht.
 *
 * `ersatz` ist die Adresse der laufenden Anfrage. Sie kommt nur in der
 * Entwicklung zum Zug: Im Betrieb spiegelt sie hinter dem Vermittler oft die
 * interne Bindeadresse wider und wäre als Link unbrauchbar.
 */
export function kanonischeBasis(ersatz?: string | null): string {
  const gesetzt = process.env.APP_URL?.replace(/\/+$/, '')

  if (gesetzt) {
    let host: string | null = null
    try {
      host = new URL(gesetzt).host.replace(/:\d+$/, '')
    } catch {
      // Eine kaputte Angabe wird behandelt wie keine.
      host = null
    }
    if (host && !ERZEUGT.test(host)) return gesetzt
  }

  // Ohne brauchbare Einstellung: im Betrieb die eigene Adresse, sonst das,
  // worüber die Anfrage gerade hereinkam.
  if (process.env.NODE_ENV === 'production') return BETRIEBS_ADRESSE
  return ersatz?.replace(/\/+$/, '') || 'http://localhost:3000'
}
