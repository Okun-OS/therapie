/**
 * §180 Die Negativfassung des Logos — erzeugt, nicht gemalt.
 *
 * DAS PROBLEM
 * Im Logo steht „OKUN" in einem Ton, der fast Schwarz ist (#171E25). Auf
 * weißem Papier ist das richtig. Auf dem dunklen Grund der Anwendung und der
 * Website (#0F1112) ist es unsichtbar. Genau deshalb stand an all diesen
 * Stellen bisher kein Logo, sondern nachgebauter HTML-Text in Inter — eine
 * andere Schrift, andere Sperrung, andere Strichstärke. Zwei Wortmarken, je
 * nachdem wie hell der Hintergrund war.
 *
 * DIE LÖSUNG, UND WARUM SIE EIN SKRIPT IST
 * Eine Negativfassung ist beim Logo der Normalfall: derselbe Schriftzug, die
 * dunkle Farbe gegen Weiß getauscht, alles andere unangetastet. Das ließe sich
 * von Hand in einem Bildprogramm machen — dann weiß aber niemand mehr, was
 * genau getauscht wurde, und beim nächsten Logo fängt man von vorn an. Als
 * Skript ist es nachvollziehbar und wiederholbar:
 *
 *     npm run logo:negativ
 *
 * Kommt eines Tages ein neues Logo (oder endlich eine SVG-Fassung), wird die
 * Quelldatei ersetzt und das Skript noch einmal gestartet. Sonst nichts.
 *
 * WAS ANGETASTET WIRD — UND WAS AUSDRÜCKLICH NICHT
 * Nur Bildpunkte rechts der Lücke zwischen Zeichen und Schriftzug, und davon
 * nur die dunklen. Das Zeichen selbst — der Schild und die sechs Figuren —
 * bleibt unberührt; die Grenze wird aus dem Bild gelesen, nicht geraten.
 * Türkis und Gold bleiben, wie sie sind: sie tragen auf dunklem Grund genug
 * Kontrast, und jede Aufhellung wäre ein zweites Logo.
 *
 * Die Kanten bleiben weich, weil die Deckung (Alpha) unberührt bleibt und nur
 * die Farbe getauscht wird. Wer stattdessen die Helligkeit invertierte, bekäme
 * graue Ränder.
 *
 * Nachgeprüft wird das Ergebnis in `src/lib/__tests__/marke.test.ts` — Punkt
 * für Punkt, einschließlich der Gegenprobe, dass links der Grenze kein
 * einziges Byte anders ist.
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { lesen, schreiben, schriftBeginn } from './png.mjs'

const HIER = dirname(fileURLToPath(import.meta.url))
const MARKE = join(HIER, '..', 'public', 'brand')

/** Ab hier gilt ein Bildpunkt als „dunkel" und damit als Teil von „OKUN". */
export const DUNKEL = 100

/** Nur rechts der Grenze, nur die dunklen Punkte: Farbe gegen Weiß tauschen. */
export function negativ(bild, grenze) {
  const rgba = Buffer.from(bild.rgba)
  let getauscht = 0
  for (let y = 0; y < bild.h; y++) {
    for (let x = grenze; x < bild.w; x++) {
      const i = (y * bild.w + x) * 4
      if (rgba[i + 3] === 0) continue
      if (Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) >= DUNKEL) continue
      rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255
      getauscht++
    }
  }
  return { bild: { w: bild.w, h: bild.h, rgba }, getauscht }
}

export const AUFGABEN = [
  ['logo-horizontal.png', 'logo-horizontal-negativ.png'],
  ['logo-full-tagline.png', 'logo-full-tagline-negativ.png'],
]

/** Nur ausführen, wenn direkt aufgerufen — der Test importiert die Bausteine. */
if (process.argv[1] && process.argv[1].endsWith('logo-negativ.mjs')) {
  let fehler = 0
  for (const [quelle, ziel] of AUFGABEN) {
    const bild = lesen(join(MARKE, quelle))
    const grenze = schriftBeginn(bild)
    if (grenze < 0) {
      console.error(`✗ ${quelle}: keine Lücke zwischen Zeichen und Schriftzug gefunden — nichts geändert.`)
      fehler++
      continue
    }
    const { bild: neu, getauscht } = negativ(bild, grenze)
    if (getauscht === 0) {
      console.error(`✗ ${quelle}: kein dunkler Schriftzug rechts von x=${grenze} — nichts geändert.`)
      fehler++
      continue
    }
    schreiben(join(MARKE, ziel), neu)
    const anteil = (100 * getauscht / (bild.w * bild.h)).toFixed(1)
    console.log(`✓ ${ziel}  ${bild.w}×${bild.h}  Schriftzug ab x=${grenze}  ${getauscht} Punkte (${anteil} %) auf Weiß`)
  }
  process.exit(fehler ? 1 : 0)
}
