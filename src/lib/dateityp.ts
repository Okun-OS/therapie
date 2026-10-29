/**
 * §241 Welche Art Datei das ist — wenn der Browser es nicht sagt.
 *
 * DIE MELDUNG
 * „Außerdem konnte man Bilder und Dokumente zwar auswählen, aber man konnte es
 * nicht hochladen, nicht versenden quasi. Hat nicht funktioniert, sowohl bei
 * Bildern als auch Dokumenten. … Und außerdem konnte man da auch keine
 * Bescheinigung hochladen, da hat der Upload nicht funktioniert."
 *
 * NACHGEMESSEN
 * Die Schnittstelle selbst war in Ordnung — Bild, PDF, HEIC und ein vier
 * Megabyte großes Foto gingen alle durch. Abgewiesen wurde genau ein Fall:
 *
 *     Datei ohne gemeldeten Typ  →  HTTP 400
 *     „Dateien dieser Art lassen sich hier nicht verschicken
 *      (application/octet-stream)."
 *
 * Und das ist am Telefon der Normalfall. Wer auf dem iPhone über „Dateien"
 * oder aus iCloud etwas auswählt, bekommt häufig ein `File` mit leerem `type`;
 * der Server machte daraus `application/octet-stream` und verglich das mit
 * einer Liste echter Typen. Eine ganz normale `Krankenschein.pdf` fiel damit
 * durch, und in der Oberfläche sah es aus, als passiere beim Senden nichts.
 *
 * WAS DIESE DATEI TUT
 * Sie bestimmt den Typ aus dem, was wirklich da ist: aus der Endung und aus
 * den ersten Bytes. Beides zusammen, nicht eines davon —
 *
 *   NUR ENDUNG wäre eine Einladung: `schadsoftware.exe` in `foto.jpg`
 *   umbenannt wäre dann ein Bild.
 *   NUR BYTES ginge nicht: Textdateien und Office-Dateien haben keine
 *   brauchbare Kennung am Anfang (eine .docx ist ein ZIP wie jedes andere).
 *
 * Deshalb: Die Endung schlägt den Typ vor, und wo es eine bekannte Kennung
 * gibt, MUSS sie dazu passen. Widersprechen sie sich, wird abgelehnt — das ist
 * strenger als vorher, nicht lockerer. Vorher wurde dem gemeldeten Typ blind
 * geglaubt, und eine Datei mit `type: 'application/pdf'` kam durch, was immer
 * darin stand.
 */

/** Endung → Typ. Nur Arten, die das Programm ohnehin annimmt. */
const AUS_ENDUNG: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic', heif: 'image/heic',
  webp: 'image/webp',
  gif: 'image/gif',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg', oga: 'audio/ogg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

/** Typen, die nichts aussagen — sie sind der Grund für diese ganze Datei. */
const NICHTSSAGEND = ['', 'application/octet-stream', 'binary/octet-stream',
  'application/x-binary', 'content/unknown']

/**
 * §246 Dieselbe Art, anders geschrieben.
 *
 * §241 hat den Fall behoben, dass der Browser GAR KEINEN Typ meldet. Gemeldet
 * kam trotzdem wieder: „Ich kann immer noch keine Bilder verschicken. Da steht
 * dann immer, die Datei konnte nicht gesendet werden."
 *
 * Nachgesehen: Ein iPhone meldet für dasselbe Foto je nach Herkunft
 * `image/heic`, `image/heif` oder `image/jpg`. In der Liste erlaubter Arten
 * steht nur `image/heic` und `image/jpeg` — die beiden anderen fielen durch,
 * und zwar MIT gemeldetem Typ. §241 griff da gar nicht, weil es den Typ ja
 * gab; er stand nur nicht in der Liste.
 *
 * Eine Liste, die jede Schreibweise jedes Herstellers kennen muss, veraltet
 * mit dem nächsten Gerät. Darum zwei Dinge: diese Tabelle für die bekannten
 * Fälle — und darunter die Regel, dass ein gemeldeter Typ, den wir nicht
 * kennen, gegen die Endung zurücktritt.
 */
const GLEICHBEDEUTEND: Record<string, string> = {
  'image/heif': 'image/heic',
  'image/heic-sequence': 'image/heic',
  'image/heif-sequence': 'image/heic',
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
  'application/x-pdf': 'application/pdf',
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/mp3': 'audio/mpeg',
  'audio/x-wav': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'video/mov': 'video/quicktime',
  'video/x-quicktime': 'video/quicktime',
  'text/csv': 'text/plain',
}

/**
 * Was wirklich am Anfang der Datei stehen muss.
 *
 * Nur Formate mit einer eindeutigen Kennung. Was hier fehlt, wird nicht
 * geprüft — lieber keine Prüfung als eine, die bei der Hälfte der gültigen
 * Dateien falsch anschlägt.
 */
const KENNUNG: Record<string, (b: Uint8Array) => boolean> = {
  'application/pdf': b => passt(b, [0x25, 0x50, 0x44, 0x46]),               // %PDF
  'image/png': b => passt(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/jpeg': b => passt(b, [0xff, 0xd8, 0xff]),
  'image/gif': b => passt(b, [0x47, 0x49, 0x46, 0x38]),                     // GIF8
  // RIFF….WEBP — die vier Bytes dazwischen sind die Länge.
  'image/webp': b => passt(b, [0x52, 0x49, 0x46, 0x46])
    && passt(b, [0x57, 0x45, 0x42, 0x50], 8),
  // ISO-BMFF: vier Bytes Länge, dann „ftyp". Gilt für HEIC, MP4 und MOV.
  'image/heic': b => passt(b, [0x66, 0x74, 0x79, 0x70], 4),
  'video/mp4': b => passt(b, [0x66, 0x74, 0x79, 0x70], 4),
  'video/quicktime': b => passt(b, [0x66, 0x74, 0x79, 0x70], 4),
}

function passt(bytes: Uint8Array, muster: number[], ab = 0): boolean {
  if (bytes.length < ab + muster.length) return false
  return muster.every((m, i) => bytes[ab + i] === m)
}

/** Die Endung eines Dateinamens, klein geschrieben, ohne Punkt. */
export function endung(name: string): string {
  const teile = name.trim().toLowerCase().split('.')
  return teile.length > 1 ? teile[teile.length - 1] : ''
}

export interface TypErgebnis {
  /** Der Typ, mit dem weitergearbeitet wird. */
  typ: string
  /** Woher er stammt — für die Fehlermeldung und fürs Protokoll. */
  quelle: 'gemeldet' | 'endung' | 'unbekannt'
  /** Gesetzt, wenn Endung und Inhalt sich widersprechen. */
  widerspruch?: string
}

/**
 * Den Typ einer hochgeladenen Datei bestimmen.
 *
 * `gemeldet` ist, was der Browser sagt — oft nichts. `daten` sind die ersten
 * Bytes; es genügen sechzehn, mehr liest diese Funktion nie an.
 */
export function dateityp(
  name: string,
  gemeldet: string | null | undefined,
  daten?: Uint8Array,
  /**
   * §246 Welche Arten die aufrufende Stelle überhaupt annimmt.
   *
   * Wird sie übergeben, tritt ein gemeldeter Typ, der NICHT darin steht,
   * gegen die Endung zurück. Das ist die Regel, die jede künftige
   * Schreibweise auffängt, ohne dass jemand eine Tabelle pflegen muss: Was
   * wir nicht kennen, glauben wir nicht — wir sehen auf den Namen und, wo es
   * geht, auf den Inhalt.
   *
   * Ohne sie verhält sich alles wie bisher.
   */
  erlaubt?: Iterable<string>,
): TypErgebnis {
  const roh = (gemeldet ?? '').trim().toLowerCase().split(';')[0]
  const sauber = GLEICHBEDEUTEND[roh] ?? roh
  const ausEndung = AUS_ENDUNG[endung(name)]

  let gemeldetBrauchbar = !NICHTSSAGEND.includes(sauber)
  if (gemeldetBrauchbar && erlaubt) {
    const liste = new Set(erlaubt)
    // Ein Typ, den diese Stelle gar nicht annimmt, hilft nicht weiter — aber
    // die Endung vielleicht schon. Nur wenn auch die nichts taugt, bleibt es
    // beim gemeldeten: Dann ist die Fehlermeldung wenigstens die richtige.
    if (!liste.has(sauber) && ausEndung && liste.has(ausEndung)) {
      gemeldetBrauchbar = false
    }
  }

  /*
   * §246 Wenn WEDER der gemeldete Typ brauchbar ist NOCH die Endung etwas
   * hergibt, ist nichts erkannt worden — auch dann nicht, wenn der gemeldete
   * Typ als Zeichenkette vorliegt. `application/octet-stream` ist keine
   * Erkenntnis, sondern ihr Gegenteil.
   *
   * Beim ersten Versuch stand hier als Quelle „endung", obwohl keine Endung
   * ausgewertet wurde. Der Typ stimmte, die Auskunft darüber nicht — und die
   * Auskunft ist das, was weiter unten über die Fehlermeldung entscheidet.
   */
  if (!gemeldetBrauchbar && !ausEndung) {
    return { typ: sauber || 'application/octet-stream', quelle: 'unbekannt' }
  }
  const typ = gemeldetBrauchbar ? sauber : ausEndung!
  if (!typ) return { typ: 'application/octet-stream', quelle: 'unbekannt' }

  /*
   * Die Gegenprobe am Inhalt. Sie läuft für BEIDE Wege — auch für einen
   * gemeldeten Typ. Dass der Browser „application/pdf" sagt, heißt nicht, dass
   * eine PDF drin ist; diese Zeile ist der Grund, warum der neue Weg strenger
   * ist als der alte und nicht lockerer.
   */
  const quelle: TypErgebnis['quelle'] = gemeldetBrauchbar ? 'gemeldet' : 'endung'

  const pruefer = daten && daten.length >= 12 ? KENNUNG[typ] : undefined
  if (pruefer && !pruefer(daten!)) {
    return {
      typ, quelle,
      widerspruch: `Die Datei heißt „${name}", ihr Inhalt passt aber nicht dazu.`,
    }
  }

  return { typ, quelle }
}
