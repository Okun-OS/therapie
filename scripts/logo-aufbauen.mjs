/**
 * §186 Die Logodateien aus der Vorlage des Gestalters aufbauen.
 *
 * WARUM ES DIESES SKRIPT GIBT
 * In den Marken-Dateien steckte bis zum 05.10.2026 ein ANDERER Schriftzug als
 * der, den der Betrieb benutzt. Nicht eine andere Schriftgröße, nicht eine
 * andere Sperrung — ein anderer Schriftzug: rundere, deutlich schwerere
 * Buchstaben, das O mit abgeschnittener Ecke, ein türkiser Punkt darüber.
 *
 * Aufgefallen ist es erst, als der Eigentümer dieselbe Datei zum dritten Mal
 * geschickt hat. Zweimal hatte ich gegen das Logo gearbeitet, das schon im
 * Programm lag, statt gegen das, das er mir gab. Deshalb liegt die Vorlage
 * jetzt mit im Haus (`public/brand/quelle/`) und es gibt diesen Weg von ihr
 * zu den Dateien — damit beim nächsten Mal nachprüfbar ist, woraus sie
 * entstanden sind.
 *
 *     npm run logo:aufbauen       Vorlage → logo-horizontal / logo-full-tagline
 *     npm run logo:negativ        daraus die Fassungen für dunklen Grund
 *
 * WAS DAS SKRIPT TUT
 *
 *   1. FREISTELLEN. Die Vorlage liegt auf Weiß. Jeder Bildpunkt wird gegen die
 *      drei bekannten Farben des Logos gerechnet — Navy, Türkis, Gold — und
 *      bekommt die Deckung, die ihn auf Weiß genau wieder ergäbe. Das ist
 *      exakt, solange die Farben flach sind, und sie sind es.
 *
 *   2. ENTRAUSCHEN. Die Vorlage ist ein weitergereichter Export und hat
 *      Kompressionsspuren. Auf Weiß sieht man sie nicht; auf dem dunklen Grund
 *      der Anwendung schon, als Sprenkel in den Buchstaben. Ein Mittelwert
 *      über die Nachbarschaft der Deckung nimmt sie heraus.
 *
 *   3. ZUSAMMENSETZEN. Das Zeichen kommt NICHT aus der Vorlage, sondern aus
 *      `icon.png` — das liegt seit jeher sauber freigestellt vor und ist
 *      dasselbe Zeichen. Der Schriftzug kommt aus der Vorlage. Abstand und
 *      Größenverhältnis werden aus der Vorlage gemessen, nicht geschätzt.
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { lesen, schreiben, schneiden, skalieren, tintenkasten } from './png.mjs'

const HIER = dirname(fileURLToPath(import.meta.url))
const MARKE = join(HIER, '..', 'public', 'brand')
const VORLAGE = join(MARKE, 'quelle', 'logo-vorlage.png')

/** Die drei Farben des Logos. Alles im Bild ist eine davon. */
const TINTEN = [
  [0x1e, 0x2c, 0x34],   // „OKUN" — dunkles Navy
  [0x1d, 0x99, 0xa3],   // „WORKFORCE" und der Punkt — Türkis
  [0xbf, 0x98, 0x64],   // Linie und Zusatz — Gold
]

/** Ab hier gilt ein Bildpunkt als Hintergrund. */
const WEISS = 250

/**
 * Freistellen: Aus `p = a·Tinte + (1−a)·Weiß` die Deckung `a` zurückrechnen.
 *
 * Für jede der drei Farben wird gerechnet, welche Deckung diesen Bildpunkt
 * erklären würde, und wie gut die Rechnung aufgeht. Es gewinnt die Farbe mit
 * dem kleinsten Fehler. Das trifft auch den türkisen Punkt mitten im navyblauen
 * Schriftzug, den eine Rechnung „ein Band, eine Farbe" verfehlt hätte.
 */
function freistellen(bild) {
  const aus = Buffer.alloc(bild.w * bild.h * 4)
  for (let i = 0; i < bild.w * bild.h; i++) {
    const p = [bild.rgba[i * 4], bild.rgba[i * 4 + 1], bild.rgba[i * 4 + 2]]
    if (p[0] > WEISS && p[1] > WEISS && p[2] > WEISS) continue

    let beste = null
    for (const C of TINTEN) {
      let summe = 0, n = 0
      for (let k = 0; k < 3; k++) {
        const spanne = 255 - C[k]
        if (spanne < 25) continue      // Kanal ohne Kontrast zu Weiß sagt nichts
        summe += (255 - p[k]) / spanne
        n++
      }
      if (!n) continue
      const a = Math.max(0, Math.min(1, summe / n))
      let fehler = 0
      for (let k = 0; k < 3; k++) fehler += Math.abs(a * C[k] + (1 - a) * 255 - p[k])
      if (!beste || fehler < beste.fehler) beste = { C, a, fehler }
    }
    if (!beste) continue

    /*
     * Das Innere einer Letter ist voll deckend.
     *
     * Die Vorlage hat in den Buchstaben leichte Verläufe. Ein Bildpunkt, der
     * etwas heller ist als die Tinte, bekäme sonst weniger Deckung — und auf
     * dunklem Grund schiene der Hintergrund durch die Buchstaben. Auf Weiß
     * fällt das nicht auf, auf #0F1112 sieht es aus wie Schmutz.
     */
    const a = Math.max(0, Math.min(1, (beste.a - 0.06) / 0.64))
    if (a <= 0.004) continue
    aus[i * 4] = beste.C[0]
    aus[i * 4 + 1] = beste.C[1]
    aus[i * 4 + 2] = beste.C[2]
    aus[i * 4 + 3] = Math.round(a * 255)
  }
  return { w: bild.w, h: bild.h, rgba: aus }
}

/**
 * Kompressionsspuren aus der Deckung nehmen — Mittelwert über drei mal drei.
 *
 * Nur die Deckung, nicht die Farbe: Die Farben sind nach dem Freistellen exakt
 * die drei Logofarben, und die sollen so bleiben. Volle und leere Flächen
 * bleiben unangetastet; geglättet wird nur dort, wo es tatsächlich flimmert.
 */
function entrauschen(bild) {
  const aus = Buffer.from(bild.rgba)
  for (let y = 1; y < bild.h - 1; y++) {
    for (let x = 1; x < bild.w - 1; x++) {
      const i = (y * bild.w + x) * 4
      const a = bild.rgba[i + 3]
      if (a === 0 || a === 255) continue
      let summe = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          summe += bild.rgba[((y + dy) * bild.w + x + dx) * 4 + 3]
        }
      }
      aus[i + 3] = Math.round(summe / 9)
    }
  }
  return { w: bild.w, h: bild.h, rgba: aus }
}

/** Ein Bild in ein größeres hineinkopieren, mit Deckung über dem Grund. */
function einsetzen(ziel, bild, x0, y0) {
  for (let y = 0; y < bild.h; y++) {
    for (let x = 0; x < bild.w; x++) {
      const q = (y * bild.w + x) * 4
      const a = bild.rgba[q + 3]
      if (a === 0) continue
      const z = ((y0 + y) * ziel.w + x0 + x) * 4
      if (z < 0 || z + 3 >= ziel.rgba.length) continue
      ziel.rgba[z] = bild.rgba[q]
      ziel.rgba[z + 1] = bild.rgba[q + 1]
      ziel.rgba[z + 2] = bild.rgba[q + 2]
      ziel.rgba[z + 3] = a
    }
  }
}

function leer(w, h) {
  return { w, h, rgba: Buffer.alloc(w * h * 4) }
}

// ── Los geht's ──────────────────────────────────────────────────────────────

const vorlage = lesen(VORLAGE)
const frei = entrauschen(freistellen(vorlage))

/*
 * Wo in der Vorlage hört das Zeichen auf und wo fängt der Schriftzug an?
 * Gemessen, nicht geraten: die erste senkrechte Lücke, die breiter ist als ein
 * Buchstabenabstand.
 */
const belegt = new Array(frei.w).fill(0)
for (let y = 0; y < frei.h; y++) {
  for (let x = 0; x < frei.w; x++) {
    if (frei.rgba[(y * frei.w + x) * 4 + 3] > 40) belegt[x]++
  }
}
let trennung = -1, anfang = -1
for (let x = 0; x < frei.w; x++) {
  if (belegt[x] === 0) { if (anfang < 0) anfang = x }
  else {
    if (anfang > 0 && x - anfang >= 24) { trennung = x; break }
    anfang = -1
  }
}
if (trennung < 0) {
  console.error('✗ In der Vorlage ist keine Lücke zwischen Zeichen und Schriftzug zu finden.')
  process.exit(1)
}

const zeichenTeil = schneiden(frei, 0, 0, trennung, frei.h)
const schriftTeil = schneiden(frei, trennung, 0, frei.w - trennung, frei.h)
const zeichenKasten = tintenkasten(zeichenTeil)
const schriftKasten = tintenkasten(schriftTeil)

// Der Schriftzug ohne den goldenen Zusatz: alles oberhalb der goldenen Linie.
// Gesucht wird die erste waagerechte Lücke unterhalb von „WORKFORCE".
const zeilenbelegung = new Array(schriftTeil.h).fill(0)
for (let y = 0; y < schriftTeil.h; y++) {
  for (let x = 0; x < schriftTeil.w; x++) {
    if (schriftTeil.rgba[(y * schriftTeil.w + x) * 4 + 3] > 40) zeilenbelegung[y]++
  }
}
const baender = []
let b0 = -1
for (let y = 0; y < schriftTeil.h; y++) {
  if (zeilenbelegung[y] > 0) { if (b0 < 0) b0 = y }
  else if (b0 >= 0) { baender.push([b0, y - 1]); b0 = -1 }
}
if (b0 >= 0) baender.push([b0, schriftTeil.h - 1])
if (baender.length < 2) {
  console.error('✗ Im Schriftzug sind nicht einmal zwei Zeilen zu finden.')
  process.exit(1)
}
const ohneZusatzBis = baender[1][1]      // Unterkante von „WORKFORCE"

const unserZeichen = lesen(join(MARKE, 'icon.png'))
const zeichenInk = tintenkasten(unserZeichen)
const zeichenRein = schneiden(unserZeichen, zeichenInk.x0, zeichenInk.y0,
  zeichenInk.w, zeichenInk.h)

const RAND = 6

/**
 * Eine Sperrung bauen: Zeichen links, Schriftzug rechts.
 *
 * `zeichenHoehe` und `abstand` kommen aus der Vorlage — für die Fassung ohne
 * Zusatz wird das Zeichen so weit verkleinert, dass es zum kürzeren
 * Schriftzug passt. Das Verhältnis 1.53 stammt aus der bisherigen Datei und
 * ist das, was ein Mensch dort hingezeichnet hat.
 */
function sperrung(schriftVon, schriftBis, zeichenFaktor) {
  const schrift = schneiden(schriftTeil, schriftKasten.x0, schriftVon,
    schriftKasten.w, schriftBis - schriftVon + 1)

  const zHoehe = Math.round(schrift.h * zeichenFaktor)
  const zBreite = Math.round(zHoehe * zeichenRein.w / zeichenRein.h)
  const zeichen = skalieren(zeichenRein, zBreite, zHoehe)

  // Der Abstand wächst mit dem Zeichen — so bleibt das Bild im Verhältnis.
  const abstand = Math.round(
    (schriftKasten.x0 + trennung - zeichenKasten.x1 - 1) * (zHoehe / zeichenKasten.h),
  )

  const hoehe = Math.max(zeichen.h, schrift.h) + 2 * RAND
  const breite = zeichen.w + abstand + schrift.w + 2 * RAND
  const bild = leer(breite, hoehe)
  einsetzen(bild, zeichen, RAND, Math.round((hoehe - zeichen.h) / 2))
  einsetzen(bild, schrift, RAND + zeichen.w + abstand, Math.round((hoehe - schrift.h) / 2))
  return bild
}

// Mit Zusatz: die Verhältnisse der Vorlage, unverändert.
const faktorVoll = zeichenKasten.h / schriftKasten.h
const mitZusatz = sperrung(schriftKasten.y0, schriftKasten.y1, faktorVoll)
schreiben(join(MARKE, 'logo-full-tagline.png'), mitZusatz)

// Ohne Zusatz: dasselbe Zeichen, aber auf die zwei Zeilen bezogen.
const ohneZusatz = sperrung(schriftKasten.y0, ohneZusatzBis, 1.53)
schreiben(join(MARKE, 'logo-horizontal.png'), ohneZusatz)

console.log(`Vorlage      ${vorlage.w}×${vorlage.h}, Trennung bei x=${trennung}`)
console.log(`Zeichen      ${zeichenKasten.w}×${zeichenKasten.h} (aus icon.png übernommen)`)
console.log(`Schriftzug   ${schriftKasten.w}×${schriftKasten.h}, zwei Zeilen bis y=${ohneZusatzBis}`)
console.log(`✓ logo-full-tagline.png  ${mitZusatz.w}×${mitZusatz.h}`)
console.log(`✓ logo-horizontal.png    ${ohneZusatz.w}×${ohneZusatz.h}`)
console.log('\nJetzt noch: npm run logo:negativ')
