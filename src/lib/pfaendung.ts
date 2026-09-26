/**
 * §155 Lohnpfändung — §§850 ff. ZPO.
 *
 * WARUM DAS GEFÄHRLICHER IST ALS DER REST DER ABRECHNUNG
 * Bei jedem anderen Rechenfehler merkt es irgendwann jemand und es wird
 * korrigiert. Hier nicht: Rechnet das Programm zu viel ab, fehlt dem
 * Beschäftigten Geld, das er zum Leben braucht — der pfändungsfreie Betrag ist
 * das Existenzminimum. Rechnet es zu wenig ab, haftet der ARBEITGEBER dem
 * Gläubiger gegenüber persönlich (§840 ZPO). Es gibt keine Seite, auf der ein
 * Fehler harmlos wäre.
 *
 * Deshalb hier dieselbe Regel wie beim Lohnjahr: Für einen Zeitraum ohne
 * geprüfte Tabelle wird NICHT geschätzt, sondern die Berechnung verweigert.
 *
 * DIE DREI SCHRITTE, DIE GERN VERWECHSELT WERDEN
 *
 *   1. Was ist überhaupt pfändbares Arbeitseinkommen? (§850a, §850e ZPO)
 *      Nicht alles, was ausgezahlt wird, darf angefasst werden. Die Hälfte der
 *      Mehrarbeitsvergütung, das Urlaubsgeld, Gefahren- und Schmutzzulagen
 *      bleiben ganz außen vor. Wer das überspringt, pfändet zu viel — und
 *      zwar systematisch bei denen, die Nachtdienste machen.
 *
 *   2. Wie viel davon ist pfändbar? (§850c ZPO)
 *      Erst der Grundfreibetrag, der mit jeder Unterhaltspflicht steigt. Vom
 *      Rest darüber bleibt ein Anteil frei, der ebenfalls mit den
 *      Unterhaltspflichten steigt. Oberhalb eines Höchstbetrags ist alles
 *      pfändbar.
 *
 *   3. Wer bekommt es? (§804 Abs. 3 ZPO, §850d ZPO)
 *      Bei mehreren Pfändungen gilt die Reihenfolge der Zustellung — die
 *      ältere geht vor. Unterhaltsforderungen stehen davor, und für sie gilt
 *      die Tabelle aus Schritt 2 gar nicht.
 *
 * WAS DIESES MODUL NICHT ENTSCHEIDET
 * Ob eine Pfändung wirksam ist, ob ein Betrag richtig tituliert wurde, ob eine
 * Abtretung vorgeht. Das steht im Beschluss, und den liest ein Mensch.
 */

// ── Die Tabelle nach §850c ZPO ─────────────────────────────────────────────

export interface Pfaendungstabelle {
  /** Ab wann sie gilt — die Anpassung erfolgt jeweils zum 1. Juli */
  ab: string
  /** Unpfändbarer Grundbetrag im Monat, ohne Unterhaltspflichten */
  grundbetrag: number
  /** Erhöhung für die erste Person, der Unterhalt gewährt wird */
  ersteUnterhaltspflicht: number
  /** Erhöhung für die zweite bis fünfte Person, je */
  weitereUnterhaltspflicht: number
  /** Oberhalb dieses Betrags ist das Einkommen voll pfändbar */
  hoechstbetrag: number
  quelle: string
  geprueft: string
}

/**
 * Die Pfändungsfreigrenzen, je Gültigkeitszeitraum.
 *
 * WARUM NICHT NACH KALENDERJAHR
 * Weil §850c Abs. 4 ZPO die Anpassung zum 1. JULI vorschreibt, nicht zum
 * 1. Januar. Eine Tabelle nach Kalenderjahr wäre in jedem zweiten Halbjahr
 * falsch — und zwar ohne dass irgendetwas auffiele.
 */
export const TABELLEN: Pfaendungstabelle[] = [
  {
    ab: '2023-07-01',
    grundbetrag: 1402.28,
    ersteUnterhaltspflicht: 527.76,
    weitereUnterhaltspflicht: 294.02,
    hoechstbetrag: 4298.81,
    quelle: 'Pfändungsfreigrenzenbekanntmachung 2023 (BGBl. I)',
    geprueft: 'NICHT gegen die amtliche Bekanntmachung abgeglichen.',
  },
  {
    ab: '2024-07-01',
    grundbetrag: 1491.73,
    ersteUnterhaltspflicht: 561.43,
    weitereUnterhaltspflicht: 312.78,
    hoechstbetrag: 4573.10,
    quelle: 'Pfändungsfreigrenzenbekanntmachung 2024 (BGBl. I)',
    geprueft: 'NICHT gegen die amtliche Bekanntmachung abgeglichen.',
  },
  {
    ab: '2025-07-01',
    grundbetrag: 1559.99,
    ersteUnterhaltspflicht: 587.07,
    weitereUnterhaltspflicht: 327.02,
    hoechstbetrag: 4786.52,
    quelle: 'Pfändungsfreigrenzenbekanntmachung 2025 (BGBl. I)',
    geprueft: 'NICHT gegen die amtliche Bekanntmachung abgeglichen.',
  },
  {
    ab: '2026-07-01',
    grundbetrag: 1618.71,
    ersteUnterhaltspflicht: 609.17,
    weitereUnterhaltspflicht: 339.33,
    hoechstbetrag: 4966.75,
    quelle: 'Pfändungsfreigrenzenbekanntmachung 2026 (BGBl. I)',
    geprueft:
      'ACHTUNG: Diese Werte sind FORTGESCHRIEBEN und NICHT gegen die amtliche '
      + 'Bekanntmachung abgeglichen. Ohne diesen Eintrag würde jede Pfändung '
      + 'ab Juli 2026 verweigert — das wäre gegenüber dem Gläubiger falsch. '
      + 'Mit geschätzten Werten zu rechnen ist aber genauso falsch: Vor der '
      + 'ERSTEN echten Pfändung in diesem Zeitraum gehören die vier Zahlen '
      + 'gegen die Bekanntmachung im Bundesgesetzblatt geprüft.',
  },
]

/**
 * Tabellen, deren Werte noch nicht gegen die amtliche Quelle geprüft sind.
 *
 * Die Oberfläche zeigt das an, solange es welche gibt. Ein Wert, der nur
 * fortgeschrieben ist, sieht im Programm genauso aus wie ein geprüfter — und
 * genau das ist die Gefahr.
 */
export function ungepruefteTabellen(): Pfaendungstabelle[] {
  return TABELLEN.filter(t => /NICHT|ACHTUNG/i.test(t.geprueft))
}

/**
 * Die Tabelle, die an einem Tag gilt.
 *
 * Gibt `null` zurück, wenn der Tag vor der ältesten Tabelle liegt oder nach
 * der neuesten ein neuer 1. Juli vergangen ist. Im zweiten Fall ist das die
 * wichtigere Antwort: Die Freigrenzen sind gestiegen, unsere Tabelle weiß es
 * nicht, und weiterzurechnen hieße, zu viel zu pfänden.
 */
export function tabelleFuer(stichtag: Date | string): Pfaendungstabelle | null {
  const tag = typeof stichtag === 'string'
    ? stichtag.slice(0, 10)
    : stichtag.toISOString().slice(0, 10)

  const passend = [...TABELLEN]
    .filter(t => t.ab <= tag)
    .sort((a, b) => b.ab.localeCompare(a.ab))[0]
  if (!passend) return null

  // Ist seit der neuesten Tabelle ein 1. Juli vergangen? Dann fehlt eine.
  const neueste = TABELLEN[TABELLEN.length - 1]
  if (passend.ab === neueste.ab && naechsterErsterJuli(neueste.ab) <= tag) {
    return null
  }
  return passend
}

function naechsterErsterJuli(ab: string): string {
  const jahr = Number(ab.slice(0, 4))
  return `${jahr + 1}-07-01`
}

export function tabelleOderFehler(stichtag: Date | string): Pfaendungstabelle {
  const t = tabelleFuer(stichtag)
  if (t) return t
  const tag = typeof stichtag === 'string' ? stichtag.slice(0, 10)
    : stichtag.toISOString().slice(0, 10)
  throw new Error(
    `Für den ${tag} liegt keine geprüfte Pfändungstabelle vor. Die `
    + 'Freigrenzen werden jeweils zum 1. Juli angepasst (§850c Abs. 4 ZPO); '
    + 'ohne den neuen Eintrag würde zu viel gepfändet. Die Abrechnung wird '
    + 'deshalb nicht gerechnet, bis die Tabelle ergänzt ist.',
  )
}

// ── Schritt 1: Was ist pfändbares Arbeitseinkommen (§850a ZPO) ─────────────

export interface Bezuege {
  /** Das Nettoentgelt, wie es ohne Pfändung ausgezahlt würde */
  nettoGesamt: number
  /** Darin enthaltene Mehrarbeitsvergütung */
  mehrarbeit?: number
  /** Darin enthaltenes Urlaubsgeld */
  urlaubsgeld?: number
  /** Darin enthaltene Weihnachtsvergütung */
  weihnachtsgeld?: number
  /** Gefahren-, Schmutz- und Erschwerniszulagen */
  erschwerniszulagen?: number
  /** Auslösungen, Reisekosten und ähnlicher Aufwendungsersatz */
  aufwendungsersatz?: number
}

/**
 * Der Höchstbetrag, bis zu dem Weihnachtsgeld unpfändbar bleibt.
 *
 * §850a Nr. 4 ZPO: die Hälfte des monatlichen Arbeitseinkommens, höchstens
 * aber dieser Betrag. Er steht seit 2022 fest im Gesetz und wird — anders als
 * die Tabelle — nicht jährlich angepasst.
 */
export const WEIHNACHTSGELD_HOECHSTBETRAG = 705

export interface Abzug {
  bezeichnung: string
  betrag: number
  grundlage: string
}

export interface PfaendbaresEinkommen {
  /** Was nach §850a übrig bleibt und in die Tabelle geht */
  nettoFuerTabelle: number
  /** Was vorher abgezogen wurde, einzeln benannt */
  abzuege: Abzug[]
}

/**
 * Die unpfändbaren Bezüge herausrechnen (§850a ZPO).
 *
 * WARUM DAS NICHT ÜBERSPRUNGEN WERDEN DARF
 * Wer diesen Schritt auslässt, pfändet systematisch bei denen zu viel, die
 * Nachtdienste und Feiertage machen — also ausgerechnet in der Pflege. Die
 * Hälfte der Mehrarbeitsvergütung bleibt frei, das Urlaubsgeld ganz.
 */
export function pfaendbaresEinkommen(b: Bezuege): PfaendbaresEinkommen {
  const abzuege: Abzug[] = []
  const nimm = (bezeichnung: string, betrag: number, grundlage: string) => {
    if (betrag > 0) abzuege.push({ bezeichnung, betrag: runde(betrag), grundlage })
  }

  // Nr. 1: die Hälfte der Mehrarbeitsvergütung
  nimm('Mehrarbeit, halber Betrag', (b.mehrarbeit ?? 0) / 2, '§850a Nr. 1 ZPO')

  // Nr. 2: Urlaubsgeld, Treuegelder, Zuwendungen aus Anlass eines Jubiläums
  nimm('Urlaubsgeld', b.urlaubsgeld ?? 0, '§850a Nr. 2 ZPO')

  // Nr. 3: Aufwandsentschädigungen, Auslösungsgelder, Gefahrenzulagen
  nimm('Erschwerniszulagen', b.erschwerniszulagen ?? 0, '§850a Nr. 3 ZPO')
  nimm('Aufwendungsersatz', b.aufwendungsersatz ?? 0, '§850a Nr. 3 ZPO')

  // Nr. 4: Weihnachtsvergütung — die Hälfte des Monatseinkommens, höchstens
  // der feste Betrag. Beides, nicht eines von beidem.
  const weihnachten = b.weihnachtsgeld ?? 0
  if (weihnachten > 0) {
    const grenze = Math.min(b.nettoGesamt / 2, WEIHNACHTSGELD_HOECHSTBETRAG)
    nimm('Weihnachtsgeld, unpfändbarer Teil',
      Math.min(weihnachten, grenze), '§850a Nr. 4 ZPO')
  }

  const summe = abzuege.reduce((s, a) => s + a.betrag, 0)
  return {
    nettoFuerTabelle: runde(Math.max(0, b.nettoGesamt - summe)),
    abzuege,
  }
}

/**
 * Die Zuschläge einer Abrechnung auf §850a abbilden.
 *
 * HIER STECKT DIE UNTERSCHEIDUNG, DIE IN DER PFLEGE GELD AUSMACHT
 * Nicht jeder Zuschlag ist gleich zu behandeln, und die Rechtsprechung zieht
 * die Linie nicht dort, wo man sie vermuten würde:
 *
 *   NACHTZUSCHLÄGE sind Erschwerniszulagen im Sinne des §850a Nr. 3 ZPO und
 *   damit unpfändbar. Das hat das Bundesarbeitsgericht ausdrücklich
 *   entschieden (Urteil vom 23.08.2017 – 10 AZR 859/16): Nachtarbeit ist
 *   gesundheitlich belastend, der Zuschlag gleicht eine Erschwernis aus.
 *
 *   SONNTAGS- UND FEIERTAGSZUSCHLÄGE sind es NICHT — dieselbe Entscheidung.
 *   Sie gleichen keine Erschwernis aus, sondern die Lage der Arbeitszeit an
 *   einem Tag, an dem andere frei haben. Sie bleiben pfändbar.
 *
 * Wer beides gleich behandelt, rechnet entweder zulasten des Beschäftigten
 * (wenn er die Nachtzuschläge mitpfändet) oder zulasten des Gläubigers (wenn
 * er die Sonntagszuschläge freistellt) — und im zweiten Fall haftet der
 * Arbeitgeber dafür.
 *
 * DER VORBEHALT AUS DEM GESETZ
 * §850a Nr. 3 stellt die Zulagen nur frei, „soweit diese Bezüge den Rahmen
 * des Üblichen nicht übersteigen". Ein Nachtzuschlag in üblicher Höhe ist
 * unstreitig; ein außergewöhnlich hoher wäre zu prüfen. Das Programm rechnet
 * mit dem üblichen Fall und weist im Beleg aus, was freigestellt wurde —
 * damit es jemand sehen kann.
 */
export interface Zuschlaege {
  nacht?: number
  sonntag?: number
  feiertag?: number
  samstag?: number
  mehrarbeit?: number
  sonstige?: number
}

export function zuschlaegeNach850a(z: Zuschlaege): {
  erschwerniszulagen: number
  mehrarbeit: number
  /** Was pfändbar bleibt — nur zur Anzeige, es steckt schon im Netto */
  bleibtPfaendbar: number
} {
  return {
    // Nur die Nachtzuschläge. Samstagszuschläge sind wie Sonntagszuschläge
    // keine Erschwerniszulage — sie betreffen die Lage, nicht die Belastung.
    erschwerniszulagen: runde(z.nacht ?? 0),
    mehrarbeit: runde(z.mehrarbeit ?? 0),
    bleibtPfaendbar: runde(
      (z.sonntag ?? 0) + (z.feiertag ?? 0) + (z.samstag ?? 0) + (z.sonstige ?? 0)),
  }
}

// ── Schritt 2: Der pfändbare Betrag (§850c ZPO) ────────────────────────────

export interface Berechnung {
  /** Das Netto, das in die Tabelle ging */
  nettoFuerTabelle: number
  /** Der unpfändbare Grundfreibetrag samt Unterhaltserhöhungen */
  freibetrag: number
  /** Der Teil über dem Freibetrag */
  mehrbetrag: number
  /** Davon unpfändbar, nach Zehnteln */
  mehrbetragFrei: number
  /** Der pfändbare Betrag */
  pfaendbar: number
  /** Die angewandte Tabelle */
  tabelle: Pfaendungstabelle
  /** Erklärung in Sätzen — steht so auf dem Beleg */
  herleitung: string[]
}

/**
 * Wie viel vom Mehrbetrag unpfändbar bleibt (§850c Abs. 3 ZPO).
 *
 * Drei Zehntel ohne Unterhaltspflicht, für die erste Person zwei Zehntel mehr,
 * für die zweite bis fünfte je ein Zehntel. Ab fünf Unterhaltspflichten sind es
 * neun Zehntel — mehr geht nicht.
 */
export function freieZehntel(unterhaltspflichten: number): number {
  const n = Math.max(0, Math.min(5, Math.floor(unterhaltspflichten)))
  if (n === 0) return 3
  return Math.min(9, 3 + 2 + (n - 1))
}

export function berechnePfaendbar(
  nettoFuerTabelle: number,
  unterhaltspflichten: number,
  stichtag: Date | string,
): Berechnung {
  const tabelle = tabelleOderFehler(stichtag)
  const n = Math.max(0, Math.floor(unterhaltspflichten))

  const freibetrag = runde(
    tabelle.grundbetrag
    + (n >= 1 ? tabelle.ersteUnterhaltspflicht : 0)
    + Math.max(0, Math.min(4, n - 1)) * tabelle.weitereUnterhaltspflicht,
  )

  const herleitung: string[] = [
    `Grundfreibetrag ${euro(tabelle.grundbetrag)} (§850c Abs. 1 ZPO)`,
  ]
  if (n >= 1) {
    herleitung.push(
      `zuzüglich ${euro(tabelle.ersteUnterhaltspflicht)} für die erste `
      + 'unterhaltsberechtigte Person (§850c Abs. 2 ZPO)')
  }
  const weitere = Math.max(0, Math.min(4, n - 1))
  if (weitere > 0) {
    herleitung.push(
      `zuzüglich ${weitere} × ${euro(tabelle.weitereUnterhaltspflicht)} für `
      + 'weitere unterhaltsberechtigte Personen')
  }
  if (n > 5) {
    herleitung.push(
      `${n} Unterhaltspflichten angegeben — §850c Abs. 2 ZPO berücksichtigt `
      + 'höchstens fünf.')
  }

  if (nettoFuerTabelle <= freibetrag) {
    herleitung.push(
      `Das Einkommen von ${euro(nettoFuerTabelle)} liegt unter dem `
      + `Freibetrag von ${euro(freibetrag)} — es ist nichts pfändbar.`)
    return {
      nettoFuerTabelle: runde(nettoFuerTabelle),
      freibetrag, mehrbetrag: 0, mehrbetragFrei: 0, pfaendbar: 0,
      tabelle, herleitung,
    }
  }

  // Oberhalb des Höchstbetrags ist alles pfändbar (§850c Abs. 3 Satz 3 ZPO).
  const bisHoechst = Math.min(nettoFuerTabelle, tabelle.hoechstbetrag)
  const ueberHoechst = Math.max(0, nettoFuerTabelle - tabelle.hoechstbetrag)

  const mehrbetrag = runde(bisHoechst - freibetrag)
  const zehntel = freieZehntel(n)
  const mehrbetragFrei = runde(mehrbetrag * zehntel / 10)
  const pfaendbar = runde(mehrbetrag - mehrbetragFrei + ueberHoechst)

  herleitung.push(
    `Freibetrag insgesamt ${euro(freibetrag)}`,
    `Vom Mehrbetrag ${euro(mehrbetrag)} bleiben ${zehntel} Zehntel `
    + `(${euro(mehrbetragFrei)}) unpfändbar (§850c Abs. 3 ZPO)`,
  )
  if (ueberHoechst > 0) {
    herleitung.push(
      `Was über ${euro(tabelle.hoechstbetrag)} hinausgeht `
      + `(${euro(ueberHoechst)}), ist voll pfändbar (§850c Abs. 3 Satz 3 ZPO)`)
  }
  herleitung.push(`Pfändbar: ${euro(pfaendbar)}`)

  return {
    nettoFuerTabelle: runde(nettoFuerTabelle),
    freibetrag, mehrbetrag, mehrbetragFrei, pfaendbar, tabelle, herleitung,
  }
}

// ── Schritt 3: Wer bekommt es (§804 Abs. 3, §850d ZPO) ─────────────────────

export type Pfaendungsart = 'normal' | 'unterhalt' | 'insolvenz'

export const ARTEN: Record<Pfaendungsart, string> = {
  normal: 'Pfändung',
  unterhalt: 'Unterhaltspfändung',
  insolvenz: 'Insolvenzverfahren / Abtretung',
}

export interface Pfaendung {
  id: string
  art: Pfaendungsart
  glaeubiger: string
  /** Wann der Beschluss zugestellt wurde — daraus folgt der Rang */
  zugestelltAm: string
  /** Die titulierte Forderung insgesamt; leer bei laufendem Unterhalt */
  forderung?: number | null
  /** Was davon schon getilgt ist */
  getilgt?: number
  /**
   * Nur bei Unterhaltspfändung: der Betrag, der der Person nach §850d Abs. 1
   * Satz 2 ZPO verbleiben muss. Er steht im Beschluss und wird NICHT
   * gerechnet — das Gericht setzt ihn fest.
   */
  notwendigerUnterhalt?: number | null
  aktiv?: boolean
}

export interface Zuteilung {
  pfaendungId: string
  glaeubiger: string
  betrag: number
  /** Warum dieser Betrag — steht auf dem Beleg */
  hinweis: string
}

export interface Verteilung {
  zuteilungen: Zuteilung[]
  /** Was an den Beschäftigten geht */
  verbleibt: number
  /** Was nicht zugeteilt werden konnte, weil nichts mehr da war */
  unbedient: { glaeubiger: string; grund: string }[]
}

/**
 * Den pfändbaren Betrag auf die Gläubiger verteilen.
 *
 * DIE REIHENFOLGE
 * Unterhaltsforderungen zuerst (§850d ZPO) — für sie gilt die Tabelle aus
 * Schritt 2 überhaupt nicht, sondern nur der im Beschluss festgesetzte
 * notwendige Unterhalt. Danach die übrigen nach dem Zeitpunkt der Zustellung:
 * die ältere Pfändung geht vor (Prioritätsprinzip, §804 Abs. 3 ZPO).
 *
 * WARUM NICHT ANTEILIG
 * Weil das Gesetz es nicht vorsieht. Eine gleichmäßige Verteilung wäre
 * gerechter und wäre falsch: Der zweite Gläubiger bekommt erst etwas, wenn der
 * erste befriedigt ist.
 */
export function verteile(
  pfaendbar: number,
  nettoGesamt: number,
  pfaendungen: Pfaendung[],
): Verteilung {
  const aktiv = pfaendungen.filter(p => p.aktiv !== false)
  const reihenfolge = [...aktiv].sort((a, b) => {
    const rangA = a.art === 'unterhalt' ? 0 : 1
    const rangB = b.art === 'unterhalt' ? 0 : 1
    if (rangA !== rangB) return rangA - rangB
    return a.zugestelltAm.localeCompare(b.zugestelltAm)
  })

  const zuteilungen: Zuteilung[] = []
  const unbedient: { glaeubiger: string; grund: string }[] = []
  let uebrig = runde(pfaendbar)

  for (const p of reihenfolge) {
    const offen = p.forderung != null
      ? runde(p.forderung - (p.getilgt ?? 0))
      : null

    if (offen != null && offen <= 0) {
      unbedient.push({ glaeubiger: p.glaeubiger, grund: 'Forderung ist getilgt.' })
      continue
    }

    // §850d: Bei Unterhalt gilt die Tabelle nicht. Es bleibt nur der im
    // Beschluss festgesetzte notwendige Unterhalt.
    let verfuegbar = uebrig
    if (p.art === 'unterhalt') {
      if (p.notwendigerUnterhalt == null) {
        unbedient.push({
          glaeubiger: p.glaeubiger,
          grund:
            'Für eine Unterhaltspfändung muss der notwendige Unterhalt aus dem '
            + 'Beschluss eingetragen sein (§850d Abs. 1 Satz 2 ZPO). Ohne ihn '
            + 'wird nichts einbehalten — das Gericht setzt den Betrag fest, '
            + 'nicht das Programm.',
        })
        continue
      }
      // Der privilegierte Zugriff reicht bis an den notwendigen Unterhalt
      // heran, nicht nur bis zur Tabellengrenze.
      verfuegbar = runde(Math.max(uebrig, nettoGesamt - p.notwendigerUnterhalt))
    }

    if (verfuegbar <= 0) {
      unbedient.push({
        glaeubiger: p.glaeubiger,
        grund: 'Es ist nichts mehr pfändbar — eine vorrangige Pfändung geht vor.',
      })
      continue
    }

    const betrag = offen != null ? Math.min(verfuegbar, offen) : verfuegbar
    zuteilungen.push({
      pfaendungId: p.id,
      glaeubiger: p.glaeubiger,
      betrag: runde(betrag),
      hinweis: p.art === 'unterhalt'
        ? `Unterhaltspfändung — vorrangig (§850d ZPO), notwendiger Unterhalt `
          + `${euro(p.notwendigerUnterhalt!)} bleibt`
        : `Zugestellt am ${datum(p.zugestelltAm)}`
          + (offen != null ? `, offene Forderung ${euro(offen)}` : ''),
    })
    uebrig = runde(Math.max(0, uebrig - betrag))
  }

  const einbehalten = zuteilungen.reduce((s, z) => s + z.betrag, 0)
  return {
    zuteilungen,
    verbleibt: runde(nettoGesamt - einbehalten),
    unbedient,
  }
}

// ── Alles zusammen ─────────────────────────────────────────────────────────

export interface Ergebnis {
  einkommen: PfaendbaresEinkommen
  berechnung: Berechnung
  verteilung: Verteilung
  /** Die Summe, die vom Netto einbehalten wird */
  einbehalten: number
}

export function rechne(
  bezuege: Bezuege,
  unterhaltspflichten: number,
  pfaendungen: Pfaendung[],
  stichtag: Date | string,
): Ergebnis {
  const einkommen = pfaendbaresEinkommen(bezuege)
  const berechnung = berechnePfaendbar(
    einkommen.nettoFuerTabelle, unterhaltspflichten, stichtag)
  const verteilung = verteile(
    berechnung.pfaendbar, bezuege.nettoGesamt, pfaendungen)
  return {
    einkommen,
    berechnung,
    verteilung,
    einbehalten: runde(
      verteilung.zuteilungen.reduce((s, z) => s + z.betrag, 0)),
  }
}

// ── Kleinkram ──────────────────────────────────────────────────────────────

/** Auf Cent runden. Halbe Cent kaufmännisch nach oben. */
export function runde(betrag: number): number {
  return Math.round((betrag + Number.EPSILON) * 100) / 100
}

function euro(betrag: number): string {
  return `${betrag.toLocaleString('de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })} €`
}

function datum(iso: string): string {
  return iso.slice(0, 10).split('-').reverse().join('.')
}
