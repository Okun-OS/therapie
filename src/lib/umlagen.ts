import type { Lohnjahr } from './lohnjahre'

/**
 * §159 Die Umlagen: U1, U2 und Insolvenzgeld.
 *
 * WARUM DAS EINE LÜCKE WAR
 * Jeder Arbeitgeber zahlt sie, jeden Monat, auf jedes Entgelt — und sie
 * standen nirgends. Eine Abrechnung ohne Umlagen zeigt die Arbeitgeberkosten
 * zu niedrig, und bei der Betriebsprüfung fehlt Geld, das nie abgeführt wurde.
 *
 * DREI UMLAGEN, DREI VERSCHIEDENE REGELN
 *
 *   U1 — Entgeltfortzahlung im Krankheitsfall (§1 Abs. 1 AAG). Nur für
 *   KLEINE Betriebe: bis 30 Arbeitnehmer. Die Kasse erstattet dafür einen
 *   Teil der fortgezahlten Vergütung.
 *
 *   U2 — Mutterschaft (§1 Abs. 2 AAG). Für ALLE Arbeitgeber, ohne
 *   Größengrenze. Die Kasse erstattet dafür den Mutterschutzlohn und den
 *   Zuschuss zum Mutterschaftsgeld zu 100 %.
 *
 *   INSOLVENZGELDUMLAGE (§358 SGB III). Für alle, außer der öffentlichen Hand
 *   und Arbeitgebern, über deren Vermögen kein Insolvenzverfahren zulässig
 *   ist. Bundeseinheitlicher Satz durch Rechtsverordnung.
 *
 * DIE SÄTZE STEHEN NICHT IM GESETZ
 * U1 und U2 legt jede Krankenkasse in ihrer Satzung selbst fest, und sie
 * unterscheiden sich erheblich — U1 zwischen rund 1 % und 3 %, oft in mehreren
 * Erstattungsstufen zur Wahl. Deshalb werden sie je Kasse hinterlegt und nicht
 * geraten. Fehlt ein Satz, wird nichts gerechnet und deutlich gesagt, was
 * fehlt: Eine erfundene Umlage wäre schlimmer als eine fehlende, weil sie
 * niemandem auffällt.
 */

/** §7 AAG: Bemessungsgrundlage ist das Entgelt bis zur Grenze der RV. */
export interface Umlagesaetze {
  /** Satz der U1 als Anteil (0.02 = 2 %) — null heißt: nicht hinterlegt */
  u1: number | null
  /** Satz der U2 als Anteil — null heißt: nicht hinterlegt */
  u2: number | null
  /** Die gewählte Erstattungsstufe der U1, als Anteil (0.8 = 80 %) */
  u1Erstattung?: number | null
  /** Name der Kasse — steht in den Hinweisen, damit klar ist, welche gemeint ist */
  kasse?: string
}

export interface UmlagenErgebnis {
  u1: number
  u2: number
  insolvenzgeld: number
  gesamt: number
  /** Die Bemessungsgrundlage, auf der gerechnet wurde */
  bemessung: number
  hinweise: string[]
}

/**
 * Die Arbeitnehmerzahl für die U1-Grenze (§3 AAG).
 *
 * Gezählt wird NICHT nach Köpfen: Teilzeitkräfte zählen anteilig nach ihrer
 * regelmäßigen Wochenarbeitszeit, Auszubildende und einige weitere Gruppen
 * zählen gar nicht mit. Wer nach Köpfen zählt, kommt bei einer Einrichtung mit
 * vielen Teilzeitkräften über die Grenze und zahlt eine Umlage, die er nicht
 * schuldet — oder bekommt eine Erstattung nicht, die ihm zusteht.
 *
 *   bis 10 Wochenstunden  → 0,25
 *   bis 20 Wochenstunden  → 0,50
 *   bis 30 Wochenstunden  → 0,75
 *   darüber               → 1,00
 */
export function anrechnung(wochenstunden: number): number {
  if (wochenstunden <= 0) return 0
  if (wochenstunden <= 10) return 0.25
  if (wochenstunden <= 20) return 0.5
  if (wochenstunden <= 30) return 0.75
  return 1
}

export const U1_GRENZE = 30

// ── §175 Welcher Satz gilt in welchem Monat ─────────────────────────────────

/** Ein Stand mit Gültigkeitsbeginn — Katalogeintrag oder Wahl des Kunden. */
export interface MitStichtag {
  gueltigAb: string
}

/**
 * Den Stand heraussuchen, der in diesem Monat gilt.
 *
 * WARUM DAS EINE EIGENE FUNKTION IST
 * Krankenkassen ändern ihre Umlagesätze unterjährig. Allein 2026: die DAK zum
 * 1. September (U1 von 3,90 auf 1,80 % bei 80 % Erstattung), die IKK classic
 * zum 1. August, die AOK Sachsen-Anhalt die U2 zum 1. Juli. Wer immer „den
 * einen" Satz nimmt, rechnet ab dem Stichtag jeden Monat falsch — und es
 * fällt keinem auf, weil nichts fehlt und nichts warnt.
 *
 * Maßgeblich ist der ERSTE Tag des Abrechnungsmonats: Ein Satz, der zum
 * 1. September gilt, gilt für die Septemberabrechnung ganz. Kassen ändern
 * zum Monatsersten; einen Wechsel mitten im Monat gibt es in der Praxis
 * nicht, und das Umlageverfahren rechnet ohnehin je Monat ab.
 */
export function standZumMonat<T extends MitStichtag>(
  staende: T[],
  jahr: number,
  monat: number,
): T | null {
  const erster = `${jahr}-${String(monat).padStart(2, '0')}-01`
  const gueltig = staende
    .filter(s => s.gueltigAb <= erster)
    .sort((a, b) => b.gueltigAb.localeCompare(a.gueltigAb))
  return gueltig[0] ?? null
}

/** Ein Eintrag aus dem Katalog der Kassen. */
export interface Katalogeintrag extends MitStichtag {
  kasse: string
  u1Erstattung: number
  u1Satz: number
  u2Satz: number | null
  geprueft: boolean
}

/** Was ein Betrieb für eine Kasse gewählt hat. */
export interface Kassenwahl extends MitStichtag {
  kasse: string
  u1Erstattung: number | null
  /** Von Hand eingetragen — schlägt den Katalog */
  u1Satz: number | null
  u2Satz: number | null
}

/**
 * Die Sätze einer Kasse für einen Abrechnungsmonat.
 *
 * DREI QUELLEN, EINE REIHENFOLGE
 *   1. Was der Betrieb von Hand eingetragen hat. Es schlägt alles andere —
 *      eine kleine BKK steht vielleicht nicht im Katalog, und dann soll
 *      niemand warten müssen.
 *   2. Der Katalogeintrag zur gewählten Stufe, gültig in diesem Monat.
 *   3. Nichts. Dann wird auch nichts gerechnet, und der Lohnlauf sagt es.
 *      Eine erfundene Umlage wäre schlimmer als eine fehlende.
 */
export function saetzeFuerMonat(
  kasse: string,
  wahlen: Kassenwahl[],
  katalog: Katalogeintrag[],
  jahr: number,
  monat: number,
): Umlagesaetze & { quelle: 'eigen' | 'katalog' | 'keine'; geprueft: boolean } {
  const eigen = kasse.toLowerCase()
  const wahl = standZumMonat(
    wahlen.filter(w => w.kasse.toLowerCase() === eigen), jahr, monat)

  const leer = {
    u1: null, u2: null, u1Erstattung: wahl?.u1Erstattung ?? null, kasse,
    quelle: 'keine' as const, geprueft: false,
  }
  if (!wahl) return leer

  // 1. Handeintrag: Er gilt nur, wenn wirklich etwas eingetragen wurde.
  if (wahl.u1Satz != null || wahl.u2Satz != null) {
    return {
      u1: wahl.u1Satz, u2: wahl.u2Satz, u1Erstattung: wahl.u1Erstattung,
      kasse, quelle: 'eigen', geprueft: false,
    }
  }

  // 2. Katalog — zur gewählten Stufe und zum Monat.
  if (wahl.u1Erstattung == null) return leer
  const passend = katalog.filter(k =>
    k.kasse.toLowerCase() === eigen
    && Math.abs(k.u1Erstattung - wahl.u1Erstattung!) < 1e-9)
  const stand = standZumMonat(passend, jahr, monat)
  if (!stand) return leer

  return {
    u1: stand.u1Satz, u2: stand.u2Satz, u1Erstattung: stand.u1Erstattung,
    kasse, quelle: 'katalog', geprueft: stand.geprueft,
  }
}

export interface Betriebsgroesse {
  /** Die gewichtete Zahl nach §3 AAG */
  zahl: number
  /** Nimmt der Betrieb am U1-Verfahren teil? */
  u1Pflichtig: boolean
  hinweis: string
}

/**
 * Ob der Betrieb am U1-Verfahren teilnimmt.
 *
 * Maßgeblich ist nicht der heutige Stand, sondern ob der Betrieb im VORJAHR
 * für mindestens acht Monate nicht mehr als 30 Arbeitnehmer beschäftigt hat
 * (§3 Abs. 1 AAG). Das Programm rechnet mit der übergebenen Zahl und sagt
 * dazu, worauf es ankommt — die Feststellung trifft die Krankenkasse zu
 * Jahresbeginn, und sie gilt dann für das ganze Jahr.
 */
export function betriebsgroesse(
  beschaeftigte: { wochenstunden: number; auszubildend?: boolean }[],
): Betriebsgroesse {
  // §3 Abs. 1 Satz 3 AAG: Auszubildende bleiben außer Betracht.
  const zahl = runde(beschaeftigte
    .filter(b => !b.auszubildend)
    .reduce((s, b) => s + anrechnung(b.wochenstunden), 0))

  const u1Pflichtig = zahl <= U1_GRENZE
  return {
    zahl,
    u1Pflichtig,
    hinweis: u1Pflichtig
      ? `Gewichtet ${zahl.toLocaleString('de-DE')} Arbeitnehmer (§3 AAG: `
        + 'Teilzeit anteilig, Auszubildende zählen nicht mit). Der Betrieb '
        + 'nimmt am U1-Verfahren teil. Maßgeblich ist das Vorjahr — '
        + 'festgestellt wird es von der Krankenkasse zu Jahresbeginn, und die '
        + 'Feststellung gilt dann für das ganze Jahr.'
      : `Gewichtet ${zahl.toLocaleString('de-DE')} Arbeitnehmer (§3 AAG: `
        + 'Teilzeit anteilig, Auszubildende zählen nicht mit) — mehr als '
        + `${U1_GRENZE}. Es wird keine U1 erhoben und nichts erstattet `
        + '(§1 Abs. 1 AAG). Die U2 bleibt davon unberührt: Sie gilt für alle '
        + 'Arbeitgeber.',
  }
}

/**
 * Die Umlagen eines Monats für eine Person.
 */
export function berechne(
  svBrutto: number,
  saetze: Umlagesaetze,
  jahr: Lohnjahr,
  u1Pflichtig: boolean,
  /** Öffentliche Arbeitgeber zahlen keine Insolvenzgeldumlage (§358 SGB III) */
  insolvenzgeldpflichtig = true,
  /** §121 Beschäftigungsart: regulaer | minijob | kurzfristig | uebergangsbereich */
  art = 'regulaer',
): UmlagenErgebnis {
  const hinweise: string[] = []
  // §7 Abs. 2 AAG: bis zur Beitragsbemessungsgrenze der Rentenversicherung.
  const bemessung = runde(Math.min(Math.max(0, svBrutto), jahr.bbgRvAvMonat))

  // Eine kurzfristige Beschäftigung ist in allen Zweigen versicherungsfrei.
  // Damit gibt es kein rentenversicherungspflichtiges Arbeitsentgelt, und die
  // Insolvenzgeldumlage bemisst sich genau danach (§358 Abs. 2 SGB III). Die
  // U1 setzt einen Anspruch auf Entgeltfortzahlung voraus — den gibt es erst
  // nach vier Wochen Beschäftigung (§3 Abs. 3 EFZG), und ob er besteht, weiß
  // das Programm nicht.
  const kurzfristig = art === 'kurzfristig'

  let u1 = 0
  if (kurzfristig && u1Pflichtig && saetze.u1 != null) {
    hinweise.push(
      'Kurzfristige Beschäftigung: Es wurde keine U1 gerechnet. Sie setzt '
      + 'einen Anspruch auf Entgeltfortzahlung voraus, und der entsteht erst '
      + 'nach vier Wochen ununterbrochener Beschäftigung (§3 Abs. 3 EFZG). '
      + 'Dauert die Beschäftigung länger, gehört die U1 nachgemeldet.')
  } else if (u1Pflichtig) {
    if (saetze.u1 == null) {
      hinweise.push(
        `Der U1-Satz${saetze.kasse ? ` der ${saetze.kasse}` : ''} ist nicht `
        + 'hinterlegt. Es wurde keine U1 gerechnet. Der Satz steht in der '
        + 'Satzung der Kasse und unterscheidet sich von Kasse zu Kasse — '
        + 'geraten wird er nicht.')
    } else {
      u1 = runde(bemessung * saetze.u1)
    }
  }

  let u2 = 0
  if (saetze.u2 == null) {
    hinweise.push(
      `Der U2-Satz${saetze.kasse ? ` der ${saetze.kasse}` : ''} ist nicht `
      + 'hinterlegt. Es wurde keine U2 gerechnet. Sie gilt für ALLE '
      + 'Arbeitgeber, unabhängig von der Betriebsgröße (§1 Abs. 2 AAG).')
  } else {
    u2 = runde(bemessung * saetze.u2)
  }

  let insolvenzgeld = 0
  if (kurzfristig) {
    // Kein rentenversicherungspflichtiges Entgelt, keine Umlage.
  } else if (insolvenzgeldpflichtig) {
    insolvenzgeld = runde(bemessung * jahr.insolvenzgeldUmlage)
    if (!jahr.insolvenzgeldUmlageGeprueft) {
      hinweise.push(
        `Der Satz der Insolvenzgeldumlage für ${jahr.jahr} `
        + `(${(jahr.insolvenzgeldUmlage * 100).toLocaleString('de-DE')} %) ist `
        + 'aus dem Vorjahr fortgeschrieben und NICHT gegen die '
        + 'Rechtsverordnung abgeglichen. Er gehört bestätigt, bevor das Jahr '
        + 'abgeschlossen wird.')
    }
  }

  // Beim Minijob rechnet die Minijob-Zentrale mit eigenen, bundeseinheitlichen
  // Sätzen ab — nicht mit denen der Krankenkasse. Das Programm sagt es, statt
  // die Zahl der Kasse für richtig auszugeben.
  if (art === 'minijob' && (u1 > 0 || u2 > 0)) {
    hinweise.push(
      'Minijob: Die Umlagen gehen an die Minijob-Zentrale, die dafür eigene '
      + 'bundeseinheitliche Sätze erhebt. Gerechnet wurde hier mit den Sätzen '
      + 'der Krankenkasse — der Betrag gehört mit dem Beitragsnachweis der '
      + 'Minijob-Zentrale abgeglichen.')
  }

  return {
    u1, u2, insolvenzgeld,
    gesamt: runde(u1 + u2 + insolvenzgeld),
    bemessung,
    hinweise,
  }
}

/**
 * Was die Kasse erstattet.
 *
 * U1: ein Anteil der fortgezahlten Vergütung, den die Satzung festlegt — je
 * nach gewählter Stufe zwischen 40 % und 80 %. Auf den Arbeitgeberanteil zur
 * Sozialversicherung wird pauschal derselbe Satz angewandt.
 *
 * U2: der Mutterschutzlohn und der Zuschuss zum Mutterschaftsgeld zu 100 %,
 * dazu die darauf entfallenden Arbeitgeberbeiträge. Das ist der Grund, warum
 * es die U2 für alle gibt: Sonst wäre die Einstellung einer Frau im
 * gebärfähigen Alter für einen kleinen Betrieb ein Risiko.
 */
export function erstattung(
  art: 'u1' | 'u2',
  betrag: number,
  saetze: Umlagesaetze,
): { betrag: number; satz: number; hinweis: string } {
  if (art === 'u2') {
    return {
      betrag: runde(betrag),
      satz: 1,
      hinweis:
        'Mutterschaftsaufwendungen werden zu 100 % erstattet (§1 Abs. 2 AAG) '
        + '— einschließlich der darauf entfallenden Arbeitgeberbeiträge zur '
        + 'Sozialversicherung.',
    }
  }

  const satz = saetze.u1Erstattung ?? null
  if (satz == null) {
    return {
      betrag: 0,
      satz: 0,
      hinweis:
        'Die gewählte Erstattungsstufe der U1 ist nicht hinterlegt. Sie steht '
        + 'in der Satzung der Kasse und wird vom Betrieb gewählt — ein höherer '
        + 'Umlagesatz bedeutet eine höhere Erstattung.',
    }
  }

  return {
    betrag: runde(betrag * satz),
    satz,
    hinweis:
      `Erstattet werden ${(satz * 100).toLocaleString('de-DE')} % der `
      + 'fortgezahlten Vergütung (§1 Abs. 1 AAG). Der Antrag läuft über das '
      + 'Verfahren der Krankenkasse; er verjährt in vier Jahren '
      + '(§6 Abs. 1 AAG i.V.m. §45 SGB I).',
  }
}

export function runde(betrag: number): number {
  return Math.round((betrag + Number.EPSILON) * 100) / 100
}
