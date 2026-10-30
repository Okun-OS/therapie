import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * §180 Das Logo — überall dasselbe.
 *
 * WAS HIER VORHER STAND
 * Zwei Wortmarken. Auf hellem Grund das echte Logo als Bild; auf dunklem
 * Grund — Anmeldeseite, Seitenleiste, Website, E-Mail — ein Nachbau aus
 * HTML-Text: `font-extrabold uppercase tracking-wide` in Inter. Das ist eine
 * andere Schrift als im Logo, mit anderer Sperrung und anderer Strichstärke.
 * Wer beides nacheinander sah, sah zwei Marken.
 *
 * Der Grund für den Nachbau war real: „OKUN" steht im Logo in einem Ton, der
 * fast Schwarz ist. Auf #0F1112 ist das nichts. Nur war die Antwort darauf
 * die falsche. Die richtige ist eine Negativfassung — `scripts/logo-negativ.mjs`
 * erzeugt sie aus derselben Datei, tauscht nur das Dunkel gegen Weiß und lässt
 * Zeichen, Türkis und Gold unangetastet.
 *
 * DIE GRÖSSE
 * `iconSize` ist immer die Höhe des Zeichens, nicht die der Datei. In beiden
 * Sperrungen steht das Zeichen etwas eingerückt im Bild, deshalb der Faktor
 * 1.05. Ein Aufrufer, der `iconSize={32}` schreibt, bekommt so ein Zeichen in
 * derselben Größe — ob mit Schriftzug oder ohne.
 */

interface LogoProps {
  variant?: 'icon' | 'wordmark'
  /** Negativfassung für dunkle Flächen (Seitenleiste, Website, Anmeldung). */
  onDark?: boolean
  tagline?: boolean
  iconSize?: number
  className?: string
}

/** Die vier Sperrungen. Der Dateiname wird nicht zusammengesetzt, damit er suchbar bleibt. */
const WORTMARKE = {
  hell: {
    ohne: '/brand/logo-horizontal.png',
    mit: '/brand/logo-full-tagline.png',
  },
  dunkel: {
    ohne: '/brand/logo-horizontal-negativ.png',
    mit: '/brand/logo-full-tagline-negativ.png',
  },
} as const

export function Logo({
  variant = 'wordmark',
  onDark = false,
  tagline = false,
  iconSize = 36,
  className,
}: LogoProps) {
  if (variant === 'icon') {
    return (
      <Image
        src="/brand/icon.png"
        alt="OKUN Workforce"
        width={iconSize}
        height={iconSize}
        style={{ width: iconSize, height: iconSize }}
        className={cn('object-contain', className)}
      />
    )
  }

  const satz = WORTMARKE[onDark ? 'dunkel' : 'hell']

  return (
    <Image
      src={tagline ? satz.mit : satz.ohne}
      alt="OKUN Workforce"
      width={240}
      height={Math.round(iconSize * 1.05)}
      style={{ height: iconSize * 1.05, width: 'auto' }}
      className={cn('object-contain', className)}
    />
  )
}
