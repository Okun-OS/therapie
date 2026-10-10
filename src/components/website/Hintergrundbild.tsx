import Image from 'next/image'

/**
 * §189 Ein Hintergrundbild, hinter dem Text lesbar bleibt.
 *
 * WARUM DAS EINE EIGENE KOMPONENTE IST UND KEIN `background-image`
 * Lesbarkeit auf einem Bild ist ein Kontrastproblem, kein Geschmacksproblem.
 * Wo die Überschrift steht, muss der Grund dunkel genug sein — und das hängt
 * vom Bild ab, nicht vom Gefühl. Deshalb liegt über jedem Bild ein Verlauf,
 * und deshalb misst `pruefungen/browser/marke.mjs` nach, ob er reicht: Dort
 * wird der Text unsichtbar gemacht und die Helligkeit darunter nachgerechnet.
 *
 * §190 WIE STARK DER VERLAUF SEIN DARF — NACHGEMESSEN STATT GERATEN
 * Die erste Fassung legte über das linke Drittel deckendes Schwarz. Der
 * Eigentümer sah darin zu Recht „einen schwarzen Streifen": Das Bild hat dort
 * sein eigenes, dunkles Blau mit einem leichten Schein, und der war weg.
 *
 * `npm run hintergrund:messen` zeigt, warum das unnötig war. Je Zehntel der
 * Bildbreite die hellste Stelle:
 *
 *     start-aufmacher       0–30 %: 0,019   40–50 %: 0,821   60–70 %: 0,927
 *     funktionen-aufmacher  0–20 %: 0,018   40–50 %: 1,000   60–70 %: 1,000
 *
 * Die Grenze für weiße Schrift liegt bei 0,33. Das linke Drittel ist also von
 * sich aus weit dunkel genug und braucht GAR KEINE Abdunklung. Gebraucht wird
 * sie erst ab etwa 30 %, wo das Motiv anfängt.
 *
 * Genau so ist der Verlauf jetzt gebaut: links durchsichtig, in der Mitte
 * stark genug für die Überschrift, rechts wieder offen. Das Bild läuft über
 * die ganze Breite, und abgedunkelt wird nur, wo wirklich Text darauf liegt.
 *
 * DAS TELEFON BLEIBT EIN ANDERER FALL
 * Auf einem schmalen Bildschirm ist kein Platz für „Text links, Motiv rechts"
 * — dort liegt die Überschrift ÜBER dem Motiv. Der Verlauf ist deshalb fast
 * deckend: Besser ein schönes Bild halb verschenken als eine Überschrift
 * unleserlich machen.
 *
 * `next/image` statt `<img>`, weil es die Datei je nach Bildschirmbreite in
 * der passenden Größe ausliefert. Die WebP-Dateien sind mit
 * `npm run hintergrund:aufbereiten` aus den Vorlagen gebaut.
 *
 * `aria-hidden`: Die Bilder tragen keine Information, die nicht im Text
 * danebensteht. Ein Vorleseprogramm soll sie überspringen, nicht beschreiben.
 */

/**
 * §190 Zwei Arten, ein Bild zu zeigen.
 *
 * `aufmacher` — über die ganze Breite einer Seite. Links bleibt das Bild
 * sichtbar, weil es dort ohnehin dunkel ist.
 *
 * `kasten` — in einem gerahmten Kasten, der nur einen Teil der Seite
 * einnimmt. Dort steht der Text dichter am Motiv und der Kasten hat harte
 * Kanten, an denen ein durchsichtiger Rand ausfransen würde. Deshalb bleibt
 * es hier bei der kräftigeren Abdunklung von links.
 */
const VERLAEUFE = {
  aufmacher: {
    schmal:
      'linear-gradient(to right, rgba(15,17,18,.97) 0%, rgba(15,17,18,.94) 55%, '
      + 'rgba(15,17,18,.88) 80%, rgba(15,17,18,.80) 100%)',
    /*
     * §190 Die Haltepunkte sind gemessen und einmal nachgebessert.
     *
     * Erster Versuch: ab 22 % durchsichtig, Höhepunkt .74. Auf der
     * Startseite ging das (0,077), auf der Funktionsseite nicht — dort stand
     * 0,480 bei einer Grenze von 0,33. Der Grund: Ihre Überschrift hat keine
     * Breitenbegrenzung und läuft bis fast an den rechten Rand des
     * Textfeldes, also mitten in das hellste Viertel des Bildes. Die
     * Startseite bricht früher um und blieb deshalb im Dunkeln.
     *
     * Jetzt beginnt die Abdunklung früher (18 statt 22 %), wird kräftiger
     * (.86 statt .74) und hält länger an. Links bleibt sie bei null — das
     * war der ganze Punkt.
     */
    breit:
      'linear-gradient(to right, rgba(15,17,18,0) 0%, rgba(15,17,18,0) 18%, '
      + 'rgba(15,17,18,.50) 28%, rgba(15,17,18,.86) 42%, rgba(15,17,18,.86) 66%, '
      + 'rgba(15,17,18,.40) 80%, rgba(15,17,18,0) 95%)',
  },
  kasten: {
    schmal:
      'linear-gradient(to right, #0F1112 0%, rgba(15,17,18,.97) 55%, '
      + 'rgba(15,17,18,.90) 80%, rgba(15,17,18,.80) 100%)',
    breit:
      'linear-gradient(to right, #0F1112 0%, #0F1112 30%, rgba(15,17,18,.92) 46%, '
      + 'rgba(15,17,18,.70) 58%, rgba(15,17,18,.20) 78%, rgba(15,17,18,.08) 100%)',
  },
} as const

export function Hintergrundbild({
  bild,
  vorrang = false,
  art = 'aufmacher',
  ausschnitt = 'object-[72%_center]',
}: {
  bild: string
  /**
   * Nur für das erste Bild einer Seite. Es ist dort das größte sichtbare
   * Element und bestimmt, wann die Seite „da" wirkt; Next lädt es dann
   * sofort statt erst beim Scrollen.
   */
  vorrang?: boolean
  art?: keyof typeof VERLAEUFE
  /** Welcher Teil des Bildes stehen bleibt, wenn der Platz schmaler wird. */
  ausschnitt?: string
}) {
  const verlauf = VERLAEUFE[art]

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
      <div
        data-verlauf
        className="absolute inset-0 sm:hidden"
        style={{ background: verlauf.schmal }}
      />
      <div
        data-verlauf
        className="absolute inset-0 hidden sm:block"
        style={{ background: verlauf.breit }}
      />
      {/*
        Oben und unten ausblenden, damit das Bild nicht an einer harten Kante
        gegen den nächsten Abschnitt stößt. Oben nur schwach — darüber sitzt
        der Seitenkopf, und der bringt seinen eigenen dunklen Grund mit.
      */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-900/45 via-transparent to-navy-900" />
    </div>
  )
}
