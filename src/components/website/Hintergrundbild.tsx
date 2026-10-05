import Image from 'next/image'

/**
 * §189 Ein Hintergrundbild, hinter dem Text lesbar bleibt.
 *
 * WARUM DAS EINE EIGENE KOMPONENTE IST UND KEIN `background-image`
 * Zwei Gründe, und beide kosten sonst Kunden:
 *
 * 1. LESBARKEIT. Ein Bild unter Text ist ein Kontrastproblem, kein
 *    Gestaltungsproblem. Alle drei Bilder haben ihr Motiv rechts und links
 *    eine ruhige Fläche — genau dort steht die Überschrift. Nur: „ruhig" ist
 *    nicht „dunkel genug". Deshalb liegt über jedem Bild ein Verlauf, der
 *    links die Hintergrundfarbe der Seite hält und nach rechts durchlässig
 *    wird. Ohne ihn steht weiße Schrift stellenweise auf hellem Türkis.
 *
 * 2. DAS TELEFON. Auf einem schmalen Bildschirm ist kein Platz für
 *    „Text links, Motiv rechts" — der Text liegt dann ÜBER dem Motiv. Dort
 *    ist der Verlauf deshalb fast deckend: Das Bild wirkt nur noch als
 *    Stimmung, und es ist besser, ein schönes Bild halb zu verschenken, als
 *    eine Überschrift unleserlich zu machen.
 *
 * `next/image` statt `<img>`, weil es die Datei je nach Bildschirmbreite in
 * der passenden Größe ausliefert. Die WebP-Dateien sind mit
 * `npm run hintergrund:aufbereiten` aus den Vorlagen gebaut.
 *
 * `aria-hidden`: Die Bilder tragen keine Information, die nicht im Text
 * danebensteht. Ein Vorleseprogramm soll sie überspringen, nicht beschreiben.
 */
export function Hintergrundbild({
  bild,
  vorrang = false,
  ausschnitt = 'object-[72%_center]',
}: {
  bild: string
  /**
   * Nur für das erste Bild einer Seite. Es ist dort das größte sichtbare
   * Element und bestimmt, wann die Seite „da" wirkt; Next lädt es dann
   * sofort statt erst beim Scrollen.
   */
  vorrang?: boolean
  /** Welcher Teil des Bildes stehen bleibt, wenn der Platz schmaler wird. */
  ausschnitt?: string
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <Image
        src={bild}
        alt=""
        fill
        priority={vorrang}
        sizes="100vw"
        className={`object-cover ${ausschnitt}`}
      />
      {/*
        Der Verlauf nach rechts — mit ausgeschriebenen Haltepunkten statt
        Tailwind-Stufen, weil es hier auf die Stelle ankommt und nicht auf
        die Kürze.

        Die 62 % sind gemessen, nicht geschätzt: Die Überschrift liegt in
        `max-w-3xl` (48 rem) innerhalb von `max-w-6xl` (72 rem), reicht also
        bis zu zwei Dritteln der Spalte. Bis dorthin muss die Seitenfarbe
        stehen. Dahinter darf das Bild kommen — dort steht nichts mehr.

        Nachgeprüft wird das nicht hier, sondern im Browser: Die
        Marken-Prüfung blendet den Text aus und misst, wie hell der Grund
        unter der Überschrift wirklich ist.
      */}
      <div
        data-verlauf
        className="absolute inset-0 sm:hidden"
        style={{
          background:
            'linear-gradient(to right, #0F1112 0%, rgba(15,17,18,.97) 55%, '
            + 'rgba(15,17,18,.90) 80%, rgba(15,17,18,.80) 100%)',
        }}
      />
      <div
        data-verlauf
        className="absolute inset-0 hidden sm:block"
        style={{
          background:
            'linear-gradient(to right, #0F1112 0%, #0F1112 32%, rgba(15,17,18,.96) 50%, '
            + 'rgba(15,17,18,.88) 62%, rgba(15,17,18,.30) 84%, rgba(15,17,18,.12) 100%)',
        }}
      />
      {/*
        Oben und unten ausblenden, damit das Bild nicht an einer harten Kante
        gegen den nächsten Abschnitt stößt.
      */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-900/60 via-transparent to-navy-900" />
    </div>
  )
}
