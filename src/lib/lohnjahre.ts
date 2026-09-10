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
    quelle: 'BMF-Programmablaufplan 2025 (MPARA) und Sozialversicherungsrechengrößen-Verordnung 2025',
    geprueft: '2026-09-10 · gegen den Programmablaufplan abgeglichen (Grundfreibetrag 12.096 €, Soli-Freigrenze 19.950 €)',
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
    quelle: 'BMF-Programmablaufplan 2026 (MPARA) und Sozialversicherungsrechengrößen-Verordnung 2026',
    geprueft: '2026-09-10 · gegen den Programmablaufplan abgeglichen (Grundfreibetrag 12.348 €, Soli-Freigrenze 20.350 €)',
  },
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
