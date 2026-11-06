/**
 * §203 Wie ein Profilbild in den Kreis kommt.
 *
 * DER FEHLER, DEN DAS BEHEBT
 * Der Eigentümer hat gemeldet: „Die Profilbilder formatieren sich nicht
 * richtig, man sieht nicht das ganze Bild, weil es rangezoomt ist." Auf
 * seinem Bildschirmfoto war von einem Porträt nur die Augenpartie übrig.
 *
 * Im Quelltext stand:
 *
 *     ctx.drawImage(img, x, y, img.width, img.height)
 *
 * Die beiden letzten Werte sind bei dieser Form die ZIELmaße, nicht die
 * Quellmaße. Ein Handyfoto mit 3000×4000 Punkten wurde also in Originalgröße
 * auf eine 256er Fläche gemalt — übrig blieb ein 256×256-Ausschnitt aus der
 * Mitte, in voller Auflösung. Bei einem Porträt sind das die Augen.
 *
 * WARUM DIE RECHNUNG HIER STEHT UND NICHT IN DER SEITE
 * Weil genau sie falsch war. Eine Zeile Arithmetik mitten in einem
 * Datei-Auswahl-Handler sieht niemand an, und prüfen ließ sie sich dort
 * nicht: `canvas` gibt es im Testlauf nicht. Als Funktion ist sie
 * nachrechenbar, und der Fehler wäre aufgefallen.
 */

export interface Zuschnitt {
  /** Wohin im Zielbild gezeichnet wird (kann negativ sein — das ist der Beschnitt). */
  dx: number
  dy: number
  /** Wie groß gezeichnet wird. */
  dw: number
  dh: number
}

/**
 * Das Bild so skalieren, dass es die quadratische Fläche FÜLLT, und mittig
 * setzen.
 *
 * Skaliert wird auf die KURZE Kante (`Math.max` der beiden Verhältnisse):
 * Nähme man die lange, bliebe an zwei Seiten Rand, und ein Profilbild mit
 * weißen Streifen sieht aus wie ein Fehler. Der Überstand wird je zur Hälfte
 * oben und unten (oder links und rechts) abgeschnitten — das Motiv bleibt in
 * der Mitte, wo bei Porträts das Gesicht ist.
 */
export function zuschnitt(breite: number, hoehe: number, kante: number): Zuschnitt {
  if (!(breite > 0) || !(hoehe > 0) || !(kante > 0)) {
    // Ein Bild ohne Maße gibt es nicht. Lieber unverändert durchreichen als
    // mit NaN weiterrechnen — das ergäbe eine leere Fläche.
    return { dx: 0, dy: 0, dw: kante, dh: kante }
  }

  const faktor = Math.max(kante / breite, kante / hoehe)
  const dw = breite * faktor
  const dh = hoehe * faktor
  return { dx: (kante - dw) / 2, dy: (kante - dh) / 2, dw, dh }
}
