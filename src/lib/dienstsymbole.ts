import { Sun, Moon, Briefcase, MoonStar } from 'lucide-react'
import type { ElementType } from 'react'

/**
 * §266 Das Symbol für eine Dienstart — an einer Stelle.
 *
 * DER FUND
 * Im Dienstplan einer Pflegekraft stand „4 Dienste diese Woche" und darunter
 * siebenmal „Frei". Die Dienste waren da; sie wurden nur nicht gezeichnet.
 *
 * DIE URSACHE
 * Die Zeile, die einen Dienst anzeigt, verlangte drei Dinge gleichzeitig:
 * einen Eintrag, eine Dienstzeit UND ein Symbol. Die Symbolkarte stand an
 * vier Stellen im Programm, und drei davon kannten nur `early`, `late` und
 * `mid`. Ein Nachtdienst (`night`) fand kein Symbol — und fiel damit durch
 * die Bedingung in den Zweig „Frei".
 *
 * Eine Pflegekraft im Nachtdienst sah also „Frei" an einem Tag, an dem sie
 * eingeteilt war. In einem Betrieb, der rund um die Uhr besetzt ist, ist das
 * kein Schönheitsfehler.
 *
 * WAS HIER ANDERS GEMACHT WIRD
 * Zwei Dinge, und das zweite ist das wichtigere:
 *
 *   1. Eine Karte statt vier. Vier Abschriften derselben Zuordnung laufen
 *      auseinander — §229, §232, §235 und jetzt §266.
 *   2. Es gibt IMMER ein Symbol. Eine unbekannte Dienstart bekommt das
 *      allgemeine Zeichen, statt nichts zurückzugeben. Ein fehlendes Symbol
 *      darf keinen Dienst verschwinden lassen — eine Oberfläche, die bei
 *      einer unbekannten Art lieber nichts zeigt als etwas Schlichtes, ist
 *      an der falschen Stelle streng.
 */

const SYMBOLE: Record<string, ElementType> = {
  early: Sun,
  mid: Briefcase,
  late: Moon,
  night: MoonStar,
}

/** Für alles, was wir (noch) nicht kennen. Niemals `undefined`. */
export const STANDARD_SYMBOL: ElementType = Briefcase

export function dienstSymbol(art: string | null | undefined): ElementType {
  if (!art) return STANDARD_SYMBOL
  return SYMBOLE[art] ?? STANDARD_SYMBOL
}
