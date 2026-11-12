import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import {
  ERLAUBTE_TYPEN, pruefeDatei, sichererDateiname, objektSchluessel,
} from '@/lib/file-storage'
import { akteAuftrag, akteBereich, akteZweck } from '@/lib/akte-auftrag'
import { uploadAdresse, r2Eingerichtet } from '@/lib/r2'
import { nachweisAusstellen } from '@/lib/objekt-nachweis'
import { dateityp } from '@/lib/dateityp'
import { vorfall } from '@/lib/fehlerkennung'

export const dynamic = 'force-dynamic'

/**
 * §261 „Wohin darf ich die Unterlage laden?" — das Gegenstück zu §260 für die
 * Personalakte.
 *
 * WARUM DAS HIER MEHR WIEGT ALS BEIM CHAT-ANHANG
 * Gemeldet war: „außerdem konnte man da auch keine Bescheinigung hochladen,
 * da hat der Upload nicht funktioniert." Eine Pflegekraft, die ihren
 * Krankenschein nicht einreichen kann, muss ihn auf Papier bringen oder über
 * WhatsApp schicken — und dort liegen Gesundheitsdaten dann wirklich falsch.
 *
 * Diese Stelle gibt nur eine Adresse heraus. Das Telefon lädt direkt zum
 * Speicher; die Anwendung sieht die Datei nie, hält keinen Arbeitsspeicher
 * dafür vor und belegt keine Datenbankverbindung.
 *
 * WAS DIE UNTERSCHRIFT ZUSÄTZLICH LEISTET
 * Der ausgegebene Platz ist an diese Akte UND diese Kategorie gebunden. Ein
 * Platz für eine Bescheinigung lässt sich nicht einlösen, um etwas als
 * Lohnabrechnung in eine andere Akte zu legen. Ohne das wäre der Ordner der
 * einzige Riegel — und innerhalb der eigenen Akte reicht der nicht.
 */
export async function POST(req: NextRequest) {
  try {
    const session = requireRole(req, ['employee', 'admin', 'company', 'okun'])
    if (session instanceof NextResponse) return session

    const eingang = await req.json().catch(() => ({})) as {
      ownerType?: string; ownerId?: string; kategorie?: string
      dateiname?: string; mimeType?: string; groesse?: number
    }

    /*
     * Die Zugriffsprüfung läuft VOR allem anderen und ist dieselbe wie beim
     * alten Weg — dieselbe Funktion, nicht dieselbe Abschrift. Zwei Eingänge,
     * die dieselbe Frage verschieden beantworten, wären bei Krankenscheinen
     * kein Schönheitsfehler.
     */
    const auftrag = await akteAuftrag(session, eingang)
    if (auftrag instanceof NextResponse) return auftrag

    if (!eingang.dateiname) {
      return NextResponse.json({ error: 'Es fehlt der Dateiname.' }, { status: 400 })
    }

    const name = sichererDateiname(eingang.dateiname)
    // §246 Endung schlägt eine Schreibweise, die die Akte nicht annimmt.
    // Ohne Inhalt — den gibt es hier noch nicht; er wird beim Vermerken
    // geprüft, und zwar am Speicher.
    const erkannt = dateityp(name, eingang.mimeType, undefined, Object.keys(ERLAUBTE_TYPEN))
    const pruefung = pruefeDatei(name, erkannt.typ, eingang.groesse ?? 1)
    if (!pruefung.ok) {
      return NextResponse.json({ error: pruefung.fehler }, { status: 400 })
    }

    /*
     * §261 Erst die Datei, dann der Speicher — und nicht umgekehrt.
     *
     * Der eigene Nachweis hat gezeigt, warum: Stand diese Abfrage vor der
     * Typprüfung, kam ohne eingerichteten Speicher für `setup.exe` eine 200
     * zurück. Gefährlich war das nicht, der alte Weg weist sie danach ebenso
     * ab — aber die Antwort hing von der Einrichtung ab, und das ist bei der
     * Fehlersuche die Art Unterschied, die einen Nachmittag kostet.
     *
     * Kein Objektspeicher heißt: Der alte Weg über die Anwendung bleibt.
     */
    if (!r2Eingerichtet('dateien')) return NextResponse.json({ speicher: 'aus' })

    const schluessel = objektSchluessel(akteBereich(auftrag), name)
    const adresse = uploadAdresse(schluessel, erkannt.typ)
    if (!adresse) return NextResponse.json({ speicher: 'aus' })

    return NextResponse.json({
      speicher: 'an',
      adresse,
      schluessel,
      nachweis: nachweisAusstellen(schluessel, akteZweck(auftrag)),
      /** Der Typ MUSS beim Hochladen genau so mitgeschickt werden. */
      typ: erkannt.typ,
      dateiname: name,
    })
  } catch (fehler) {
    const v = vorfall('files/adresse', fehler,
      'Der Platz für die Datei ließ sich nicht vorbereiten.')
    return NextResponse.json({ error: v.text }, { status: 500 })
  }
}
