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

const GRUNDFREIBETRAG = 12096              // §32a EStG 2025 (single)
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

// Kirchensteuer by Bundesland code (8% in BY+BW, 9% elsewhere)
const KIRCHENSTEUER_BY_BL: Record<string, number> = {
  BY: 0.08, BW: 0.08,
}
function kirchensteuerRate(bl?: string): number {
  return KIRCHENSTEUER_BY_BL[bl ?? ''] ?? 0.09
}

// ── Lohnsteuer (§32a EStG 2024/2025 progressive formula) ────────────────────

function annualIncomeTax(zvE: number): number {
  if (zvE <= 0) return 0
  const z = Math.floor(zvE)
  if (z <= 11604) return 0
  if (z <= 17005) {
    const y = (z - 11604) / 10000
    return Math.floor((922.98 * y + 1400) * y)
  }
  if (z <= 66760) {
    const y = (z - 17005) / 10000
    return Math.floor((181.19 * y + 2397) * y + 1025.38)
  }
  if (z <= 277826) return Math.floor(0.42 * z - 10602.13)
  return Math.floor(0.45 * z - 18936.88)
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
  // Tax/insurance
  taxClass: 1 | 2 | 3 | 4 | 5 | 6
  childCount: number        // Including half-children (0.5, 1, 1.5, ...)
  insuranceType: 'GKV' | 'PKV'
  pkvMonthly?: number       // Employee's PKV premium (for PKV workers)
  churchTax: boolean
  bundesland?: string
}

export interface PayrollResult {
  // Brutto
  brutto: number
  regularPay: number
  overtimePay: number
  surchargesTotal: number   // sum of all pre-tax surcharges
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

  const overtimePay = (input.hourlyWage ?? 0) * input.overtimeHours
  const brutto = regularPay + surchargesTotal

  // Minijob warning
  if (brutto > 0 && brutto <= 556) {
    warnings.push('Brutto unter 556 € – Minijob-Regelung prüfen (ggf. andere Beitragssätze).')
  }

  // ─ 2. Social security ─────────────────────────────────────────────────────
  // Rentenversicherung
  const rvBase = Math.min(brutto, BBG_RV_MONTHLY)
  const rvAN = rvBase * (RV_RATE / 2)
  const rvAG = rvBase * (RV_RATE / 2)

  // Arbeitslosenversicherung
  const avBase = Math.min(brutto, BBG_RV_MONTHLY)
  const avAN = avBase * (AV_RATE / 2)
  const avAG = avBase * (AV_RATE / 2)

  // Krankenversicherung
  let kvAN = 0
  let kvAG = 0
  if (input.insuranceType === 'GKV') {
    const kvBase = Math.min(brutto, BBG_KV_MONTHLY)
    kvAN = kvBase * (KV_TOTAL_RATE / 2)
    kvAG = kvBase * (KV_TOTAL_RATE / 2)
  } else {
    // PKV: AG pays up to half of GKV equivalent, employee pays remainder of PKV premium
    const kvBase = Math.min(brutto, BBG_KV_MONTHLY)
    kvAG = kvBase * (KV_TOTAL_RATE / 2)
    const pkv = input.pkvMonthly ?? 0
    kvAN = Math.max(0, pkv - kvAG) // employee pays PKV - AG subsidy
  }

  // Pflegeversicherung
  const pvBase = Math.min(brutto, BBG_KV_MONTHLY)
  const pvChildlessSurcharge = input.childCount === 0 ? PV_CHILDLESS_SURCHARGE : 0
  const pvAN = pvBase * (PV_RATE / 2 + pvChildlessSurcharge)
  const pvAG = pvBase * (PV_RATE / 2)

  const svTotal = rvAN + kvAN + pvAN + avAN

  // ─ 3. Lohnsteuer ──────────────────────────────────────────────────────────
  // Annual gross for tax purposes
  const jahresBrutto = brutto * 12

  // Standard deductions
  let taxableAnnual = jahresBrutto - WERBUNGSKOSTEN_PAUSCH - SONDERAUSGABEN_PAUSCH
  // Deduct AN-SV from taxable income (§3 Nr.62 EStG → SV is already included in SV
  // contributions calculation, but for Lohnsteuer the SV deduction is complex;
  // simplified: deduct AN-SV from pre-tax income annually)
  const annualSv = svTotal * 12
  taxableAnnual -= annualSv

  // Apply Grundfreibetrag and Steuerklasse adjustments
  switch (input.taxClass) {
    case 1:
    case 4:
      taxableAnnual -= GRUNDFREIBETRAG
      taxableAnnual -= input.childCount * 0 // Kinderfreibetrag is applied automatically in §32a
      break
    case 2:
      taxableAnnual -= GRUNDFREIBETRAG + ENTLASTUNGSBETRAG_ALLEIN
      break
    case 3:
      taxableAnnual -= GRUNDFREIBETRAG * 2  // doubled for married (higher earner)
      break
    case 5:
      // Steuerklasse 5: no Grundfreibetrag, but minimum tax rule applies
      // (other spouse claims class 3)
      break
    case 6:
      // Steuerklasse 6: no deductions at all (second employer)
      taxableAnnual = jahresBrutto
      warnings.push('Steuerklasse 6: volle Besteuerung ohne Freibeträge.')
      break
  }

  // Kinderfreibetrag (in Steuerklassen 1,2,3,4 reduces zvE)
  // §32 Abs.6: 3192 € per parent per child; in Kl.3: double
  if (input.taxClass !== 5 && input.taxClass !== 6 && input.childCount > 0) {
    const kfb = input.taxClass === 3
      ? input.childCount * 3192 * 2
      : input.childCount * 3192
    taxableAnnual -= kfb
  }

  const zvE = Math.max(0, taxableAnnual)
  const annualTax = annualIncomeTax(zvE)
  const lohnsteuerMonthly = Math.round(annualTax / 12 * 100) / 100

  // Solidaritätszuschlag
  let soliMonthly = 0
  if (annualTax > SOLI_FREIGRENZE_ANNUAL) {
    soliMonthly = Math.round(lohnsteuerMonthly * SOLI_RATE * 100) / 100
  } else if (annualTax > 0) {
    // Gleitzone: 11.9% of the excess over Freigrenze (simplified)
    const excess = annualTax - SOLI_FREIGRENZE_ANNUAL
    soliMonthly = Math.round(Math.min(excess * 0.119, lohnsteuerMonthly * SOLI_RATE) / 12 * 100) / 100
  }

  // Kirchensteuer
  let kirchensteuerMonthly = 0
  if (input.churchTax) {
    kirchensteuerMonthly = Math.round(lohnsteuerMonthly * kirchensteuerRate(input.bundesland) * 100) / 100
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
