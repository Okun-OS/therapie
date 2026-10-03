// §96: Eine Palette für Dienstarten — an einer Stelle definiert.
//
// Vorher waren Tagdienst (Gold) und Spätdienst (Grau) im Plan kaum zu
// unterscheiden; auf einen Blick war nicht erkennbar, wer früh und wer spät
// arbeitet. Die Farben sind jetzt deutlich getrennt: kühles Türkis für den
// Frühdienst, warmes Bernstein für den Tagdienst, Violett für den Spätdienst,
// tiefes Nachtblau für den Nachtdienst.

export interface ShiftPalette {
  color: string    // Schrift/Icon
  bgColor: string  // Kachelhintergrund
  label: string
}

export const SHIFT_PALETTE: Record<string, ShiftPalette> = {
  early:    { color: '#0B6E72', bgColor: '#DBF4F4', label: 'Frühdienst' },
  mid:      { color: '#8A5A08', bgColor: '#FCEFD6', label: 'Tagdienst' },
  late:     { color: '#4B3B96', bgColor: '#E9E4FB', label: 'Spätdienst' },
  night:    { color: '#1B2350', bgColor: '#D3D8EC', label: 'Nachtdienst' },
  standard: { color: '#0B6E72', bgColor: '#DBF4F4', label: 'Dienst' },
}

export function paletteFor(type: string | null | undefined): ShiftPalette {
  return SHIFT_PALETTE[type ?? 'standard'] ?? SHIFT_PALETTE.standard
}

// Farben, die früher automatisch vergeben wurden. Bestandsdienste tragen sie in
// der Datenbank, ohne dass sie je jemand ausgewählt hat — sie gelten deshalb
// als "nicht gesetzt" und werden durch die neue Palette ersetzt. Eine wirklich
// selbst gewählte Farbe bleibt dagegen erhalten.
const ALTE_STANDARDFARBEN = new Set([
  '#0E6B6F', '#C89C5B', '#3A3F42', '#26292B',
  '#E5FAFA', '#F8EFE2', '#E8ECEF', '#C9D0D4',
])

/**
 * Anzeigefarben eines Dienstes: eigene Farbe schlägt Palette, Altbestand mit
 * automatisch vergebener Farbe bekommt die neue Palette.
 */
export function displayColors(shift: { type?: string | null; color?: string | null; bgColor?: string | null }): ShiftPalette {
  const pal = paletteFor(shift.type)
  const eigeneFarbe = shift.color && !ALTE_STANDARDFARBEN.has(shift.color.toUpperCase())
  const eigenerHintergrund = shift.bgColor && !ALTE_STANDARDFARBEN.has(shift.bgColor.toUpperCase())
  return {
    color: eigeneFarbe ? shift.color! : pal.color,
    bgColor: eigenerHintergrund ? shift.bgColor! : pal.bgColor,
    label: pal.label,
  }
}
