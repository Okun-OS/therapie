/**
 * §275 Der steuer- und beitragsfreie Teil der Zuschläge (§3b EStG, §1 SvEV).
 *
 * WARUM DAS JETZT EIN EIGENES MODUL IST
 * Diese Rechnung stand als private Funktion in `payroll-engine.ts` und war von
 * dort nicht zu erreichen. Gebraucht wird sie aber an einer zweiten Stelle: in
 * der Übergabe ans Lohnbüro (§275), die ausdrücklich OHNE Abrechnung
 * auskommen muss. Ein Lohnbüro bucht steuerfreie und steuerpflichtige
 * Zuschläge auf verschiedene Lohnarten — ein Export, der sie zusammenwirft,
 * ist dort wertlos.
 *
 * Herausgezogen und nicht abgeschrieben: Zwei Kopien einer Steuervorschrift
 * laufen auseinander, sobald eine von beiden angefasst wird, und dann rechnet
 * die Abrechnung etwas anderes als der Export, den derselbe Betrieb an sein
 * Lohnbüro schickt. Welche der beiden Zahlen dann stimmt, sieht man ihnen
 * nicht an.
 *
 * Die Rechnung selbst ist unverändert. `payroll-engine.ts` ruft sie weiter
 * auf; die Lohnprüfungen belegen, dass dabei dasselbe herauskommt.
 */

/** Höchstsätze, bis zu denen ein Zuschlag steuerfrei bleibt. */
export const FREI_NACHT = 0.25       // Nachtarbeit 20:00–06:00 Uhr
export const FREI_SONNTAG = 0.50     // Sonntagsarbeit
export const FREI_FEIERTAG = 1.25    // Feiertagsarbeit
/*
 * Samstagszuschläge sind NICHT steuerfrei — dafür gibt es keine Vorschrift.
 * Sie fehlen deshalb unten mit Absicht und nicht aus Versehen.
 */

export const GRUNDLOHN_GRENZE_STEUER = 50   // §3b Abs.2 Satz 1 EStG
export const GRUNDLOHN_GRENZE_SV = 25       // §1 Abs.1 Satz 1 Nr.1 SvEV

export interface ZuschlagLage {
  /** Grundlohn je Stunde — der Maßstab der Steuerfreiheit. */
  grundlohn: number
  nachtBetrag: number
  nachtStunden: number
  sonntagBetrag: number
  sonntagStunden: number
  feiertagBetrag: number
  feiertagStunden: number
}

export interface ArtAufteilung {
  frei: number
  pflichtig: number
}

export interface ZuschlagAufteilung {
  /** Der steuerfreie Teil in Euro. */
  steuerfrei: number
  /** Der beitragsfreie Teil in Euro — kann kleiner sein als der steuerfreie. */
  svfrei: number
  /**
   * §276 Und dasselbe je Zuschlagsart.
   *
   * Die Summe allein reicht dem Lohnbüro nicht: Es bucht „Nachtzuschlag
   * steuerfrei" und „Nachtzuschlag steuerpflichtig" auf VERSCHIEDENE
   * Lohnarten, und ebenso für Sonntag und Feiertag. Aus einer Gesamtsumme
   * lässt sich das nicht zurückrechnen — welcher Teil der steuerpflichtigen
   * Zuschläge aus der Nacht stammt und welcher vom Feiertag, steht ihr
   * nicht an.
   */
  jeArt: {
    nacht: ArtAufteilung
    sonntag: ArtAufteilung
    feiertag: ArtAufteilung
  }
  /** Was ein Mensch wissen muss, wenn nichts freigestellt werden konnte. */
  hinweis?: string
}

const auf2 = (n: number) => Math.round(n * 100) / 100

/**
 * Steuerfrei ist immer nur der tatsächlich gezahlte Zuschlag, höchstens aber
 * der gesetzliche Prozentsatz des Grundlohns. Wer mehr zahlt, zahlt den Rest
 * versteuert — und wer über 25 €/h Grundlohn liegt, zahlt ab dort Beiträge,
 * obwohl es steuerfrei bleibt. Beide Grenzen greifen unabhängig voneinander.
 */
export function zuschlagSteuerfrei(lage: ZuschlagLage): ZuschlagAufteilung {
  const { grundlohn } = lage

  type Art = 'nacht' | 'sonntag' | 'feiertag'
  const posten: [Art, number, number, number][] = [
    // [Art, gezahlter Zuschlag, Stunden, Höchstsatz]
    ['nacht', lage.nachtBetrag, lage.nachtStunden, FREI_NACHT],
    ['sonntag', lage.sonntagBetrag, lage.sonntagStunden, FREI_SONNTAG],
    ['feiertag', lage.feiertagBetrag, lage.feiertagStunden, FREI_FEIERTAG],
  ]

  if (!(grundlohn > 0)) {
    /*
     * Ohne Grundlohn lässt sich die Grenze nicht bilden. Dann wird NICHTS
     * freigestellt — und das ist die vorsichtige Richtung: Zu viel versteuert
     * bekommt der Mensch zurück, zu wenig versteuert holt sich das Finanzamt
     * bei der nächsten Lohnsteuer-Außenprüfung beim Arbeitgeber.
     */
    const gezahlt = lage.nachtBetrag + lage.sonntagBetrag + lage.feiertagBetrag
    return {
      steuerfrei: 0, svfrei: 0,
      jeArt: {
        nacht: { frei: 0, pflichtig: auf2(Math.max(0, lage.nachtBetrag)) },
        sonntag: { frei: 0, pflichtig: auf2(Math.max(0, lage.sonntagBetrag)) },
        feiertag: { frei: 0, pflichtig: auf2(Math.max(0, lage.feiertagBetrag)) },
      },
      hinweis: gezahlt > 0
        ? 'Ohne Grundlohn je Stunde lässt sich die Steuerfreiheit der Zuschläge (§3b EStG) '
          + 'nicht bestimmen — sie werden vorsichtshalber voll versteuert.'
        : undefined,
    }
  }

  let steuerfrei = 0
  let svfrei = 0
  const jeArt = {
    nacht: { frei: 0, pflichtig: 0 },
    sonntag: { frei: 0, pflichtig: 0 },
    feiertag: { frei: 0, pflichtig: 0 },
  }

  for (const [art, gezahlt, stundenzahl, satz] of posten) {
    if (gezahlt <= 0) continue
    if (stundenzahl <= 0) {
      // Ein Betrag ohne zugehörige Stunden kann kein §3b-Zuschlag sein —
      // die Grenze ist ein Produkt aus Stunden. Er bleibt steuerpflichtig.
      jeArt[art].pflichtig = auf2(gezahlt)
      continue
    }
    const frei = Math.min(gezahlt, Math.min(grundlohn, GRUNDLOHN_GRENZE_STEUER) * stundenzahl * satz)
    steuerfrei += frei
    svfrei += Math.min(gezahlt, Math.min(grundlohn, GRUNDLOHN_GRENZE_SV) * stundenzahl * satz)
    jeArt[art] = { frei: auf2(frei), pflichtig: auf2(gezahlt - frei) }
  }

  return { steuerfrei: auf2(steuerfrei), svfrei: auf2(svfrei), jeArt }
}
