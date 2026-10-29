import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'
import { objektSchluessel } from '@/lib/file-storage'
import {
  uploadAdresse, objektHolen, objektWegraeumen, r2Eingerichtet,
} from '@/lib/r2'
import { vorfall } from '@/lib/fehlerkennung'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * §262 Die Dateien, die schon in der Datenbank liegen, in den Objektspeicher.
 *
 * WARUM DAS SEIN MUSS
 * §260 und §261 haben den WEG umgestellt: Neue Dateien gehen direkt in den
 * Speicher. Die alten liegen weiter als `Bytes`-Spalte in der Datenbank —
 * rund 54 MB in etwa 1350 Zeilen. Solange das so bleibt, hat jeder Abruf
 * davon dieselben Nachteile wie vorher: Die Datei läuft durch die Anwendung,
 * belegt eine Datenbankverbindung und zählt als ausgehender Verkehr.
 *
 * WARUM EIN KNOPF UND KEIN SKRIPT
 * Weil die Zugangsdaten zum Speicher im Betrieb liegen und dort bleiben
 * sollen. Ein Skript bräuchte sie auf einem anderen Rechner — und damit wären
 * sie an einem Ort mehr.
 *
 * WARUM IN HÄPPCHEN
 * Eine Anfrage, die 1350 Dateien bewegt, läuft in jede Zeitgrenze, die
 * Railway und Next setzen. Bricht sie in der Mitte ab, ist der Zustand
 * unklar. Also: eine feste Anzahl pro Aufruf, wiederholbar, und nach jedem
 * Aufruf steht da, wie viele noch übrig sind.
 *
 * DIE REGEL, VON DER HIER ALLES ABHÄNGT
 * Der Inhalt wird aus der Datenbank erst gelöscht, NACHDEM die Datei im
 * Speicher liegt UND vollständig zurückgelesen und Byte für Byte verglichen
 * wurde. Ein Umzug, der eine Lohnabrechnung von 2024 verliert, ist nicht
 * reparabel — es gibt keine zweite Kopie. Deshalb:
 *
 *   1. hochladen
 *   2. zurücklesen
 *   3. vergleichen
 *   4. erst dann in der Datenbank umstellen
 *
 * Scheitert irgendetwas davon, bleibt die Zeile unangetastet und das halb
 * abgelegte Objekt wird weggeräumt. Beim nächsten Aufruf ist die Datei wieder
 * dabei.
 *
 * WARUM VOLLSTÄNDIG VERGLICHEN WIRD UND NICHT NUR DIE GRÖSSE
 * Weil zwei Dateien gleicher Länge verschieden sein können, und weil bei R2
 * der eingehende wie der ausgehende Verkehr nichts kostet. Hier Zeit zu sparen
 * hieße, Gesundheitsdaten gegen ein paar Sekunden zu tauschen.
 */

interface Ergebnis {
  umgezogen: number
  uebrig: number
  bytesBewegt: number
  fehler: { id: string; dateiname: string; grund: string }[]
}

/** Wo eine Datei im Speicher landet — dieselbe Einteilung wie bei neuen. */
function bereichFuer(ownerType: string, ownerId: string): string {
  return ownerType === 'chat' ? `chat/${ownerId}` : `akte/${ownerType}/${ownerId}`
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  if (!r2Eingerichtet('dateien')) {
    return NextResponse.json({
      error: 'Der Objektspeicher ist nicht eingerichtet — es fehlen eine oder '
        + 'mehrere der Angaben R2_DATEIEN_BUCKET, R2_DATEIEN_SCHLUESSEL, '
        + 'R2_DATEIEN_GEHEIMNIS, R2_DATEIEN_BEREICH.',
    }, { status: 503 })
  }

  const { anzahl } = await req.json().catch(() => ({})) as { anzahl?: number }
  /*
   * Zwanzig je Aufruf. Bei rund 40 kB im Schnitt sind das wenige Sekunden —
   * weit unter jeder Zeitgrenze, und oft genug wiederholbar, dass 1350
   * Dateien in anderthalb Minuten Klicken durch sind.
   */
  const menge = Math.min(Math.max(Number(anzahl) || 20, 1), 50)

  /*
   * Und eine Grenze für das, was ein Aufruf INSGESAMT bewegt. Die Zahl oben
   * zählt Dateien, diese zählt Bytes — bei zwanzig Videos aus dem Chat wären
   * das sonst nacheinander 500 MB durch die Leitung und jedes Mal die Gefahr,
   * in eine Zeitgrenze zu laufen. Was nicht mehr hineinpasst, kommt beim
   * nächsten Klick.
   */
  const HOECHSTENS_JE_AUFRUF = 60 * 1024 * 1024

  const ergebnis: Ergebnis = { umgezogen: 0, uebrig: 0, bytesBewegt: 0, fehler: [] }

  /*
   * Die ÄLTESTEN zuerst. Nicht aus Ordnungsliebe: Wird der Umzug irgendwann
   * abgebrochen, sollen die Dateien liegen bleiben, die am ehesten noch
   * gebraucht werden — und das sind die neuen.
   */
  /*
   * OHNE den Inhalt. Das ist nicht Sparsamkeit, sondern notwendig: Im Chat
   * sind 25 MB je Datei erlaubt. Zwanzig davon auf einmal zu laden wären
   * 500 MB im Arbeitsspeicher — der Dienst wäre weg, und zwar mit „heap out
   * of memory", also genau der Meldung, die §252 als undurchschaubar
   * eingeordnet hat. Geholt wird der Inhalt unten, eine Datei nach der
   * anderen.
   */
  const anstehend = await prisma.storedFile.findMany({
    where: { treiber: 'db', inhalt: { not: null } },
    orderBy: { createdAt: 'asc' },
    take: menge,
    select: {
      id: true, ownerType: true, ownerId: true,
      dateiname: true, mimeType: true, groesse: true,
    },
  })

  for (const datei of anstehend) {
    // Die erste Datei kommt immer mit — sonst bliebe eine, die allein über
    // der Grenze liegt, für immer liegen.
    if (ergebnis.bytesBewegt > 0
        && ergebnis.bytesBewegt + datei.groesse > HOECHSTENS_JE_AUFRUF) break

    const zeile = await prisma.storedFile.findUnique({
      where: { id: datei.id }, select: { inhalt: true },
    })
    if (!zeile?.inhalt) continue
    const daten = Buffer.from(zeile.inhalt)
    const schluessel = objektSchluessel(
      bereichFuer(datei.ownerType, datei.ownerId), datei.dateiname,
    )

    const scheitern = (grund: string) => {
      ergebnis.fehler.push({ id: datei.id, dateiname: datei.dateiname, grund })
    }

    try {
      // ── 1. Hochladen ───────────────────────────────────────────────────
      const adresse = uploadAdresse(schluessel, datei.mimeType)
      if (!adresse) { scheitern('Keine Adresse zum Hochladen.'); continue }

      const put = await fetch(adresse, {
        method: 'PUT',
        headers: { 'content-type': datei.mimeType },
        body: new Uint8Array(daten),
      })
      if (!put.ok) {
        await put.body?.cancel().catch(() => undefined)
        scheitern(`Hochladen: HTTP ${put.status}`)
        continue
      }

      // ── 2./3. Zurücklesen und vergleichen ──────────────────────────────
      const zurueck = await objektHolen(schluessel)
      if (!zurueck) {
        await objektWegraeumen(schluessel)
        scheitern('Die Datei war nach dem Hochladen nicht lesbar.')
        continue
      }
      if (!zurueck.equals(daten)) {
        await objektWegraeumen(schluessel)
        scheitern(`Der Inhalt kam verändert zurück (${zurueck.length} statt ${daten.length} Bytes).`)
        continue
      }

      // ── 4. Erst jetzt umstellen ────────────────────────────────────────
      await prisma.storedFile.update({
        where: { id: datei.id },
        data: { treiber: 'r2', objektSchluessel: schluessel, inhalt: null },
      })

      ergebnis.umgezogen += 1
      ergebnis.bytesBewegt += daten.length
    } catch (fehler) {
      /*
       * Was auch schiefgeht: Die Zeile bleibt, wie sie war. Ein halb
       * abgelegtes Objekt wird weggeräumt — sonst bliebe es für immer liegen,
       * denn kein Eintrag wüsste davon.
       */
      await objektWegraeumen(schluessel).catch(() => undefined)
      const v = vorfall('speicher-umzug', fehler, 'Umzug gescheitert.')
      scheitern(v.text)
    }
  }

  ergebnis.uebrig = await prisma.storedFile.count({
    where: { treiber: 'db', inhalt: { not: null } },
  })

  return NextResponse.json(ergebnis)
}

/** Wie viel liegt noch in der Datenbank? Für die Anzeige, ohne etwas zu tun. */
export async function GET(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  const [inDerDatenbank, imSpeicher, summe] = await Promise.all([
    prisma.storedFile.count({ where: { treiber: 'db', inhalt: { not: null } } }),
    prisma.storedFile.count({ where: { treiber: 'r2' } }),
    prisma.storedFile.aggregate({
      where: { treiber: 'db', inhalt: { not: null } },
      _sum: { groesse: true },
    }),
  ])

  return NextResponse.json({
    eingerichtet: r2Eingerichtet('dateien'),
    inDerDatenbank,
    imSpeicher,
    bytesInDerDatenbank: summe._sum.groesse ?? 0,
  })
}
