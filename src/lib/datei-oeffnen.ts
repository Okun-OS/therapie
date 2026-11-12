/**
 * §263 Eine Datei öffnen, ohne die App zu verlassen.
 *
 * DAS PROBLEM
 * Ein Anhang war ein Verweis mit `target="_blank"`. Solange diese Adresse zu
 * uns selbst gehörte, blieb eine installierte App dabei im Vollbild. Seit
 * §260 antwortet die Adresse mit einer Umleitung in den Objektspeicher — und
 * eine FREMDE Adresse beantwortet iOS anders: Es öffnet einen Browser in der
 * App, mit Adresszeile oben. Ab da ist man nicht mehr in der App.
 *
 * Gemeldet wurde genau das: „man sieht jetzt in der App oben in der App" —
 * mit einem Bildschirmfoto, auf dem `…r2.cloudflarestorage.com` stand.
 *
 * DIE LÖSUNG
 * Die Datei wird geholt und als Datenpaket im Browser abgelegt. Daraus
 * entsteht eine Adresse, die dem eigenen Fenster gehört (`blob:`), und die
 * löst das Sichern aus. Es wird nie irgendwohin navigiert, und die Adresse
 * des Speichers taucht nirgends auf.
 *
 * WAS DAS KOSTET
 * Die Datei läuft durch den Arbeitsspeicher des Browsers, statt dass das
 * Betriebssystem sie selbst holt. Für Anhänge bis 25 MB ist das in Ordnung.
 * Bilder gehen diesen Weg ohnehin nicht — die zeigt `Bildschau` unmittelbar
 * an; das hier ist für PDF, Tabellen und Schriftstücke.
 */

export type OeffnenErgebnis = 'ok' | 'fehlgeschlagen'

export async function dateiSichern(adresse: string, name: string): Promise<OeffnenErgebnis> {
  try {
    /*
     * `same-origin` ist wichtig: Die Anfrage geht an uns, die Anmeldung muss
     * mit. Die Umleitung in den Speicher folgt danach ohne Keks — die
     * ausgestellte Adresse trägt die Berechtigung in sich.
     */
    const antwort = await fetch(adresse, { credentials: 'same-origin' })
    if (!antwort.ok) return 'fehlgeschlagen'

    const paket = await antwort.blob()
    const eigene = URL.createObjectURL(paket)

    const verweis = document.createElement('a')
    verweis.href = eigene
    verweis.download = name
    verweis.rel = 'noreferrer'
    document.body.appendChild(verweis)
    verweis.click()
    verweis.remove()

    /*
     * Nicht sofort freigeben: Das Sichern läuft nebenher weiter, und auf
     * manchen Telefonen bricht es ab, wenn die Adresse währenddessen
     * verschwindet. Eine Minute ist reichlich.
     */
    setTimeout(() => URL.revokeObjectURL(eigene), 60_000)
    return 'ok'
  } catch {
    return 'fehlgeschlagen'
  }
}
