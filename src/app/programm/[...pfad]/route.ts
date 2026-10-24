import { NextRequest, NextResponse } from 'next/server'
import { downloadAdresse, kleineDateiHolen, r2Eingerichtet } from '@/lib/r2'

export const dynamic = 'force-dynamic'

/**
 * §210 GET /programm/… — die Dateien des Desktop-Programms.
 *
 *   /programm/latest.yml                         der Zettel an der Tür
 *   /programm/OKUN-Workforce-0.2.0-win-x64.exe   das Programm selbst
 *
 * WARUM DIESE ADRESSE UND NICHT DIE DES SPEICHERS
 * Weil sie in jedes ausgelieferte Programm eingebacken wird. Ein Programm,
 * das heute installiert wird, schaut in zwei Jahren noch genau hier nach.
 * Die Adresse muss also eine sein, die OKUN auf Dauer behält — und nicht die
 * eines Speicheranbieters, den man vielleicht wechselt.
 *
 * Hinter dieser Route kann morgen Hetzner stehen statt Cloudflare, und kein
 * installiertes Programm merkt es.
 *
 * ZWEI WEGE, UND ZWAR AUS EINEM GRUND
 *   `latest.yml`  wird durchgereicht. Vier Zeilen Text, alle paar Stunden
 *                 abgefragt — eine Umleitung wäre hier zwei Anfragen statt
 *                 einer, für weniger Inhalt als der Umleitungskopf.
 *   alles andere  wird umgeleitet. Die `.exe` wiegt rund neunzig Megabyte;
 *                 liefe sie durch die Anlage, zahlte Railway jeden Download
 *                 als ausgehenden Verkehr.
 *
 * OHNE ANMELDUNG — ABSICHTLICH
 * Das Programm lädt seine Aktualisierung, bevor sich jemand angemeldet hat.
 * Es gibt hier auch nichts zu schützen: Die Hülle enthält keine Kundendaten,
 * keine Datenbank und keinen Schlüssel (§173). Was sie enthält, ist dasselbe,
 * was auf der Website zum Herunterladen stehen wird.
 */

/**
 * Welche Dateinamen hier überhaupt vorkommen dürfen.
 *
 * Eng gefasst, und zwar nicht aus Vorsicht, sondern weil der Pfad aus der
 * Anfrage direkt zum Schlüssel im Speicher wird. Ohne diese Zeile führte
 * `/programm/../../irgendwas` dorthin, wo niemand hinsoll.
 */
const ERLAUBT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const ERLAUBTE_ENDUNGEN = ['.yml', '.exe', '.blockmap', '.zip', '.dmg', '.AppImage', '.deb']

function pfadPruefen(teile: string[]): string | null {
  // Keine Verzeichnisse: Die Dateien liegen flach im Speicher. Ein Pfad mit
  // Schrägstrich wäre entweder ein Tippfehler oder ein Versuch.
  if (teile.length !== 1) return null
  const name = teile[0]
  if (!ERLAUBT.test(name)) return null
  if (!ERLAUBTE_ENDUNGEN.some(e => name.endsWith(e))) return null
  return name
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { pfad: string[] } },
) {
  /*
   * §210 Erst die Eingabe prüfen, dann die Einrichtung.
   *
   * Andersherum stand es hier zuerst — und damit war die Pfadprüfung nicht
   * nachweisbar: Solange keine Zugangsdaten gesetzt sind, antwortete auch
   * `..%2F..%2Fetc%2Fpasswd` mit 503 statt 404, und der Nachweis dafür war
   * grün, ohne etwas zu prüfen. Eine Eingabe, die nirgendwohin darf, wird
   * abgewiesen, bevor irgendetwas anderes geschieht.
   */
  const name = pfadPruefen(params.pfad ?? [])
  if (!name) {
    return NextResponse.json({ error: 'Unbekannte Datei' }, { status: 404 })
  }

  if (!r2Eingerichtet()) {
    // Ehrlich antworten statt 404. Ein 404 hieße „gibt es nicht"; hier ist
    // die Lage „noch nicht eingerichtet", und das ist etwas anderes — für
    // den, der es sucht, und für den, der es betreibt.
    return NextResponse.json(
      {
        error: 'Der Ausgabeort für das Programm ist noch nicht eingerichtet.',
        hinweis: 'Es fehlen die R2-Zugangsdaten in der Umgebung. Siehe DESKTOP.md.',
      },
      { status: 503 },
    )
  }

  if (name.endsWith('.yml')) {
    const ergebnis = await kleineDateiHolen(name)
    if (!ergebnis.ok) {
      return NextResponse.json(
        { error: 'Die Datei ist dort nicht zu finden.' },
        { status: ergebnis.status === 404 ? 404 : 502 },
      )
    }
    return new NextResponse(ergebnis.inhalt, {
      headers: {
        'Content-Type': 'text/yaml; charset=utf-8',
        // Kurz zwischenspeichern: Bei vielen Installationen fragt das
        // Programm alle paar Stunden nach, und die Antwort ändert sich nur,
        // wenn eine neue Fassung ausgeliefert wird.
        'Cache-Control': 'public, max-age=300',
      },
    })
  }

  const adresse = downloadAdresse(name)
  if (!adresse) {
    return NextResponse.json({ error: 'Nicht eingerichtet' }, { status: 503 })
  }

  // 302 und nicht 301: Die ausgestellte Adresse verfällt. Eine dauerhafte
  // Umleitung bliebe im Browser stehen und zeigte morgen auf etwas Totes.
  return NextResponse.redirect(adresse, 302)
}
