/**
 * §116 Die Rechengrößen der Sozialversicherung, je Jahr.
 *
 * Vorher standen diese Werte verstreut als Konstanten im Rechenkern. Genau
 * daraus ist der schlimmste Fehler entstanden, den wir hatten: die Steuerformel
 * von 2024 stand neben Freibeträgen von 2025, und es ist niemandem aufgefallen.
 *
 * Deshalb sind sie hier Daten und keine Programmlogik — mit Quelle und
 * Prüfvermerk je Jahr. Für ein Jahr ohne Eintrag wird NICHT geschätzt, sondern
 * die Abrechnung verweigert (siehe `lohnjahrOderFehler`).
 *
 * Die Werte sind gegen den amtlichen Programmablaufplan des BMF abgeglichen —
 * dieselbe Quelle, aus der auch die Lohnsteuer gerechnet wird (siehe
 * `lohnsteuer-pap.ts`). Damit können Steuer- und Beitragsseite nicht mehr
 * auseinanderlaufen.
 *
 * WENN EIN NEUES JAHR ANSTEHT: Eintrag ergänzen, Quelle nennen, `geprueft`
 * setzen — und prüfen, ob `lohnsteuerrechner` das Jahr schon kennt.
 */

export interface Lohnjahr {
  jahr: number
  /** Beitragsbemessungsgrenze Renten- und Arbeitslosenversicherung, Monat */
  bbgRvAvMonat: number
  /** Beitragsbemessungsgrenze Kranken- und Pflegeversicherung, Monat */
  bbgKvPvMonat: number
  /** Gesamtbeitragssatz Rentenversicherung (AN und AG je die Hälfte) */
  rvSatz: number
  /** Gesamtbeitragssatz Arbeitslosenversicherung */
  avSatz: number
  /** Allgemeiner Beitragssatz Krankenversicherung ohne Zusatzbeitrag */
  kvBasisSatz: number
  /** Durchschnittlicher Zusatzbeitrag — nur Rückfallebene, wenn die Kasse fehlt */
  kvZusatzSatzDurchschnitt: number
  /** Gesamtbeitragssatz Pflegeversicherung */
  pvSatz: number
  /** Zuschlag für Kinderlose ab 23 Jahren, trägt allein der Arbeitnehmer */
  pvZuschlagKinderlos: number
  /** Abschlag je Kind ab dem zweiten, höchstens vier, nur Arbeitnehmer */
  pvAbschlagJeKind: number
  /** In Sachsen trägt der Arbeitnehmer 2,3 % und der Arbeitgeber 1,3 % */
  pvSachsenAn: number
  pvSachsenAg: number
  /** Werbungskosten- und Sonderausgabenpauschbetrag (§9a, §10c EStG) */
  arbeitnehmerPauschbetrag: number
  sonderausgabenPauschbetrag: number
  /**
   * Gesetzlicher Mindestlohn je Stunde. Aus ihm folgt die
   * Geringfügigkeitsgrenze — sie ist seit Oktober 2022 nicht mehr fest,
   * sondern rechnet sich nach §8 Abs.1a SGB IV aus dem Mindestlohn.
   */
  mindestlohn: number
  /** Obere Grenze des Übergangsbereichs (§20 Abs.2 SGB IV), seit 2023 fest */
  uebergangsbereichObergrenze: number
  quelle: string
  geprueft: string
}

const JAHRE: Record<number, Lohnjahr> = {
  2025: {
    jahr: 2025,
    bbgRvAvMonat: 8050,        // PAP 2025: BBGRV 96.600 € im Jahr
    bbgKvPvMonat: 5512.5,      // PAP 2025: BBGKVPV 66.150 € im Jahr
    rvSatz: 0.186,
    avSatz: 0.026,
    kvBasisSatz: 0.146,
    kvZusatzSatzDurchschnitt: 0.025,
    pvSatz: 0.036,
    pvZuschlagKinderlos: 0.006,
    pvAbschlagJeKind: 0.0025,
    pvSachsenAn: 0.023,
    pvSachsenAg: 0.013,
    arbeitnehmerPauschbetrag: 1230,
    sonderausgabenPauschbetrag: 36,
    mindestlohn: 12.82,
    uebergangsbereichObergrenze: 2000,
    quelle: 'BMF-Programmablaufplan 2025 (MPARA) und Sozialversicherungsrechengrößen-Verordnung 2025',
    geprueft: '2026-09-10 · gegen den Programmablaufplan abgeglichen (Grundfreibetrag 12.096 €, Soli-Freigrenze 19.950 €). '
      + 'Mindestlohn 12,82 € ergibt die Geringfügigkeitsgrenze 556 € — stimmt mit der amtlichen Grenze überein.',
  },
  2026: {
    jahr: 2026,
    bbgRvAvMonat: 8450,        // PAP 2026: BBGRVALV 101.400 € im Jahr
    bbgKvPvMonat: 5812.5,      // PAP 2026: BBGKVPV 69.750 € im Jahr
    rvSatz: 0.186,
    avSatz: 0.026,
    kvBasisSatz: 0.146,
    kvZusatzSatzDurchschnitt: 0.029,
    pvSatz: 0.036,
    pvZuschlagKinderlos: 0.006,
    pvAbschlagJeKind: 0.0025,
    pvSachsenAn: 0.023,
    pvSachsenAg: 0.013,
    arbeitnehmerPauschbetrag: 1230,
    sonderausgabenPauschbetrag: 36,
    mindestlohn: 13.90,
    uebergangsbereichObergrenze: 2000,
    quelle: 'BMF-Programmablaufplan 2026 (MPARA) und Sozialversicherungsrechengrößen-Verordnung 2026',
    geprueft: '2026-09-10 · gegen den Programmablaufplan abgeglichen (Grundfreibetrag 12.348 €, Soli-Freigrenze 20.350 €). '
      + 'ACHTUNG: Der Mindestlohn 2026 (13,90 €) ist NICHT gegen eine amtliche Quelle geprüft — '
      + 'aus ihm folgt die Geringfügigkeitsgrenze. Vor dem ersten Minijob bestätigen lassen.',
  },
}

/**
 * Die Geringfügigkeitsgrenze nach §8 Abs.1a SGB IV.
 *
 * Sie ist seit Oktober 2022 keine feste Zahl mehr, sondern folgt dem
 * Mindestlohn: das Monatsentgelt, das bei zehn Wochenstunden zum Mindestlohn
 * erreicht wird. Die Vorschrift rechnet mit 13 Wochen je Quartal, also
 * Mindestlohn × 130 ÷ 3, aufgerundet auf volle Euro.
 *
 * Deshalb steht hier die Formel und nicht die Zahl: so kann sie nicht veralten,
 * ohne dass es auffällt — geprüft werden muss nur der Mindestlohn.
 */
export function geringfuegigkeitsgrenze(jahr: Lohnjahr): number {
  return Math.ceil(jahr.mindestlohn * 130 / 3)
}

/**
 * Der Faktor F des Übergangsbereichs (§20 Abs.2a SGB IV).
 *
 * 28 Prozent geteilt durch den durchschnittlichen Gesamtsozialversicherungs-
 * beitragssatz des Jahres. Auch das eine Formel statt einer Zahl — der
 * Gesamtsatz steht ohnehin schon oben.
 */
export function uebergangsbereichFaktor(jahr: Lohnjahr): number {
  const gesamtsatz = jahr.rvSatz + jahr.avSatz
    + jahr.kvBasisSatz + jahr.kvZusatzSatzDurchschnitt + jahr.pvSatz
  return Math.round(0.28 / gesamtsatz * 10000) / 10000
}

/** Die bekannten Jahre, aufsteigend. */
export const BEKANNTE_LOHNJAHRE = Object.keys(JAHRE).map(Number).sort((a, b) => a - b)

export function lohnjahr(jahr: number): Lohnjahr | null {
  return JAHRE[jahr] ?? null
}

/**
 * Wie `lohnjahr`, wirft aber statt zu schätzen.
 *
 * Eine Abrechnung mit Werten aus dem falschen Jahr sieht richtig aus und ist
 * falsch — das fällt erst beim Steuerberater auf. Deshalb hier lieber ein
 * klarer Abbruch mit einer Meldung, die sagt, was zu tun ist.
 */
export function lohnjahrOderFehler(jahr: number): Lohnjahr {
  const j = lohnjahr(jahr)
  if (j) return j
  throw new Error(
    `Für ${jahr} sind keine geprüften Rechengrößen hinterlegt. `
    + `Bekannt sind ${BEKANNTE_LOHNJAHRE.join(', ')}. `
    + `Die Werte für ${jahr} müssen in src/lib/lohnjahre.ts eingetragen und geprüft werden, `
    + `bevor für dieses Jahr abgerechnet werden kann.`,
  )
}
