#!/usr/bin/env node
/**
 * §205 Die beiden Bilder für den Windows-Installationsassistenten.
 *
 *     node scripts/installer-bilder.mjs
 *
 * WARUM DAS EIN SKRIPT IST UND KEINE ZWEI DATEIEN IM VERZEICHNIS
 * Weil sie sonst auseinanderlaufen. Ändert sich das Logo oder die Hausfarbe,
 * soll ein Befehl genügen — nicht das Suchen nach einem Bildprogramm, das
 * BMP schreiben kann. Die Dateien werden trotzdem eingecheckt: Der Bau soll
 * nicht von einem Skript abhängen, das jemand zu laufen vergisst.
 *
 * WARUM BMP
 * NSIS kann nichts anderes. Kein PNG, kein JPEG — unkomprimiertes BMP, und
 * zwar in genau zwei Größen, die der Assistent fest vorgibt:
 *
 *   164 × 314   die Seitenfläche links auf der Willkommens- und Schlussseite
 *   150 ×  57   der Streifen oben auf allen Seiten dazwischen
 *
 * Wer andere Maße liefert, bekommt kein skaliertes Bild, sondern einen
 * abgeschnittenen Rand.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lesen, skalieren } from './png.mjs'

const HIER = dirname(fileURLToPath(import.meta.url))
const WURZEL = join(HIER, '..')
const SYMBOLE = join(WURZEL, 'desktop', 'symbole')

/** Hausfarben — dieselben wie in `tailwind.config.ts`. */
const NAVY = [0x0F, 0x11, 0x12]
const BRAND = [0x26, 0xC6, 0xC6]

/**
 * Ein 24-Bit-BMP schreiben.
 *
 * Bewusst die alte, einfache Form (BITMAPINFOHEADER, keine Kompression):
 * Sie ist das Einzige, was NSIS sicher versteht. Zwei Eigenheiten, an denen
 * man sich sonst die Zähne ausbeißt — die Zeilen stehen von UNTEN nach oben,
 * und jede Zeile wird auf vier Byte aufgefüllt.
 */
function bmpSchreiben(pfad, { w, h, rgb }) {
  const zeilenbreite = (w * 3 + 3) & ~3
  const bilddaten = zeilenbreite * h
  const kopf = Buffer.alloc(54)

  kopf.write('BM', 0)
  kopf.writeUInt32LE(54 + bilddaten, 2)
  kopf.writeUInt32LE(54, 10)        // wo die Bilddaten beginnen
  kopf.writeUInt32LE(40, 14)        // Größe dieses Kopfes
  kopf.writeInt32LE(w, 18)
  kopf.writeInt32LE(h, 22)
  kopf.writeUInt16LE(1, 26)         // eine Ebene
  kopf.writeUInt16LE(24, 28)        // 24 Bit je Punkt
  kopf.writeUInt32LE(0, 30)         // keine Kompression
  kopf.writeUInt32LE(bilddaten, 34)

  const daten = Buffer.alloc(bilddaten)
  for (let y = 0; y < h; y++) {
    const ziel = (h - 1 - y) * zeilenbreite // von unten nach oben
    for (let x = 0; x < w; x++) {
      const q = (y * w + x) * 3
      // BMP speichert Blau, Grün, Rot — in dieser Reihenfolge.
      daten[ziel + x * 3] = rgb[q + 2]
      daten[ziel + x * 3 + 1] = rgb[q + 1]
      daten[ziel + x * 3 + 2] = rgb[q]
    }
  }

  mkdirSync(dirname(pfad), { recursive: true })
  writeFileSync(pfad, Buffer.concat([kopf, daten]))
  return 54 + bilddaten
}

/** Eine einfarbige Fläche. */
function flaeche(w, h, farbe) {
  const rgb = Buffer.alloc(w * h * 3)
  for (let i = 0; i < w * h; i++) {
    rgb[i * 3] = farbe[0]; rgb[i * 3 + 1] = farbe[1]; rgb[i * 3 + 2] = farbe[2]
  }
  return { w, h, rgb }
}

/**
 * Ein RGBA-Bild über eine Fläche legen.
 *
 * Mit echtem Alpha-Mischen, nicht mit „durchsichtig = überspringen": Das Logo
 * hat weiche Kanten, und ohne Mischung bekäme es einen harten, hellen Rand
 * auf dunklem Grund — genau das, was billig aussieht.
 */
function legen(grund, bild, x0roh, y0roh) {
  /*
   * §205 Ganze Zahlen, und zwar erzwungen.
   *
   * Beim ersten Versuch stand als senkrechte Mitte `(57 - 42) / 2` da, also
   * 7,5. Ein halber Zeilenversatz wird beim Rechnen zu `7,5 × 150 = 1125`
   * — einer ganzen Zahl, nur eben der falschen: Das Zeichen landete 75
   * Punkte weiter links, also statt rechts fast in der Mitte. Der Fehler
   * blieb stumm, weil nichts abstürzt; aufgefallen ist er erst beim
   * Nachmessen des fertigen Bildes.
   */
  const x0 = Math.round(x0roh)
  const y0 = Math.round(y0roh)
  for (let y = 0; y < bild.h; y++) {
    const zy = y0 + y
    if (zy < 0 || zy >= grund.h) continue
    for (let x = 0; x < bild.w; x++) {
      const zx = x0 + x
      if (zx < 0 || zx >= grund.w) continue
      const q = (y * bild.w + x) * 4
      const a = bild.rgba[q + 3] / 255
      if (a === 0) continue
      const z = (zy * grund.w + zx) * 3
      for (let k = 0; k < 3; k++) {
        grund.rgb[z + k] = Math.round(bild.rgba[q + k] * a + grund.rgb[z + k] * (1 - a))
      }
    }
  }
  return grund
}

/** Ein waagerechter Streifen in der Markenfarbe — die einzige Zierde. */
function streifen(grund, y, hoehe) {
  for (let yy = y; yy < y + hoehe && yy < grund.h; yy++) {
    for (let x = 0; x < grund.w; x++) {
      const z = (yy * grund.w + x) * 3
      grund.rgb[z] = BRAND[0]; grund.rgb[z + 1] = BRAND[1]; grund.rgb[z + 2] = BRAND[2]
    }
  }
  return grund
}

const logo = lesen(join(SYMBOLE, 'icon.png'))

// ── Die Seitenfläche ───────────────────────────────────────────────────────
// Das Zeichen sitzt im oberen Drittel, nicht in der Mitte: Unten steht im
// Assistenten der Text, und ein mittig gesetztes Logo läge dahinter.
const seite = flaeche(164, 314, NAVY)
legen(seite, skalieren(logo, 104, 104), (164 - 104) / 2, 58)
streifen(seite, 258, 3)
const a = bmpSchreiben(join(SYMBOLE, 'installer-seite.bmp'), seite)

// ── Der Kopfstreifen ───────────────────────────────────────────────────────
// Hier ist links Platz für die Überschrift des Assistenten, also sitzt das
// Zeichen rechts.
const kopf = flaeche(150, 57, NAVY)
legen(kopf, skalieren(logo, 42, 42), 150 - 42 - 8, (57 - 42) / 2)
const b = bmpSchreiben(join(SYMBOLE, 'installer-kopf.bmp'), kopf)

console.log(`installer-seite.bmp  164×314  ${a} Bytes`)
console.log(`installer-kopf.bmp   150×57   ${b} Bytes`)
