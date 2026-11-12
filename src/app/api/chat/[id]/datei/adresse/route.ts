import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { raumZugriff } from '@/lib/chat'
import { uploadAdresse, r2Eingerichtet } from '@/lib/r2'
import { pruefeChatDatei, sichererDateiname, objektSchluessel, CHAT_TYPEN } from '@/lib/file-storage'
import { dateityp } from '@/lib/dateityp'
import { vorfall } from '@/lib/fehlerkennung'
import { nachweisAusstellen } from '@/lib/objekt-nachweis'

export const dynamic = 'force-dynamic'

/**
 * §260 „Wohin darf ich laden?"
 *
 * WAS SICH DAMIT ÄNDERT
 * Bis hierher ging jede Datei durch die Anwendung: Das Telefon lud zum Server,
 * der Server las sie vollständig in den Arbeitsspeicher und schrieb sie in die
 * Datenbank. Drei Stationen, an denen etwas schiefgehen kann — und drei Runden
 * Fehlersuche haben gezeigt, dass das keine graue Theorie ist.
 *
 * Diese Stelle gibt stattdessen nur eine Adresse heraus. Das Telefon lädt
 * direkt zum Speicher; die Anwendung sieht die Datei nie.
 *
 * WARUM DAS TROTZDEM NICHT OFFEN IST
 * Die Adresse gilt fünf Minuten, für genau einen Schlüssel und genau einen
 * Dateityp — alles drei steht in der Unterschrift. Wer sie weiterreicht, gibt
 * das Recht weiter, EINE Datei an EINEN Platz zu legen, und das für fünf
 * Minuten. Er bekommt damit keinen Zugriff auf irgendetwas anderes im
 * Speicher.
 *
 * WAS DIESE ADRESSE NICHT KANN
 * Eine Größe erzwingen. Die Zahl, die hier hereinkommt, ist eine Behauptung
 * des Browsers, und das Verfahren für ausgestellte Adressen kennt keine
 * Obergrenze für den Rumpf — die gibt es nur beim selten benutzten
 * Formular-Upload. Wer die Adresse hat, kann also mehr ablegen als die
 * 25 MB, die der Chat zulässt.
 *
 * Gefangen wird das beim Vermerken: Dort wird die WAHRE Größe aus dem
 * Speicher geholt, die Datei abgewiesen und das Objekt wieder weggeräumt. Es
 * bleibt also nichts liegen — es ist nur Verkehr, der umsonst war. Und es
 * setzt ein angemeldetes Mitglied dieses Gesprächs voraus.
 *
 * WARUM DER NAME GEPRÜFT WIRD, OBWOHL DIE DATEI NICHT DA IST
 * Weil die Prüfung hier das Einzige ist, was es noch gibt: Was der Typ
 * zulässt, entscheidet sich beim Ausstellen. Danach prüft nur noch Cloudflare,
 * und das prüft nur, ob der gemeldete Typ zur Unterschrift passt — nicht, ob
 * wir ihn erlauben wollten.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireRole(req)
    if (session instanceof NextResponse) return session

    const zugriff = await raumZugriff(session, params.id)
    if (zugriff.grund !== 'ok') {
      return NextResponse.json({ error: 'Gespräch nicht gefunden' }, { status: 404 })
    }
    const raum = zugriff.raum!

    if (raum.archiviertAm) {
      return NextResponse.json(
        { error: 'Diese Gruppe ist geschlossen. Der Verlauf bleibt lesbar.' }, { status: 409 },
      )
    }

    const { dateiname, mimeType, groesse } = await req.json().catch(() => ({})) as {
      dateiname?: string; mimeType?: string; groesse?: number
    }
    if (!dateiname) {
      return NextResponse.json({ error: 'Es fehlt der Dateiname.' }, { status: 400 })
    }

    const name = sichererDateiname(dateiname)
    // §246 Dieselbe Erkennung wie beim alten Weg — Endung schlägt eine
    // Schreibweise, die der Chat nicht annimmt. Ohne Inhalt, den gibt es hier
    // noch nicht.
    const erkannt = dateityp(name, mimeType, undefined, Object.keys(CHAT_TYPEN))
    const geprueft = pruefeChatDatei(name, erkannt.typ, groesse ?? 1)
    if (!geprueft.ok) {
      return NextResponse.json({ error: geprueft.fehler }, { status: 400 })
    }

    /*
     * §261 Diese Abfrage stand vorher WEITER OBEN, und das war falsch.
     *
     * Der eigene Nachweis hat es gefunden: Ohne eingerichteten Speicher kam
     * für `setup.exe` eine 200 zurück, weil die Typprüfung übersprungen
     * wurde. Gefährlich war es nicht — der alte Weg weist die Datei danach
     * ebenso ab —, aber die Antwort hing davon ab, ob ein Speicher
     * eingerichtet ist. Eine Prüfung, deren Ergebnis von der Einrichtung
     * abhängt, ist keine verlässliche Prüfung, und bei der Fehlersuche ist
     * das die Art Unterschied, die einen Nachmittag kostet.
     *
     * Jetzt entscheidet erst die Datei, dann der Speicher. Kein Objektspeicher
     * heißt: Der alte Weg über die Anwendung bleibt — eine Umstellung, die bei
     * fehlender Einrichtung alles anhält, wäre schlimmer als die alte Lösung.
     */
    if (!r2Eingerichtet('dateien')) return NextResponse.json({ speicher: 'aus' })

    const schluessel = objektSchluessel(`chat/${raum.id}`, name)
    const adresse = uploadAdresse(schluessel, erkannt.typ)
    if (!adresse) {
      return NextResponse.json({ speicher: 'aus' })
    }

    return NextResponse.json({
      speicher: 'an',
      adresse,
      schluessel,
      /**
       * §261 Die Unterschrift über diesen Platz. Beim Vermerken wird sie
       * geprüft — ohne sie ist ein genannter Schlüssel nur eine Behauptung.
       */
      nachweis: nachweisAusstellen(schluessel, `chat:${raum.id}`),
      /** Der Typ MUSS beim Hochladen genau so mitgeschickt werden. */
      typ: erkannt.typ,
      dateiname: name,
    })
  } catch (fehler) {
    const v = vorfall('chat/datei/adresse', fehler,
      'Der Platz für die Datei ließ sich nicht vorbereiten.')
    return NextResponse.json({ error: v.text }, { status: 500 })
  }
}
