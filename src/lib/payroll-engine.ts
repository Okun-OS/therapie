/**
 * §116 Lohnabrechnung: Brutto, Sozialabgaben, Netto.
 *
 * Die Lohnsteuer rechnet dieses Modul NICHT selbst — dafür ist der amtliche
 * Programmablaufplan des BMF zuständig (`lohnsteuer-pap.ts`). Der Versuch, sie
 * nachzubauen, hat uns fünf Fehler eingebracht, die einer Zahl nicht anzusehen
 * waren. Hier bleibt: Brutto und Zuschläge, die Steuerfreiheit nach §3b EStG,
 * die Sozialversicherungsbeiträge und daraus das Netto.
 *
 * Alle Jahreswerte kommen aus `lohnjahre.ts` — dieselbe Quelle wie die Steuer,
 * damit beide Seiten nicht auseinanderlaufen. Für ein Jahr ohne geprüfte Werte
 * wird nicht gerechnet, sondern abgebrochen.
 *
 * Deckt das übliche Arbeitsverhältnis ab (Steuerklassen 1–6, GKV oder PKV,
 * Kirchensteuer, Sachsen, Kinderabschläge in der Pflegeversicherung).
 * Braucht weiterhin einen Steuerberater: Minijob und Midijob (Übergangsbereich),
 * Kurzarbeitergeld, mehrere Arbeitgeber, sonstige Bezüge.
 */

import { lohnjahrOderFehler, type Lohnjahr } from './lohnjahre'
import { lohnsteuerBerechnen, istSachsen, pflegeMerkmale } from './lohnsteuer-pap'

// Kirchensteuer: 8 % in Bayern und Baden-Württemberg, sonst 9 %.
// Die Feiertagslogik nutzt ausgeschriebene Ländernamen — beide Schreibweisen
// werden erkannt, damit nicht am Datenformat ein falscher Satz herauskommt.
const KIRCHENSTEUER_ACHT_PROZENT = ['BY', 'Bayern', 'BW', 'Baden-Württemberg', 'Baden-Wuerttemberg']
function kirchensteuerRate(bl?: string): number {
  return KIRCHENSTEUER_ACHT_PROZENT.includes(bl ?? '') ? 0.08 : 0.09
}

// ── Steuerfreie Zuschläge (§3b EStG, §1 SvEV) ───────────────────────────────

// Höchstsätze, bis zu denen ein Zuschlag steuerfrei bleibt
const FREI_NACHT = 0.25       // Nachtarbeit 20:00–06:00 Uhr
const FREI_SONNTAG = 0.50     // Sonntagsarbeit
const FREI_FEIERTAG = 1.25    // Feiertagsarbeit
// Samstagszuschläge sind NICHT steuerfrei — dafür gibt es keine Vorschrift.

const GRUNDLOHN_GRENZE_STEUER = 50   // §3b Abs.2 Satz 1 EStG
const GRUNDLOHN_GRENZE_SV = 25       // §1 Abs.1 Satz 1 Nr.1 SvEV

/**
 * Der steuer- und beitragsfreie Teil der Zuschläge.
 *
 * Steuerfrei ist immer nur der tatsächlich gezahlte Zuschlag, höchstens aber der
 * gesetzliche Prozentsatz des Grundlohns. Wer mehr zahlt, zahlt den Rest
 * versteuert — und wer über 25 €/h Grundlohn liegt, zahlt ab dort Beiträge,
 * obwohl es steuerfrei bleibt. Beide Grenzen greifen unabhängig voneinander.
 */
function steuerfreieZuschlaege(
  input: PayrollInput,
  regularPay: number,
): { steuerfrei: number; svfrei: number; hinweis?: string } {
  const stunden = input.regularHours + input.overtimeHours
  const grundlohn = input.grundlohnHourly
    ?? input.hourlyWage
    ?? (stunden > 0 ? regularPay / stunden : 0)

  if (grundlohn <= 0) {
    const gezahlt = (input.nightSurcharge ?? 0) + (input.sundaySurcharge ?? 0) + (input.holidaySurcharge ?? 0)
    return {
      steuerfrei: 0, svfrei: 0,
      hinweis: gezahlt > 0
        ? 'Ohne Grundlohn je Stunde lässt sich die Steuerfreiheit der Zuschläge (§3b EStG) '
          + 'nicht bestimmen — sie werden vorsichtshalber voll versteuert.'
        : undefined,
    }
  }

  const posten: [number, number, number][] = [
    // [gezahlter Zuschlag, Stunden, Höchstsatz]
    [input.nightSurcharge ?? 0, input.nightHours, FREI_NACHT],
    [input.sundaySurcharge ?? 0, input.sundayHours, FREI_SONNTAG],
    [input.holidaySurcharge ?? 0, input.holidayHours, FREI_FEIERTAG],
  ]

  let steuerfrei = 0
  let svfrei = 0
  for (const [gezahlt, stundenzahl, satz] of posten) {
    if (gezahlt <= 0 || stundenzahl <= 0) continue
    steuerfrei += Math.min(gezahlt, Math.min(grundlohn, GRUNDLOHN_GRENZE_STEUER) * stundenzahl * satz)
    svfrei += Math.min(gezahlt, Math.min(grundlohn, GRUNDLOHN_GRENZE_SV) * stundenzahl * satz)
  }

  return { steuerfrei: round2(steuerfrei), svfrei: round2(svfrei) }
}

// ── Main calculation ─────────────────────────────────────────────────────────

export interface PayrollInput {
  // Labour
  hourlyWage?: number       // If set, brutto = hourlyWage * totalHours
  monthlyWage?: number      // Fixed monthly salary (overrides hourlyWage)
  regularHours: number
  overtimeHours: number
  nightHours: number        // Overlap hours (counted in regular/overtime already)
  sundayHours: number
  holidayHours: number
  saturdayHours: number
  vacationDays: number
  sickDays: number
  // Surcharges from surcharge-engine (pre-calculated €)
  nightSurcharge?: number
  sundaySurcharge?: number
  holidaySurcharge?: number
  saturdaySurcharge?: number
  overtimeSurcharge?: number
  otherSurcharge?: number   // Zuschläge aus eigenen Regeln des Kunden
  // Tax/insurance
  /** Abrechnungsjahr — bestimmt Rechengrößen und Steuerformel. Pflicht. */
  jahr: number
  taxClass: 1 | 2 | 3 | 4 | 5 | 6
  childCount: number        // Zahl der Kinderfreibeträge laut ELStAM (0, 0.5, 1, …)
  /** Hat der Arbeitnehmer Kinder? Entscheidet über den Zuschlag zur Pflegeversicherung. */
  hasChildren?: boolean
  /** Kinder unter 25 — ab dem zweiten mindert jedes den Pflegebeitrag. */
  childrenUnder25?: number
  insuranceType: 'GKV' | 'PKV'
  pkvMonthly?: number       // Beitrag zur privaten Basisversicherung, Monat
  pkvEmployerSubsidy?: number  // Arbeitgeberzuschuss dazu, Monat
  zusatzbeitragPercent?: number  // Zusatzbeitrag der Krankenkasse in Prozentpunkten
  /** Nicht rentenversicherungspflichtig (z. B. berufsständisches Versorgungswerk) */
  rvExempt?: boolean
  /** Freibetrag und Hinzurechnungsbetrag laut ELStAM, Monatsbetrag */
  freibetragMonat?: number
  hinzurechnungMonat?: number
  /** Faktor laut ELStAM — nur Steuerklasse IV */
  faktor?: number
  grundlohnHourly?: number  // Grundlohn je Stunde — Maßstab der Steuerfreiheit (§3b EStG)
  churchTax: boolean
  bundesland?: string
}

export interface PayrollResult {
  // Brutto
  brutto: number
  regularPay: number
  overtimePay: number
  surchargesTotal: number   // sum of all surcharges
  // §3b EStG: Zuschläge für Nacht-, Sonntags- und Feiertagsarbeit sind bis zu
  // festen Grenzen steuerfrei — und bis 25 €/h Grundlohn auch beitragsfrei.
  steuerfreieZuschlaege: number
  svfreieZuschlaege: number
  steuerBrutto: number      // Brutto, auf das Lohnsteuer erhoben wird
  svBrutto: number          // Brutto, auf das Sozialabgaben erhoben werden
  // Social security (Arbeitnehmer)
  rvAN: number
  kvAN: number
  pvAN: number
  avAN: number
  svTotal: number
  // Income tax
  lohnsteuerMonthly: number
  kirchensteuerMonthly: number
  soliMonthly: number
  // Totals
  totalDeductions: number
  netto: number
  // Employer contributions (AG-Anteile)
  rvAG: number
  kvAG: number
  pvAG: number
  avAG: number
  totalAgCost: number       // brutto + all AG-Anteile (true labour cost)
  // Meta
  /** Woher die Jahreswerte stammen — steht so auch im Prüfprotokoll. */
  grundlage: string
  warnings: string[]
}

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const warnings: string[] = []
  // Für ein Jahr ohne geprüfte Rechengrößen wird nicht geschätzt — hier bricht es ab.
  const jahr: Lohnjahr = lohnjahrOderFehler(input.jahr)

  // ─ 1. Brutto ──────────────────────────────────────────────────────────────
  const totalHours = input.regularHours + input.overtimeHours
  let regularPay = 0
  if (input.monthlyWage != null) {
    regularPay = input.monthlyWage
  } else if (input.hourlyWage != null) {
    regularPay = input.hourlyWage * totalHours
  } else {
    warnings.push('Kein Stundenlohn oder Monatsgehalt angegeben – Brutto = 0.')
  }

  const surchargesTotal = (input.nightSurcharge ?? 0)
    + (input.sundaySurcharge ?? 0)
    + (input.holidaySurcharge ?? 0)
    + (input.saturdaySurcharge ?? 0)
    + (input.overtimeSurcharge ?? 0)
    + (input.otherSurcharge ?? 0)

  const overtimePay = (input.hourlyWage ?? 0) * input.overtimeHours
  const brutto = regularPay + surchargesTotal

  // §3b EStG: der steuer- und beitragsfreie Anteil der Zuschläge
  const frei = steuerfreieZuschlaege(input, regularPay)
  if (frei.hinweis) warnings.push(frei.hinweis)
  const steuerBrutto = Math.max(0, brutto - frei.steuerfrei)
  const svBrutto = Math.max(0, brutto - frei.svfrei)

  // Minijob warning
  if (brutto > 0 && brutto <= 556) {
    warnings.push('Brutto unter 556 € – Minijob-Regelung prüfen (ggf. andere Beitragssätze).')
  }

  // ─ 2. Sozialversicherung ──────────────────────────────────────────────────
  // Bemessungsgrundlage ist das SV-Brutto: beitragsfreie Zuschläge zählen nicht.
  const rvBase = Math.min(svBrutto, jahr.bbgRvAvMonat)
  const rvAN = input.rvExempt ? 0 : rvBase * (jahr.rvSatz / 2)
  const rvAG = input.rvExempt ? 0 : rvBase * (jahr.rvSatz / 2)

  const avBase = Math.min(svBrutto, jahr.bbgRvAvMonat)
  const avAN = avBase * (jahr.avSatz / 2)
  const avAG = avBase * (jahr.avSatz / 2)

  // Krankenversicherung — der Zusatzbeitrag der jeweiligen Kasse zählt, nicht
  // der Durchschnitt; der ist nur die Rückfallebene, wenn er nicht hinterlegt ist.
  const kvZusatz = (input.zusatzbeitragPercent ?? jahr.kvZusatzSatzDurchschnitt * 100) / 100
  const kvSatz = jahr.kvBasisSatz + kvZusatz
  const kvBase = Math.min(svBrutto, jahr.bbgKvPvMonat)
  let kvAN = 0
  let kvAG = 0
  if (input.insuranceType === 'GKV') {
    kvAN = kvBase * (kvSatz / 2)
    kvAG = kvBase * (kvSatz / 2)
  } else {
    // Privat versichert: der Arbeitgeber zahlt höchstens den halben Satz auf die
    // Bemessungsgrenze, den Rest des Beitrags trägt der Arbeitnehmer selbst.
    const zuschussGrenze = kvBase * (kvSatz / 2)
    kvAG = Math.min(input.pkvEmployerSubsidy ?? zuschussGrenze, zuschussGrenze)
    kvAN = Math.max(0, (input.pkvMonthly ?? 0) - kvAG)
  }

  // Pflegeversicherung — Zuschlag für Kinderlose und Abschlag ab dem 2. Kind
  // nach denselben Merkmalen wie in der Steuer, damit beides zusammenpasst.
  const { pvz, pva } = pflegeMerkmale({
    hatKinder: input.hasChildren,
    kinderUnter25: input.childrenUnder25,
    kinderfreibetraege: input.childCount,
  })
  const sachsen = istSachsen(input.bundesland)
  const pvBase = Math.min(svBrutto, jahr.bbgKvPvMonat)
  let pvAnSatz = sachsen ? jahr.pvSachsenAn : jahr.pvSatz / 2
  const pvAgSatz = sachsen ? jahr.pvSachsenAg : jahr.pvSatz / 2
  if (pvz === 1) pvAnSatz += jahr.pvZuschlagKinderlos
  else pvAnSatz -= pva * jahr.pvAbschlagJeKind
  const pvAN = input.insuranceType === 'GKV' ? pvBase * Math.max(0, pvAnSatz) : 0
  const pvAG = input.insuranceType === 'GKV' ? pvBase * pvAgSatz : 0

  const svTotal = rvAN + kvAN + pvAN + avAN

  // ─ 3. Lohnsteuer nach dem amtlichen Programmablaufplan ────────────────────
  // Grundlage ist das Steuerbrutto — steuerfreie Zuschläge bleiben draußen.
  if (input.taxClass === 6) {
    warnings.push('Steuerklasse 6: volle Besteuerung ohne Freibeträge.')
  }
  const steuer = lohnsteuerBerechnen({
    jahr: input.jahr,
    steuerBruttoMonat: steuerBrutto,
    steuerklasse: input.taxClass,
    kinderfreibetraege: input.childCount,
    zusatzbeitragProzent: input.zusatzbeitragPercent ?? jahr.kvZusatzSatzDurchschnitt * 100,
    versicherung: input.insuranceType,
    pkvBeitragMonat: input.pkvMonthly,
    pkvZuschussMonat: input.insuranceType === 'PKV' ? kvAG : undefined,
    kirchensteuer: input.churchTax,
    bundesland: input.bundesland,
    hatKinder: input.hasChildren,
    kinderUnter25: input.childrenUnder25,
    rentenversicherungspflichtig: !input.rvExempt,
    freibetragMonat: input.freibetragMonat,
    hinzurechnungMonat: input.hinzurechnungMonat,
    faktor: input.faktor,
  })

  const lohnsteuerMonthly = steuer.lohnsteuer
  const soliMonthly = steuer.soli
  // Der Ablaufplan liefert die Bemessungsgrundlage nach §51a EStG, also mit
  // Kinderfreibetrag. Der Landessatz kommt von uns — er steht nicht im Plan.
  const kirchensteuerMonthly = input.churchTax
    ? round2(steuer.kirchensteuerBasis * kirchensteuerRate(input.bundesland))
    : 0

  // ─ 4. Net ─────────────────────────────────────────────────────────────────
  const totalDeductions = svTotal + lohnsteuerMonthly + soliMonthly + kirchensteuerMonthly
  const netto = Math.max(0, brutto - totalDeductions)

  // ─ 5. Employer costs ──────────────────────────────────────────────────────
  const totalAgCost = brutto + rvAG + kvAG + pvAG + avAG

  return {
    brutto: round2(brutto),
    regularPay: round2(regularPay),
    overtimePay: round2(overtimePay),
    surchargesTotal: round2(surchargesTotal),
    grundlage: `${jahr.quelle} · geprüft ${jahr.geprueft}`,
    steuerfreieZuschlaege: frei.steuerfrei,
    svfreieZuschlaege: frei.svfrei,
    steuerBrutto: round2(steuerBrutto),
    svBrutto: round2(svBrutto),
    rvAN: round2(rvAN),
    kvAN: round2(kvAN),
    pvAN: round2(pvAN),
    avAN: round2(avAN),
    svTotal: round2(svTotal),
    lohnsteuerMonthly: round2(lohnsteuerMonthly),
    kirchensteuerMonthly: round2(kirchensteuerMonthly),
    soliMonthly: round2(soliMonthly),
    totalDeductions: round2(totalDeductions),
    netto: round2(netto),
    rvAG: round2(rvAG),
    kvAG: round2(kvAG),
    pvAG: round2(pvAG),
    avAG: round2(avAG),
    totalAgCost: round2(totalAgCost),
    warnings,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── DATEV CSV export ─────────────────────────────────────────────────────────

export interface DATEVRow {
  employeeId: string
  employeeName: string
  year: number
  month: number
  brutto: number
  netto: number
  lohnsteuer: number
  rv: number
  kv: number
  pv: number
  av: number
  totalAgCost: number
}

export function toDATEVCsv(rows: DATEVRow[]): string {
  const header = [
    'Personalnummer', 'Name', 'Jahr', 'Monat',
    'Brutto', 'Netto', 'Lohnsteuer',
    'RV-AN', 'KV-AN', 'PV-AN', 'AV-AN',
    'AG-Gesamtkosten',
  ].join(';')
  const lines = rows.map(r => [
    r.employeeId, r.employeeName, r.year, r.month,
    fmt(r.brutto), fmt(r.netto), fmt(r.lohnsteuer),
    fmt(r.rv), fmt(r.kv), fmt(r.pv), fmt(r.av),
    fmt(r.totalAgCost),
  ].join(';'))
  return [header, ...lines].join('\r\n')
}

function fmt(n: number): string {
  return n.toFixed(2).replace('.', ',')
}
