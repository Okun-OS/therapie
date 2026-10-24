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
  /*
   * §186 Auch RGB und Graustufen lesen, nicht nur RGBA.
   *
   * Die Logovorlagen kommen so, wie der Gestalter sie exportiert: mal mit
   * Transparenz, mal ohne. Ein Leser, der nur RGBA kann, bricht dann mit einer
   * Meldung ab, die nach einem kaputten Bild klingt — dabei ist es ein völlig
   * normales PNG.
   */
  const kanaele = { 0: 1, 2: 3, 4: 2, 6: 4 }[kopf.farbe]
  if (kopf.tiefe !== 8 || !kanaele || kopf.interlace) {
    throw new Error(
      `${pfad}: erwartet werden 8 bit ohne Interlacing (Graustufen, RGB oder RGBA) — `
      + `vorgefunden: Tiefe ${kopf.tiefe}, Farbtyp ${kopf.farbe}`,
    )
  }

  const { breite: w, hoehe: h } = kopf
  const zeilenlaenge = w * kanaele
  const roh = inflateSync(Buffer.concat(teile))
  const roheBilddaten = Buffer.alloc(w * h * kanaele)
  let q = 0
  for (let y = 0; y < h; y++) {
    const filter = roh[q++]
    const ein = roh.subarray(q, q + zeilenlaenge); q += zeilenlaenge
    const ziel = roheBilddaten.subarray(y * zeilenlaenge, (y + 1) * zeilenlaenge)
    const oben = y ? roheBilddaten.subarray((y - 1) * zeilenlaenge, y * zeilenlaenge) : null
    for (let i = 0; i < zeilenlaenge; i++) {
      const links = i >= kanaele ? ziel[i - kanaele] : 0
      const drueber = oben ? oben[i] : 0
      const schraeg = (oben && i >= kanaele) ? oben[i - kanaele] : 0
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

  // Alles auf RGBA bringen — der Rest des Programms kennt nur das.
  const rgba = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    let r, g, b, a = 255
    if (kanaele === 4) { [r, g, b, a] = roheBilddaten.subarray(i * 4, i * 4 + 4) }
    else if (kanaele === 3) { [r, g, b] = roheBilddaten.subarray(i * 3, i * 3 + 3) }
    else if (kanaele === 2) { r = g = b = roheBilddaten[i * 2]; a = roheBilddaten[i * 2 + 1] }
    else { r = g = b = roheBilddaten[i] }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a
  }
  return { w, h, rgba }
}

/** Einen rechteckigen Ausschnitt herauslösen. */
export function schneiden(bild, x0, y0, w, h) {
  const aus = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    bild.rgba.copy(aus, y * w * 4,
      ((y0 + y) * bild.w + x0) * 4, ((y0 + y) * bild.w + x0 + w) * 4)
  }
  return { w, h, rgba: aus }
}

/**
 * Ein Bild auf eine neue Größe bringen — mit Flächenmittelung.
 *
 * Beim Verkleinern wird über alle Quellpunkte gemittelt, die auf einen
 * Zielpunkt fallen. Wer stattdessen den nächstgelegenen Punkt nimmt, bekommt
 * ausgefranste Buchstabenkanten, und genau daran erkennt man ein Logo, das
 * durch die falsche Maschine gelaufen ist.
 */
export function skalieren(bild, zw, zh) {
  const aus = Buffer.alloc(zw * zh * 4)
  for (let y = 0; y < zh; y++) {
    const sy0 = Math.floor(y * bild.h / zh)
    const sy1 = Math.max(sy0 + 1, Math.ceil((y + 1) * bild.h / zh))
    for (let x = 0; x < zw; x++) {
      const sx0 = Math.floor(x * bild.w / zw)
      const sx1 = Math.max(sx0 + 1, Math.ceil((x + 1) * bild.w / zw))
      let r = 0, g = 0, b = 0, a = 0, n = 0
      for (let sy = sy0; sy < Math.min(sy1, bild.h); sy++) {
        for (let sx = sx0; sx < Math.min(sx1, bild.w); sx++) {
          const i = (sy * bild.w + sx) * 4
          const al = bild.rgba[i + 3] / 255
          // Mit der Deckung gewichtet, sonst zieht ein durchsichtiger
          // Bildpunkt die Farbe seines Nachbarn zu sich.
          r += bild.rgba[i] * al; g += bild.rgba[i + 1] * al; b += bild.rgba[i + 2] * al
          a += bild.rgba[i + 3]
          n++
        }
      }
      if (!n) continue
      const deckung = a / n
      const gewicht = deckung / 255 * n
      const j = (y * zw + x) * 4
      aus[j] = gewicht > 0 ? Math.round(r / gewicht) : 0
      aus[j + 1] = gewicht > 0 ? Math.round(g / gewicht) : 0
      aus[j + 2] = gewicht > 0 ? Math.round(b / gewicht) : 0
      aus[j + 3] = Math.round(deckung)
    }
  }
  return { w: zw, h: zh, rgba: aus }
}

/** Die Grenzen dessen, was im Bild überhaupt sichtbar ist. */
export function tintenkasten(bild, schwelle = 40) {
  let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1
  for (let y = 0; y < bild.h; y++) {
    for (let x = 0; x < bild.w; x++) {
      if (bild.rgba[(y * bild.w + x) * 4 + 3] > schwelle) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 }
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
