import { describe, it, expect } from 'vitest'
import { dateityp, endung } from '../dateityp'

/**
 * §241 Welche Art Datei das ist.
 *
 * Gemeldet: „Man konnte Bilder und Dokumente zwar auswählen, aber man konnte
 * es nicht hochladen." Nachgemessen lag es an genau einem Fall — eine Datei
 * ohne gemeldeten Typ, am Telefon der Normalfall.
 */

/** Ein Kopf, wie ihn die jeweilige Art wirklich hat. */
const KOPF = {
  pdf: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0, 0, 0, 0]),
  png: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
  jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]),
  // ISO-BMFF: vier Bytes Länge, dann „ftyp" — so sieht eine iPhone-Aufnahme aus.
  heic: new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]),
  // Eine .docx ist ein ZIP. Absichtlich OHNE eigene Kennung in der Tabelle.
  zip: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]),
}

describe('endung', () => {
  it('liest die Endung klein', () => {
    expect(endung('IMG_0042.HEIC')).toBe('heic')
    expect(endung('Krankenschein.pdf')).toBe('pdf')
  })
  it('ohne Punkt gibt es keine', () => {
    expect(endung('Anhang')).toBe('')
  })
  it('und der letzte Punkt zählt', () => {
    expect(endung('Bericht.2026.final.pdf')).toBe('pdf')
  })
})

describe('dateityp', () => {
  /*
   * DER GEMELDETE FALL. Ohne diese Zeile gäbe es §241 nicht.
   */
  it('erkennt eine PDF, für die der Browser keinen Typ meldet', () => {
    expect(dateityp('Krankenschein.pdf', '', KOPF.pdf))
      .toEqual({ typ: 'application/pdf', quelle: 'endung' })
    expect(dateityp('Krankenschein.pdf', 'application/octet-stream', KOPF.pdf).typ)
      .toBe('application/pdf')
    expect(dateityp('Krankenschein.pdf', null, KOPF.pdf).typ).toBe('application/pdf')
  })

  it('und ein HEIC-Bild vom iPhone', () => {
    expect(dateityp('IMG_0042.HEIC', 'application/octet-stream', KOPF.heic).typ)
      .toBe('image/heic')
  })

  it('ein gemeldeter Typ hat Vorrang vor der Endung', () => {
    // Die Endung ist nur der Ersatz. Wer etwas sagt, wird gehört.
    expect(dateityp('ohne-endung', 'application/pdf', KOPF.pdf))
      .toEqual({ typ: 'application/pdf', quelle: 'gemeldet' })
  })

  /*
   * Die Gegenprobe, die den neuen Weg STRENGER macht als den alten: Vorher
   * wurde dem gemeldeten Typ blind geglaubt. Eine umbenannte Datei kam durch.
   */
  it('weist ab, wenn Name und Inhalt sich widersprechen', () => {
    const r = dateityp('harmlos.png', 'image/png', KOPF.pdf)
    expect(r.widerspruch).toBeTruthy()
    expect(r.widerspruch).toContain('harmlos.png')
  })

  it('auch wenn der Typ nur aus der Endung kam', () => {
    expect(dateityp('foto.jpg', '', KOPF.pdf).widerspruch).toBeTruthy()
  })

  /*
   * Und die Gegenprobe dazu, ohne die „weist ab" zu viel abwiese: Die
   * passenden Fälle müssen durchgehen.
   */
  it('aber nicht, wenn sie zusammenpassen', () => {
    expect(dateityp('foto.png', 'image/png', KOPF.png).widerspruch).toBeUndefined()
    expect(dateityp('foto.jpg', '', KOPF.jpeg).widerspruch).toBeUndefined()
    expect(dateityp('bericht.pdf', '', KOPF.pdf).widerspruch).toBeUndefined()
  })

  /*
   * Was keine eigene Kennung hat, wird nicht am Inhalt geprüft. Eine .docx ist
   * ein ZIP wie jedes andere — hier zu prüfen hieße, gültige Dateien
   * abzuweisen.
   */
  it('prüft nur, wo es eine eindeutige Kennung gibt', () => {
    const r = dateityp('Vertrag.docx', '', KOPF.zip)
    expect(r.typ).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(r.widerspruch).toBeUndefined()
  })

  it('und nicht, wenn gar keine Bytes vorliegen', () => {
    expect(dateityp('bericht.pdf', '').widerspruch).toBeUndefined()
    expect(dateityp('bericht.pdf', '', new Uint8Array([0x25])).widerspruch).toBeUndefined()
  })

  /*
   * Eine unbekannte Endung bleibt unbekannt. Hier zu raten hieße, die Liste
   * erlaubter Arten zu unterlaufen — und genau die ist der Schutz.
   */
  it('eine unbekannte Art bleibt unbekannt', () => {
    expect(dateityp('schadsoftware.exe', 'application/octet-stream'))
      .toEqual({ typ: 'application/octet-stream', quelle: 'unbekannt' })
    expect(dateityp('ohne-endung', '')).toEqual({
      typ: 'application/octet-stream', quelle: 'unbekannt',
    })
  })

  /*
   * §246 DER ZWEITE GEMELDETE FALL.
   *
   * §241 hat den Fall ohne gemeldeten Typ behoben. Gemeldet kam trotzdem
   * wieder: „Ich kann immer noch keine Bilder verschicken." Ein iPhone meldet
   * für dasselbe Foto je nach Herkunft `image/heic`, `image/heif` oder
   * `image/jpg` — und die beiden letzten standen in keiner Liste.
   */
  it('erkennt die Schreibweisen desselben Formats', () => {
    expect(dateityp('IMG.HEIC', 'image/heif', KOPF.heic).typ).toBe('image/heic')
    expect(dateityp('IMG.HEIC', 'image/HEIF', KOPF.heic).typ).toBe('image/heic')
    expect(dateityp('IMG.JPG', 'image/jpg', KOPF.jpeg).typ).toBe('image/jpeg')
    expect(dateityp('IMG.JPG', 'image/pjpeg', KOPF.jpeg).typ).toBe('image/jpeg')
    expect(dateityp('ton.m4a', 'audio/x-m4a').typ).toBe('audio/mp4')
  })

  /*
   * Die Regel, die jede künftige Schreibweise auffängt, ohne dass jemand eine
   * Tabelle pflegen muss: Ein gemeldeter Typ, den diese Stelle gar nicht
   * annimmt, tritt gegen die Endung zurück.
   */
  it('ein nicht angenommener Typ tritt gegen die Endung zurück', () => {
    const erlaubt = ['application/pdf', 'image/jpeg', 'image/png']
    expect(dateityp('Schein.pdf', 'application/x-irgendwas', KOPF.pdf, erlaubt))
      .toMatchObject({ typ: 'application/pdf', quelle: 'endung' })
  })

  it('aber ein angenommener Typ behält den Vorrang', () => {
    // Die Gegenprobe: Sonst würde die Endung immer gewinnen, und ein
    // absichtlich gesetzter Typ wäre wertlos.
    const erlaubt = ['application/pdf', 'image/jpeg']
    expect(dateityp('ohne-endung', 'application/pdf', KOPF.pdf, erlaubt))
      .toMatchObject({ typ: 'application/pdf', quelle: 'gemeldet' })
  })

  it('und taugt auch die Endung nichts, bleibt es beim gemeldeten Typ', () => {
    // Damit die Fehlermeldung die richtige nennt und nicht eine erfundene.
    const erlaubt = ['application/pdf']
    expect(dateityp('datei.xyz', 'video/mp4', undefined, erlaubt))
      .toMatchObject({ typ: 'video/mp4' })
  })

  it('Groß- und Kleinschreibung und Zusätze stören nicht', () => {
    expect(dateityp('BILD.JPG', 'IMAGE/JPEG; charset=binary', KOPF.jpeg).typ)
      .toBe('image/jpeg')
  })
})
