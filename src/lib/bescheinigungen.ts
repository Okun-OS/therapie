import type { Lohnjahr } from './lohnjahre'

/**
 * §160 Bescheinigungen: Arbeitsbescheinigung, Krankengeld, Mutterschaft.
 *
 * WAS DAS PROGRAMM TUT UND WAS NICHT
 * Alle drei gehen heute elektronisch: die Arbeitsbescheinigung über BEA, die
 * Entgeltbescheinigungen über das EEL-Verfahren. Beides setzt einen
 * zertifizierten Zugang voraus, den wir nicht haben und nach derselben
 * Überlegung wie bei den SV-Meldungen auch nicht anstreben: Wir rechnen, der
 * Steuerberater meldet.
 *
 * Was hier entsteht, sind deshalb die ZAHLEN — vollständig, nachvollziehbar
 * und aus den abgerechneten Monaten gezogen. Wer sie einträgt, muss nichts
 * suchen und nichts nachrechnen. Und was das Programm nicht wissen kann,
 * steht als offene Frage daneben, statt leer zu bleiben.
 *
 * DER FEHLER, DEN EINE BESCHEINIGUNG TEUER MACHT
 * Sie ist keine Gefälligkeit. Wer sie falsch ausstellt, kostet den Menschen
 * Geld: ein zu niedriges Regelentgelt heißt ein zu niedriges Krankengeld für
 * bis zu 78 Wochen, ein falsches Beendigungsdatum heißt eine Sperrzeit. Und
 * wer sie zu spät ausstellt, verzögert die Leistung — bei jemandem, der gerade
 * kein Einkommen hat.
 */

export interface Abrechnungsmonat {
  jahr: number
  monat: number
  /** Laufendes beitragspflichtiges Bruttoentgelt, ohne Einmalzahlungen */
  svBrutto: number
  /** Einmalzahlungen dieses Monats */
  einmalzahlungen: number
  netto: number
  /** Bezahlte Stunden des Monats */
  stunden: number
  /** SV-Tage des Monats, 1–30 */
  svTage: number
}

const KALENDERTAGE_MONAT = 30

// ── Mutterschaft (§§19–20 MuSchG) ───────────────────────────────────────────

/** §19 Abs. 1 MuSchG i.V.m. §24i SGB V: Höchstbetrag der Kasse je Kalendertag. */
export const MUTTERSCHAFTSGELD_KASSE = 13

export interface Mutterschaft {
  /** Die Monate, aus denen gerechnet wurde */
  grundlage: Abrechnungsmonat[]
  /** Kalendertägliches Nettoentgelt */
  nettoJeTag: number
  /** Was die Kasse zahlt, je Kalendertag */
  kasseJeTag: number
  /** Was der Arbeitgeber zuschießt, je Kalendertag */
  zuschussJeTag: number
  /** Der Zuschuss für den ganzen angefragten Zeitraum */
  zuschussGesamt: number
  tage: number
  hinweise: string[]
}

/**
 * Der Zuschuss zum Mutterschaftsgeld (§20 Abs. 1 MuSchG).
 *
 * Gerechnet wird aus den letzten DREI abgerechneten Kalendermonaten vor Beginn
 * der Schutzfrist. Einmalzahlungen bleiben dabei außer Ansatz
 * (§21 Abs. 1 Satz 2 MuSchG) — wer sie mitrechnet, setzt den Zuschuss zu hoch
 * an und bekommt die Differenz von der Kasse nicht erstattet.
 *
 * Die Kasse zahlt höchstens 13 € je Kalendertag. Alles darüber trägt der
 * Arbeitgeber — und bekommt es über die U2 zu 100 % zurück (§1 Abs. 2 AAG).
 * Das ist der Grund, warum die U2 für alle Arbeitgeber gilt.
 */
export function mutterschaftszuschuss(
  monate: Abrechnungsmonat[],
  /** Zahl der Kalendertage im Zeitraum, für den gezahlt wird */
  tage: number,
): Mutterschaft {
  const hinweise: string[] = []
  // Die drei letzten abgerechneten Monate, absteigend sortiert.
  const sortiert = [...monate]
    .sort((a, b) => b.jahr - a.jahr || b.monat - a.monat)
    .slice(0, 3)

  if (sortiert.length === 0) {
    return {
      grundlage: [], nettoJeTag: 0, kasseJeTag: 0, zuschussJeTag: 0,
      zuschussGesamt: 0, tage,
      hinweise: [
        'Es liegen keine abgerechneten Monate vor. Ohne sie lässt sich der '
        + 'Zuschuss nach §20 MuSchG nicht berechnen — er bemisst sich am '
        + 'Nettoentgelt der letzten drei abgerechneten Kalendermonate.',
      ],
    }
  }
  if (sortiert.length < 3) {
    hinweise.push(
      `Es liegen nur ${sortiert.length} abgerechnete Monate vor. Gerechnet `
      + 'wurde mit ihnen; §21 Abs. 2 MuSchG lässt einen kürzeren Zeitraum zu, '
      + 'wenn das Arbeitsverhältnis noch nicht länger besteht.',
    )
  }

  // §21 Abs. 1 Satz 2 MuSchG: Einmalzahlungen bleiben außer Ansatz. Das Netto
  // der Abrechnung enthält sie — der Anteil wird deshalb herausgerechnet.
  const bruttoGesamt = sortiert.reduce(
    (s, m) => s + m.svBrutto + m.einmalzahlungen, 0)
  const einmalAnteil = bruttoGesamt > 0
    ? sortiert.reduce((s, m) => s + m.einmalzahlungen, 0) / bruttoGesamt : 0
  const nettoGesamt = sortiert.reduce((s, m) => s + m.netto, 0)
  const nettoOhneEinmal = nettoGesamt * (1 - einmalAnteil)

  if (einmalAnteil > 0) {
    hinweise.push(
      'In den drei Monaten liegen Einmalzahlungen. Sie bleiben nach '
      + '§21 Abs. 1 Satz 2 MuSchG außer Ansatz und wurden anteilig aus dem '
      + 'Nettoentgelt herausgerechnet. Der Anteil ist geschätzt — genauer '
      + 'ginge es nur mit einer Vergleichsabrechnung ohne die Zahlung.',
    )
  }

  const nettoJeTag = runde(nettoOhneEinmal / (sortiert.length * KALENDERTAGE_MONAT))
  const kasseJeTag = Math.min(MUTTERSCHAFTSGELD_KASSE, nettoJeTag)
  const zuschussJeTag = runde(Math.max(0, nettoJeTag - MUTTERSCHAFTSGELD_KASSE))

  if (zuschussJeTag === 0) {
    hinweise.push(
      `Das kalendertägliche Nettoentgelt liegt bei ${euro(nettoJeTag)} und `
      + `damit nicht über dem Mutterschaftsgeld der Kasse `
      + `(${euro(MUTTERSCHAFTSGELD_KASSE)} je Kalendertag). Es entsteht kein `
      + 'Zuschuss.',
    )
  } else {
    hinweise.push(
      `Der Zuschuss wird über die U2 zu 100 % erstattet (§1 Abs. 2 AAG) — `
      + 'einschließlich der Arbeitgeberbeiträge. Er ist steuer- und '
      + 'beitragsfrei (§3 Nr. 1 lit. d EStG, §1 Abs. 1 Satz 1 Nr. 6 SvEV), '
      + 'unterliegt aber dem Progressionsvorbehalt.',
    )
  }

  return {
    grundlage: sortiert,
    nettoJeTag,
    kasseJeTag: runde(kasseJeTag),
    zuschussJeTag,
    zuschussGesamt: runde(zuschussJeTag * Math.max(0, tage)),
    tage,
    hinweise,
  }
}

// ── Krankengeld (§47 SGB V, §23c SGB IV) ────────────────────────────────────

export interface Krankengeld {
  /** Der letzte abgerechnete Entgeltabrechnungszeitraum */
  grundlage: Abrechnungsmonat | null
  /** Kalendertägliches Regelentgelt */
  regelentgeltJeTag: number
  /** Hinzurechnung aus Einmalzahlungen der letzten zwölf Monate */
  einmalJeTag: number
  /** Kalendertägliches Nettoentgelt */
  nettoJeTag: number
  /** 70 % des Regelentgelts */
  siebzigProzent: number
  /** 90 % des Nettoentgelts — die Obergrenze */
  neunzigProzent: number
  /** Der voraussichtliche Bruttobetrag des Krankengeldes je Kalendertag */
  krankengeldJeTag: number
  hinweise: string[]
}

/**
 * Das Regelentgelt für das Krankengeld (§47 SGB V).
 *
 * Der Arbeitgeber BERECHNET das Krankengeld nicht — das tut die Krankenkasse.
 * Er bescheinigt die Grundlagen: das Entgelt des letzten abgerechneten
 * Zeitraums, die Stunden, das Nettoentgelt und die Einmalzahlungen der letzten
 * zwölf Monate. Wer hier zu niedrig bescheinigt, kostet den Menschen Geld,
 * und zwar bis zu 78 Wochen lang.
 *
 * Die Zahl, die hier als Krankengeld herauskommt, ist deshalb ausdrücklich
 * eine VORSCHAU: Sie zeigt, worauf die Bescheinigung hinausläuft, damit ein
 * Zahlendreher auffällt, bevor er beim Menschen ankommt.
 */
export function krankengeld(
  letzterMonat: Abrechnungsmonat | null,
  /** Einmalzahlungen der letzten zwölf Monate */
  einmalzahlungenJahr: number,
  jahr: Lohnjahr,
): Krankengeld {
  const hinweise: string[] = []

  if (!letzterMonat) {
    return {
      grundlage: null, regelentgeltJeTag: 0, einmalJeTag: 0, nettoJeTag: 0,
      siebzigProzent: 0, neunzigProzent: 0, krankengeldJeTag: 0,
      hinweise: [
        'Es liegt kein abgerechneter Entgeltabrechnungszeitraum vor. Ohne ihn '
        + 'lässt sich nichts bescheinigen — §47 Abs. 2 SGB V stellt genau '
        + 'darauf ab.',
      ],
    }
  }

  // §47 Abs. 2 SGB V: bei monatlicher Abrechnung das Entgelt geteilt durch 30.
  let regelentgeltJeTag = runde(letzterMonat.svBrutto / KALENDERTAGE_MONAT)
  // §47 Abs. 2 Satz 6 SGB V: Einmalzahlungen der letzten zwölf Monate,
  // geteilt durch 360. Sie zu vergessen ist der häufigste Fehler — er kostet
  // bei einem Weihnachtsgeld schnell einen Euro am Tag.
  const einmalJeTag = runde(Math.max(0, einmalzahlungenJahr) / 360)
  regelentgeltJeTag = runde(regelentgeltJeTag + einmalJeTag)

  // Gedeckelt auf die Beitragsbemessungsgrenze der Krankenversicherung.
  const hoechst = runde(jahr.bbgKvPvMonat / KALENDERTAGE_MONAT)
  if (regelentgeltJeTag > hoechst) {
    regelentgeltJeTag = hoechst
    hinweise.push(
      `Das Regelentgelt ist auf ${euro(hoechst)} je Kalendertag begrenzt — `
      + 'das ist die Beitragsbemessungsgrenze der Krankenversicherung.',
    )
  }

  const nettoJeTag = runde(letzterMonat.netto / KALENDERTAGE_MONAT)
  const siebzigProzent = runde(regelentgeltJeTag * 0.7)
  const neunzigProzent = runde(nettoJeTag * 0.9)
  const krankengeldJeTag = runde(Math.min(siebzigProzent, neunzigProzent))

  if (einmalJeTag > 0) {
    hinweise.push(
      `Einmalzahlungen der letzten zwölf Monate erhöhen das Regelentgelt um `
      + `${euro(einmalJeTag)} je Kalendertag (§47 Abs. 2 Satz 6 SGB V). Sie `
      + 'zu vergessen ist der häufigste Fehler in dieser Bescheinigung.',
    )
  }
  if (neunzigProzent < siebzigProzent) {
    hinweise.push(
      'Die Obergrenze greift: 70 % des Regelentgelts lägen über 90 % des '
      + 'Nettoentgelts (§47 Abs. 1 Satz 2 SGB V).',
    )
  }
  hinweise.push(
    'Diese Zahl ist eine Vorschau. Das Krankengeld berechnet die Kasse; vom '
    + 'Bruttokrankengeld gehen noch die Arbeitnehmeranteile zur Renten-, '
    + 'Arbeitslosen- und Pflegeversicherung ab.',
  )

  return {
    grundlage: letzterMonat,
    regelentgeltJeTag, einmalJeTag, nettoJeTag,
    siebzigProzent, neunzigProzent, krankengeldJeTag,
    hinweise,
  }
}

// ── Arbeitsbescheinigung (§312 SGB III) ─────────────────────────────────────

export interface Arbeitsbescheinigung {
  /** Die letzten zwölf abgerechneten Monate, aufsteigend */
  monate: Abrechnungsmonat[]
  /** Beitragspflichtiges Arbeitsentgelt dieser Monate */
  entgeltGesamt: number
  /** Kalendertägliches Bemessungsentgelt (§151 SGB III) */
  bemessungsentgeltJeTag: number
  /** Die Tage, auf die verteilt wurde */
  tage: number
  /** Was das Programm nicht wissen kann und eingetragen werden muss */
  offeneAngaben: string[]
  hinweise: string[]
}

/**
 * Die Arbeitsbescheinigung nach §312 SGB III.
 *
 * Sie entscheidet über Höhe und Beginn des Arbeitslosengeldes. Zwei Dinge
 * gehen dabei regelmäßig schief:
 *
 *   DAS BEMESSUNGSENTGELT wird aus dem beitragspflichtigen Arbeitsentgelt der
 *   letzten zwölf Monate gebildet (§150 f. SGB III). Wer Monate vergisst oder
 *   Einmalzahlungen nicht einbezieht, bescheinigt zu wenig.
 *
 *   DER BEENDIGUNGSGRUND entscheidet über eine Sperrzeit von bis zu zwölf
 *   Wochen. Er lässt sich nicht aus Daten ableiten, und das Programm rät ihn
 *   auch nicht — es sagt, dass er einzutragen ist.
 */
export function arbeitsbescheinigung(
  monate: Abrechnungsmonat[],
): Arbeitsbescheinigung {
  const sortiert = [...monate]
    .sort((a, b) => b.jahr - a.jahr || b.monat - a.monat)
    .slice(0, 12)
    .reverse()

  const entgeltGesamt = runde(sortiert.reduce(
    (s, m) => s + m.svBrutto + m.einmalzahlungen, 0))
  const tage = sortiert.reduce((s, m) => s + Math.max(0, m.svTage), 0)
  const bemessungsentgeltJeTag = tage > 0 ? runde(entgeltGesamt / tage) : 0

  const hinweise: string[] = []
  if (sortiert.length < 12) {
    hinweise.push(
      `Es liegen nur ${sortiert.length} abgerechnete Monate vor. Reicht der `
      + 'Bemessungsrahmen nicht aus, erweitert die Agentur ihn auf zwei Jahre '
      + '(§150 Abs. 3 SGB III) — dafür braucht sie die Bescheinigungen der '
      + 'vorherigen Arbeitgeber.',
    )
  }
  hinweise.push(
    'Die Bescheinigung geht über das Verfahren BEA elektronisch an die '
    + 'Agentur. Sie ist unverzüglich auszustellen (§312 Abs. 1 SGB III); wer '
    + 'sie verzögert, verzögert das Arbeitslosengeld eines Menschen ohne '
    + 'Einkommen.',
  )

  return {
    monate: sortiert,
    entgeltGesamt,
    bemessungsentgeltJeTag,
    tage,
    // Das sind keine Lücken, sondern bewusst offene Felder: Sie stehen
    // nirgends in den Daten und dürfen nicht geraten werden.
    offeneAngaben: [
      'Grund der Beendigung (Kündigung durch wen, Aufhebungsvertrag, '
      + 'Befristung) — er entscheidet über eine Sperrzeit von bis zu zwölf '
      + 'Wochen (§159 SGB III).',
      'Ob und mit welcher Frist gekündigt wurde. Eine nicht eingehaltene '
      + 'Kündigungsfrist lässt den Anspruch ruhen (§158 SGB III).',
      'Ob eine Abfindung gezahlt wurde und wofür.',
      'Ob Urlaub abgegolten wurde und für wie viele Tage — der Anspruch ruht '
      + 'so lange (§157 Abs. 2 SGB III).',
      'Ob das Arbeitsverhältnis ordentlich kündbar war.',
    ],
    hinweise,
  }
}

export function runde(betrag: number): number {
  return Math.round((betrag + Number.EPSILON) * 100) / 100
}

function euro(betrag: number): string {
  return `${betrag.toLocaleString('de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })} €`
}
