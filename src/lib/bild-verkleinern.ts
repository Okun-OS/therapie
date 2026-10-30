/**
 * §249 Ein Foto verkleinern, bevor es losgeschickt wird.
 *
 * DIE MELDUNG, ZUM DRITTEN MAL
 * „Die Bilder funktionieren immer noch nicht." Davor: „Da steht dann immer,
 * die Datei konnte nicht gesendet werden."
 *
 * WAS ICH NACHGEMESSEN HABE
 * §241 und §246 haben zwei echte Fehler behoben — fehlender Typ und fremde
 * Schreibweisen. Beide sind nachweisbar weg: Durch die ECHTE Oberfläche, im
 * Browser, mit Anmeldung, geht ein JPEG wie ein PNG mit HTTP 200 durch, ohne
 * Fehlermeldung. Auch fünf Megabyte gehen örtlich in anderthalb Sekunden
 * durch.
 *
 * WAS DARAUS FOLGT
 * Der Fehler sitzt nicht mehr in der Prüfung, sondern irgendwo zwischen
 * Telefon und Anwendung. Die Meldung, die dabei erscheint, ist die
 * ALLGEMEINE: Sie steht nur da, wenn die Antwort überhaupt kein JSON enthält
 * — also wenn nicht die Anwendung abgelehnt hat, sondern etwas davor. Eine
 * Größengrenze der Vermittlungsschicht und ein Zeitablauf auf einer mobilen
 * Verbindung sehen beide genau so aus.
 *
 * Welches von beidem es ist, kann ich von hier aus nicht feststellen. Ich muss
 * es auch nicht: Ein Foto im Chat braucht keine 4000 × 3000 Bildpunkte. Wer
 * zwölf Megabyte durch ein Funkloch schickt, hat ein Problem, das sich nicht
 * durch eine bessere Fehlermeldung löst.
 *
 * DREI DINGE AUF EINMAL
 *   1. Aus fünf Megabyte werden ein paar hundert Kilobyte. Unter jeder
 *      Größengrenze und schnell genug für eine mobile Verbindung.
 *   2. Aus HEIC wird JPEG. Safari kann HEIC anzeigen, also auch zeichnen —
 *      und was die Leinwand ausgibt, ist immer JPEG. Damit ist die ganze
 *      Frage nach Schreibweisen für Fotos erledigt.
 *   3. Das Bild wird gedreht, wie es aufgenommen wurde. `createImageBitmap`
 *      wertet die Lageangabe der Kamera aus; ohne das liegen Hochformatfotos
 *      beim Empfänger auf der Seite.
 *
 * WAS ES NICHT TUT
 * Es rührt nichts an, was kein Bild ist. Eine PDF bleibt eine PDF. Und wenn
 * irgendetwas daran scheitert — altes Telefon, fremdes Format, zu wenig
 * Speicher —, geht die Datei UNVERÄNDERT hinaus. Eine Verbesserung, die beim
 * Scheitern das Senden verhindert, wäre schlimmer als das Problem.
 */

/** Längste Kante nach dem Verkleinern. Reicht für jeden Bildschirm. */
const MAX_KANTE = 2000

/** Güte der JPEG-Ausgabe. 0,85 ist die Grenze, ab der man nichts mehr sieht. */
const GUETE = 0.85

/** Darunter lohnt das Verkleinern nicht — und kostet nur Zeit. */
const AB_BYTES = 600 * 1024

function istBild(datei: File): boolean {
  const typ = (datei.type || '').toLowerCase()
  if (typ.startsWith('image/')) return true
  // Ohne gemeldeten Typ (am Telefon der Normalfall) entscheidet die Endung.
  return /\.(jpe?g|png|heic|heif|webp)$/i.test(datei.name)
}

/** Das Bild laden — bevorzugt so, dass die Kameralage beachtet wird. */
async function alsBild(datei: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // `from-image` dreht nach der Lageangabe der Kamera.
      return await createImageBitmap(datei, { imageOrientation: 'from-image' })
    } catch {
      // Ältere Browser kennen die Angabe nicht — dann ohne.
      try { return await createImageBitmap(datei) } catch { /* weiter unten */ }
    }
  }
  return await new Promise((fertig, scheitert) => {
    const adresse = URL.createObjectURL(datei)
    const bild = new Image()
    bild.onload = () => { URL.revokeObjectURL(adresse); fertig(bild) }
    bild.onerror = () => { URL.revokeObjectURL(adresse); scheitert(new Error('nicht lesbar')) }
    bild.src = adresse
  })
}

/**
 * Ein Bild verkleinern — oder die Datei unverändert zurückgeben.
 *
 * Gibt IMMER eine brauchbare Datei zurück. Scheitert etwas, ist es die
 * ursprüngliche.
 */
export async function bildVerkleinern(datei: File): Promise<File> {
  if (!istBild(datei)) return datei
  if (typeof document === 'undefined') return datei

  try {
    const bild = await alsBild(datei)
    const breite = 'width' in bild ? bild.width : 0
    const hoehe = 'height' in bild ? bild.height : 0
    if (!breite || !hoehe) return datei

    const faktor = Math.min(1, MAX_KANTE / Math.max(breite, hoehe))
    /*
     * Ein kleines Bild in einem bekannten Format bleibt, wie es ist: Noch
     * einmal durch die Leinwand zu schicken, würde es nur verschlechtern.
     * HEIC wird trotzdem umgewandelt — sonst bliebe genau das Format übrig,
     * mit dem es die meisten Schwierigkeiten gibt.
     */
    const heic = /heic|heif/i.test(datei.type) || /\.(heic|heif)$/i.test(datei.name)
    if (faktor === 1 && datei.size < AB_BYTES && !heic) return datei

    const flaeche = document.createElement('canvas')
    flaeche.width = Math.round(breite * faktor)
    flaeche.height = Math.round(hoehe * faktor)
    const stift = flaeche.getContext('2d')
    if (!stift) return datei
    stift.drawImage(bild as CanvasImageSource, 0, 0, flaeche.width, flaeche.height)

    const brocken: Blob | null = await new Promise(fertig =>
      flaeche.toBlob(b => fertig(b), 'image/jpeg', GUETE))
    if (!brocken) return datei

    // Nur nehmen, wenn es wirklich kleiner wurde — außer bei HEIC, wo schon
    // das Format selbst der Gewinn ist.
    if (!heic && brocken.size >= datei.size) return datei

    const name = datei.name.replace(/\.(heic|heif|png|webp)$/i, '.jpg')
    return new File([brocken], /\.jpe?g$/i.test(name) ? name : `${name}.jpg`, {
      type: 'image/jpeg',
      lastModified: datei.lastModified,
    })
  } catch {
    // Altes Telefon, fremdes Format, zu wenig Speicher: dann eben das Original.
    return datei
  }
}
