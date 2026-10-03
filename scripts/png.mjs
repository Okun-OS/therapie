/**
 * §180 Ein kleiner PNG-Leser und -Schreiber.
 *
 * WARUM SELBST GESCHRIEBEN
 * Auf dieser Maschine gibt es weder sharp noch ImageMagick, und eine
 * Bildbibliothek als Abhängigkeit aufzunehmen, um zweimal im Jahr vier Dateien
 * umzufärben, wäre ein schlechter Tausch: sie zieht Binärpakete nach, die bei
 * jedem `npm install` gebaut werden wollen.
 *
 * Bewusst eng: 8 Bit, RGBA, kein Interlacing — genau das, was die Logodateien
 * sind. Alles andere bricht mit einer klaren Meldung ab, statt still Unsinn zu
 * liefern.
 */

import { inflateSync, deflateSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'

const SIGNATUR = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

/** @returns {{ w: number, h: number, rgba: Buffer }} */
export function lesen(pfad) {
  const b = readFileSync(pfad)
  if (!b.subarray(0, 8).equals(SIGNATUR)) throw new Error(`${pfad}: kein PNG`)

  let p = 8, kopf = null
  const teile = []
  while (p < b.length) {
    const laenge = b.readUInt32BE(p)
    const typ = b.toString('ascii', p + 4, p + 8)
    const daten = b.subarray(p + 8, p + 8 + laenge)
    if (typ === 'IHDR') {
      kopf = {
        breite: daten.readUInt32BE(0), hoehe: daten.readUInt32BE(4),
        tiefe: daten[8], farbe: daten[9], interlace: daten[12],
      }
    } else if (typ === 'IDAT') teile.push(daten)
    else if (typ === 'IEND') break
    p += 12 + laenge
  }
  if (!kopf) throw new Error(`${pfad}: kein IHDR`)
  if (kopf.tiefe !== 8 || kopf.farbe !== 6 || kopf.interlace) {
    throw new Error(`${pfad}: erwartet wird RGBA, 8 bit, ohne Interlacing`)
  }

  const { breite: w, hoehe: h } = kopf
  const zeilenlaenge = w * 4
  const roh = inflateSync(Buffer.concat(teile))
  const rgba = Buffer.alloc(w * h * 4)
  let q = 0
  for (let y = 0; y < h; y++) {
    const filter = roh[q++]
    const ein = roh.subarray(q, q + zeilenlaenge); q += zeilenlaenge
    const ziel = rgba.subarray(y * zeilenlaenge, (y + 1) * zeilenlaenge)
    const oben = y ? rgba.subarray((y - 1) * zeilenlaenge, y * zeilenlaenge) : null
    for (let i = 0; i < zeilenlaenge; i++) {
      const links = i >= 4 ? ziel[i - 4] : 0
      const drueber = oben ? oben[i] : 0
      const schraeg = (oben && i >= 4) ? oben[i - 4] : 0
      let v = ein[i]
      if (filter === 1) v += links
      else if (filter === 2) v += drueber
      else if (filter === 3) v += (links + drueber) >> 1
      else if (filter === 4) {
        const s = links + drueber - schraeg
        const a = Math.abs(s - links), b2 = Math.abs(s - drueber), c = Math.abs(s - schraeg)
        v += (a <= b2 && a <= c) ? links : (b2 <= c ? drueber : schraeg)
      }
      ziel[i] = v & 255
    }
  }
  return { w, h, rgba }
}

let CRC_TABELLE = null
function crc(buf) {
  if (!CRC_TABELLE) {
    CRC_TABELLE = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      CRC_TABELLE[n] = c
    }
  }
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABELLE[(c ^ buf[i]) & 255] ^ (c >>> 8)
  return c ^ -1
}

function abschnitt(typ, daten) {
  const laenge = Buffer.alloc(4); laenge.writeUInt32BE(daten.length)
  const kennung = Buffer.from(typ, 'ascii')
  const pruef = Buffer.alloc(4); pruef.writeInt32BE(crc(Buffer.concat([kennung, daten])) | 0)
  return Buffer.concat([laenge, kennung, daten, pruef])
}

export function schreiben(pfad, { w, h, rgba }) {
  const zeilenlaenge = w * 4
  const roh = Buffer.alloc((zeilenlaenge + 1) * h)
  for (let y = 0; y < h; y++) {
    roh[y * (zeilenlaenge + 1)] = 0
    rgba.copy(roh, y * (zeilenlaenge + 1) + 1, y * zeilenlaenge, (y + 1) * zeilenlaenge)
  }
  const kopf = Buffer.alloc(13)
  kopf.writeUInt32BE(w, 0); kopf.writeUInt32BE(h, 4)
  kopf[8] = 8; kopf[9] = 6
  writeFileSync(pfad, Buffer.concat([
    SIGNATUR,
    abschnitt('IHDR', kopf),
    abschnitt('IDAT', deflateSync(roh, { level: 9 })),
    abschnitt('IEND', Buffer.alloc(0)),
  ]))
}

/**
 * Wo hört das Zeichen auf und wo fängt der Schriftzug an?
 *
 * Nicht geraten, sondern gemessen: die erste senkrechte Lücke, die breiter ist
 * als ein Buchstabenabstand. Steht das Logo eines Tages anders im Bild, findet
 * die Funktion die Grenze trotzdem — oder sie liefert -1, und der Aufrufer
 * bricht ab, statt in den Schild zu malen.
 *
 * @returns {number} die erste Spalte des Schriftzugs, oder -1
 */
export function schriftBeginn(bild, { sichtbar = 40, trennung = 24 } = {}) {
  const belegt = new Array(bild.w).fill(0)
  for (let y = 0; y < bild.h; y++) {
    for (let x = 0; x < bild.w; x++) {
      if (bild.rgba[(y * bild.w + x) * 4 + 3] > sichtbar) belegt[x]++
    }
  }
  let anfang = -1
  for (let x = 0; x < bild.w; x++) {
    if (belegt[x] === 0) { if (anfang < 0) anfang = x }
    else {
      if (anfang > 0 && x - anfang >= trennung) return x
      anfang = -1
    }
  }
  return -1
}
