/**
 * German payroll calculation engine.
 *
 * Rates are for 2025/2026. Constants marked UPDATE_ANNUALLY must be refreshed
 * each calendar year from official BMF/BMAS publications.
 *
 * Covers standard employment (unbefristete AN-Verhältnisse, Steuerklassen 1-6,
 * GKV or PKV, optionally Kirchensteuer).
 * Edge cases requiring a Steuerberater: Minijob/Midijob (<538 €/556 € threshold),
 * Kurzarbeitergeld, Sachsen PV employer split asymmetry, multiple employers.
 */

// ── UPDATE_ANNUALLY ──────────────────────────────────────────────────────────

// Der Grundfreibetrag (2025: 12.096 €) steckt in der Formel von annualIncomeTax
// und wird deshalb nirgends gesondert abgezogen.
const WERBUNGSKOSTEN_PAUSCH = 1230         // §9a EStG 2025
const SONDERAUSGABEN_PAUSCH = 36           // §10c EStG
const ENTLASTUNGSBETRAG_ALLEIN = 4260      // §24b EStG 2025 (Steuerklasse 2)

const RV_RATE = 0.186                      // Rentenversicherung 2025 (18.6%)
const AV_RATE = 0.026                      // Arbeitslosenversicherung 2025 (2.6%)
const KV_BASE_RATE = 0.146                 // Krankenversicherung Basissatz 2025
const KV_ZUSATZ_RATE = 0.017              // Durchschnittlicher Zusatzbeitrag 2025
const KV_TOTAL_RATE = KV_BASE_RATE + KV_ZUSATZ_RATE
const PV_RATE = 0.036                      // Pflegeversicherung 2025 (3.6%)
const PV_CHILDLESS_SURCHARGE = 0.006       // Zuschlag Kinderlosigkeit (>23 Jahre)

const BBG_RV_MONTHLY = 8050               // Beitragsbemessungsgrenze RV/AV 2025 (West)
const BBG_KV_MONTHLY = 5512.5             // Beitragsbemessungsgrenze KV/PV 2025

const SOLI_FREIGRENZE_ANNUAL = 19950      // Soli exempt below this annual Lohnsteuer
const SOLI_RATE = 0.055

// §39b Abs.2 Satz 5 Nr.3 Buchst. d: Mindestvorsorgepauschale
const MINDESTVORSORGE_ANTEIL = 0.12
const MINDESTVORSORGE_HOECHST = 1900       // Steuerklassen I, II, IV, V, VI
const MINDESTVORSORGE_HOECHST_KL3 = 3000   // Steuerklasse III

const RV_AN_RATE = RV_RATE / 2             // Teilbetrag RV der Vorsorgepauschale
const KV_ERMAESSIGT_AN = 0.07              // halber ermäßigter Beitragssatz (14,0 %)

// §32 Abs.6 EStG: Kinderfreibetrag + BEA-Freibetrag je Kind, beide Elternteile
const KINDERFREIBETRAG_VOLL = 9600

// Kirchensteuer: 8 % in Bayern und Baden-Württemberg, sonst 9 %.
// Die Feiertagslogik nutzt ausgeschriebene Ländernamen — beide Schreibweisen
// werden erkannt, damit nicht am Datenformat ein falscher Satz herauskommt.
const KIRCHENSTEUER_ACHT_PROZENT = ['BY', 'Bayern', 'BW', 'Baden-Württemberg', 'Baden-Wuerttemberg']
function kirchensteuerRate(bl?: string): number {
  return KIRCHENSTEUER_ACHT_PROZENT.includes(bl ?? '') ? 0.08 : 0.09
}

// ── Lohnsteuer (§32a EStG 2025, Grundfreibetrag 12.096 €) ───────────────────
//
// Die Formel enthält den Grundfreibetrag bereits — er darf davor NICHT noch
// einmal abgezogen werden.
function annualIncomeTax(zvE: number): number {
  if (zvE <= 0) return 0
  const z = Math.floor(zvE)
  if (z <= 12096) return 0
  if (z <= 17443) {
    const y = (z - 12096) / 10000
    return Math.floor((932.30 * y + 1400) * y)
  }
  if (z <= 68480) {
    const y = (z - 17443) / 10000
    return Math.floor((176.64 * y + 2397) * y + 1015.13)
  }
  if (z <= 277825) return Math.floor(0.42 * z - 10911.92)
  return Math.floor(0.45 * z - 19246.67)
}

/**
 * Jahreslohnsteuer nach Steuerklasse.
 *
 * Klasse III rechnet nach dem Splittingverfahren (§32a Abs.5) — nicht mit einem
 * verdoppelten Grundfreibetrag, das ergibt einen anderen Betrag.
 * Klassen V und VI folgen §39b Abs.2 Satz 7: doppelter Unterschiedsbetrag
 * zwischen dem 1,25fachen und dem 0,75fachen des zu versteuernden Betrags,
 * mindestens 14 % davon.
 */
function jahresLohnsteuer(zvE: number, taxClass: number): number {
  const z = Math.max(0, Math.floor(zvE))
  if (z === 0) return 0
  if (taxClass === 3) return 2 * annualIncomeTax(z / 2)
  if (taxClass === 5 || taxClass === 6) {
    const unterschied = 2 * (annualIncomeTax(1.25 * z) - annualIncomeTax(0.75 * z))
    return Math.max(unterschied, Math.floor(0.14 * z))
  }
  return annualIncomeTax(z)
}

/**
 * Vorsorgepauschale (§39b Abs.2 Satz 5 Nr.3 EStG).
 *
 * Beim Lohnsteuerabzug sind nicht die tatsächlichen Sozialabgaben abziehbar,
 * sondern diese Pauschale. Wer stattdessen die vollen AN-Beiträge abzieht,
 * kommt auf eine deutlich zu niedrige Lohnsteuer.
 */
function vorsorgepauschale(
  input: PayrollInput,
  jahresSteuerBrutto: number,
  jahresSvBrutto: number,
): number {
  const rvBemessung = Math.min(jahresSvBrutto, BBG_RV_MONTHLY * 12)
  const teilbetragRv = rvBemessung * RV_AN_RATE

  const kvBemessung = Math.min(jahresSvBrutto, BBG_KV_MONTHLY * 12)
  const zusatz = (input.zusatzbeitragPercent ?? KV_ZUSATZ_RATE * 100) / 100
  const pvAnSatz = PV_RATE / 2 + (input.childCount === 0 ? PV_CHILDLESS_SURCHARGE : 0)

  let teilbetragKvPv: number
  if (input.insuranceType === 'GKV') {
    teilbetragKvPv = kvBemessung * (KV_ERMAESSIGT_AN + zusatz / 2) + kvBemessung * pvAnSatz
  } else {
    // Bei privater Versicherung zählt der Basisbeitrag abzüglich AG-Zuschuss
    const agZuschuss = kvBemessung * (KV_TOTAL_RATE / 2)
    teilbetragKvPv = Math.max(0, (input.pkvMonthly ?? 0) * 12 - agZuschuss)
  }

  const hoechst = input.taxClass === 3 ? MINDESTVORSORGE_HOECHST_KL3 : MINDESTVORSORGE_HOECHST
  const mindest = Math.min(jahresSteuerBrutto * MINDESTVORSORGE_ANTEIL, hoechst)

  return teilbetragRv + Math.max(teilbetragKvPv, mindest)
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
  taxClass: 1 | 2 | 3 | 4 | 5 | 6
  childCount: number        // Including half-children (0.5, 1, 1.5, ...)
  insuranceType: 'GKV' | 'PKV'
  pkvMonthly?: number       // Employee's PKV premium (for PKV workers)
  zusatzbeitragPercent?: number  // Zusatzbeitrag der Krankenkasse in Prozentpunkten
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
  warnings: string[]
}

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const warnings: string[] = []

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

  // ─ 2. Social security ─────────────────────────────────────────────────────
  // Bemessungsgrundlage ist das SV-Brutto: beitragsfreie Zuschläge zählen nicht.
  // Rentenversicherung
  const rvBase = Math.min(svBrutto, BBG_RV_MONTHLY)
  const rvAN = rvBase * (RV_RATE / 2)
  const rvAG = rvBase * (RV_RATE / 2)

  // Arbeitslosenversicherung
  const avBase = Math.min(svBrutto, BBG_RV_MONTHLY)
  const avAN = avBase * (AV_RATE / 2)
  const avAG = avBase * (AV_RATE / 2)

  // Krankenversicherung — der Zusatzbeitrag der jeweiligen Kasse zählt, nicht
  // der Durchschnitt; der ist nur die Rückfallebene, wenn er nicht hinterlegt ist.
  const kvSatz = KV_BASE_RATE + (input.zusatzbeitragPercent ?? KV_ZUSATZ_RATE * 100) / 100
  let kvAN = 0
  let kvAG = 0
  if (input.insuranceType === 'GKV') {
    const kvBase = Math.min(svBrutto, BBG_KV_MONTHLY)
    kvAN = kvBase * (kvSatz / 2)
    kvAG = kvBase * (kvSatz / 2)
  } else {
    // PKV: AG pays up to half of GKV equivalent, employee pays remainder of PKV premium
    const kvBase = Math.min(svBrutto, BBG_KV_MONTHLY)
    kvAG = kvBase * (KV_TOTAL_RATE / 2)
    const pkv = input.pkvMonthly ?? 0
    kvAN = Math.max(0, pkv - kvAG) // employee pays PKV - AG subsidy
  }

  // Pflegeversicherung
  const pvBase = Math.min(svBrutto, BBG_KV_MONTHLY)
  const pvChildlessSurcharge = input.childCount === 0 ? PV_CHILDLESS_SURCHARGE : 0
  const pvAN = pvBase * (PV_RATE / 2 + pvChildlessSurcharge)
  const pvAG = pvBase * (PV_RATE / 2)

  const svTotal = rvAN + kvAN + pvAN + avAN

  // ─ 3. Lohnsteuer ──────────────────────────────────────────────────────────
  // Hochrechnung auf das Jahr (§39b Abs.2 EStG), dann zurück auf den Monat.
  // Grundlage ist das Steuerbrutto — steuerfreie Zuschläge bleiben draußen.
  const jahresBrutto = steuerBrutto * 12

  // Steuerklasse VI kennt keine Freibeträge (zweites Arbeitsverhältnis).
  let taxableAnnual: number
  if (input.taxClass === 6) {
    taxableAnnual = jahresBrutto
    warnings.push('Steuerklasse 6: volle Besteuerung ohne Freibeträge.')
  } else {
    taxableAnnual = jahresBrutto
      - WERBUNGSKOSTEN_PAUSCH
      - SONDERAUSGABEN_PAUSCH
      - vorsorgepauschale(input, jahresBrutto, svBrutto * 12)
    if (input.taxClass === 2) taxableAnnual -= ENTLASTUNGSBETRAG_ALLEIN
  }

  // Der Grundfreibetrag steckt in §32a — er wird hier NICHT zusätzlich abgezogen,
  // und Klasse III rechnet über das Splittingverfahren.
  const zvE = Math.max(0, taxableAnnual)
  const annualTax = jahresLohnsteuer(zvE, input.taxClass)
  const lohnsteuerMonthly = Math.round(annualTax / 12 * 100) / 100

  // §51a EStG: Für Soli und Kirchensteuer zählt die Steuer MIT Kinderfreibetrag.
  // Beim Lohnsteuerabzug selbst wirkt der Kinderfreibetrag nicht — dort ist das
  // Kindergeld die Entlastung. Beides zu verrechnen wäre doppelt.
  const kinderfreibetrag = input.childCount > 0
    ? input.childCount * (input.taxClass === 3 ? KINDERFREIBETRAG_VOLL : KINDERFREIBETRAG_VOLL / 2)
    : 0
  const annualTax51a = kinderfreibetrag > 0
    ? jahresLohnsteuer(Math.max(0, zvE - kinderfreibetrag), input.taxClass)
    : annualTax

  // Solidaritätszuschlag — die Freigrenze verdoppelt sich in Steuerklasse III
  const soliFreigrenze = input.taxClass === 3 ? SOLI_FREIGRENZE_ANNUAL * 2 : SOLI_FREIGRENZE_ANNUAL
  let soliAnnual = 0
  if (annualTax51a > soliFreigrenze) {
    // Milderungszone: der Zuschlag wächst mit 11,9 % des übersteigenden Betrags
    // an, bis er 5,5 % erreicht (§4 SolzG).
    soliAnnual = Math.min((annualTax51a - soliFreigrenze) * 0.119, annualTax51a * SOLI_RATE)
  }
  const soliMonthly = Math.round(soliAnnual / 12 * 100) / 100

  // Kirchensteuer
  let kirchensteuerMonthly = 0
  if (input.churchTax) {
    kirchensteuerMonthly =
      Math.round(annualTax51a / 12 * kirchensteuerRate(input.bundesland) * 100) / 100
  }

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
