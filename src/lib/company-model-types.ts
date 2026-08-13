export type ModulTyp =
  | 'dienstplanung'
  | 'einsatzplanung'
  | 'zeiterfassung'
  | 'urlaubsplanung'
  | 'vertretungsmanagement'
  | 'aufgabenmanagement'
  | 'tourenplanung'
  | 'objektplanung'
  | 'fahrzeugverwaltung'
  | 'inventur'
  | 'qualitaetsmanagement'
  | 'teamsitzungen'
  | 'dokumentation'
  | 'materialverwaltung'

export type BetriebsTyp =
  | 'mon_fri'
  | 'mon_sat'
  | '7_tage'
  | '24_7'
  | 'schichtbetrieb'
  | 'bedarfsgesteuert'
  | 'bereitschaft'

export type EinheitTyp = 'gruppe' | 'bereich' | 'station' | 'tour' | 'objekt' | 'fahrzeug' | 'raum'

export type SchichtTyp =
  | 'frueh'
  | 'spaet'
  | 'nacht'
  | 'mittel'
  | 'bereitschaft'
  | 'rufbereitschaft'
  | 'sonderdienst'

export type WochentagKuerzel = 'Mo' | 'Di' | 'Mi' | 'Do' | 'Fr' | 'Sa' | 'So'

export interface PlanungsEinheit {
  id: string
  name: string
  typ: EinheitTyp
  mindestbesetzung: number
  maximalbesetzung?: number
  erforderlicheQualifikationen: string[]
  aufgaben: string[]
}

export interface SchichtDefinition {
  id: string
  name: string
  typ: SchichtTyp
  von: string
  bis: string
  uebernacht: boolean
  minBesetzungGesamt: number
  aufgaben: string[]
  erforderlicheQualifikationen?: string[]
}

export interface PausenRegelung {
  automatisch: boolean
  nachMinuten: number
  dauertMinuten: number
}

export interface Schichtmodell {
  arbeitstage: WochentagKuerzel[]
  schichten: SchichtDefinition[]
  pausenRegelung: PausenRegelung
}

export interface HarteRegel {
  id: string
  kategorie: 'arbeitszeit' | 'ruhezeit' | 'qualifikation' | 'besetzung' | 'folgetag' | 'gesetz'
  beschreibung: string
  typ: string
  wert?: number
  einheit?: string
  quelle: 'gesetz' | 'tarifvertrag' | 'betriebsvereinbarung' | 'unternehmen'
}

export interface WeicheRegel {
  id: string
  kategorie: 'fairness' | 'wunsch' | 'praeferenz' | 'belastung' | 'kontinuitaet'
  beschreibung: string
  gewicht: number
}

export interface PlanungsRegelSet {
  hart: HarteRegel[]
  weich: WeicheRegel[]
}

export interface FairnessKonfig {
  wochenendArbeit: boolean
  wochenendLimitProMonat?: number
  nachtdienstFair: boolean
  schichttypFairness: boolean
  belastungsgleichverteilung: boolean
}

export interface VertretungsKonfig {
  eskalationsReihenfolge: ('gruppe' | 'standort' | 'organisation' | 'springerpool')[]
  qualifikationsPflicht: boolean
  maxWartezeitMinuten?: number
}

export interface TagesablaufElement {
  uhrzeit: string
  beschreibung: string
  einheit?: string
  aufgabe?: string
}

export interface StandortModell {
  locationId: string
  locationName: string
  planungsEinheiten: PlanungsEinheit[]
  schichtmodell: Schichtmodell
  planungsRegeln: PlanungsRegelSet
  fairnessKonfig: FairnessKonfig
  vertretungsKonfig: VertretungsKonfig
  tagesablauf?: TagesablaufElement[]
}

export interface OrganisationConfig {
  name: string
  branche: string
  betriebsTyp: BetriebsTyp
  beschreibung: string
  bundesland?: string
  gesetzlicherRahmen: string[]
}

export interface CompanyModel {
  schemaVersion: '1.0'
  customerId: string
  organisation: OrganisationConfig
  standortModelle: StandortModell[]
  aktivierteModule: ModulTyp[]
  erkannteModule: ModulTyp[]
}

// Per-location planning model — primary unit for solver configuration.
// Each Standort owns an independent LocationModel stored in LocationRuleModelRecord.
export interface LocationModel extends StandortModell {
  customerId: string
  betriebsTyp: BetriebsTyp
  bundesland?: string
}

export interface PlanungsWunsch {
  datum: string
  schichtId: string
  typ: 'wunsch' | 'wunschfrei'
  prioritaet: 1 | 2 | 3
}

export interface PlanungsMitarbeiter {
  id: string
  name: string
  einheiten: string[]
  verfuegbareSchichtTypen: SchichtTyp[]
  wochenstundenSoll: number
  arbeitstageProWoche: number
  qualifikationen: string[]
  nichtVerfuegbarAn: string[]
  urlaubAn: string[]
  wuensche: PlanungsWunsch[]
  besonderheiten?: string
  letzteSchichten?: Array<{ datum: string; schichtId: string }>
  belastungsHistorie?: {
    nachtSchichten: number    // count in last 5 weeks
    wochenendDienste: number  // count in last 5 weeks
    spaetDienste: number      // count in last 5 weeks
  }
}

export type PlanVariante = 'ausgewogen' | 'mitarbeiterfreundlich' | 'maximal_fair'

export interface PlanningRuleModel {
  sessionId: string
  locationId: string
  customerId: string
  zeitraum: { von: string; bis: string; arbeitstage: string[] }
  einheiten: PlanungsEinheit[]
  schichten: SchichtDefinition[]
  harteRegeln: HarteRegel[]
  weicheRegeln: WeicheRegel[]
  fairness: FairnessKonfig
  mitarbeiter: PlanungsMitarbeiter[]
  kontext?: string
  vorherigeBewertung?: string
  existingSchedule?: Array<{ mitarbeiterId: string; datum: string; schichtId: string }>
  frozenDates?: string[]
  planVariante?: PlanVariante
}

export interface PlanEintrag {
  mitarbeiterId: string
  datum: string
  schichtId: string
  einheitId?: string
  funktion?: string
  aufgaben?: string[]
  istVertretung: boolean
  startzeit?: string
  endzeit?: string
  hinweis?: string
  // §66 assignment role within the shift (e.g. "Springer", "Gruppenleitung")
  role?: string
  // §67 how the assignment was created: 'solver' | 'manual' | 're-optimize' | 'frozen'
  source?: 'solver' | 'manual' | 're-optimize' | 'frozen'
  // §67 previous assignment that this entry replaced (for change minimization diff)
  changedFrom?: { schichtId: string; datum: string }
  // §68 natural-language explanation of why this employee was assigned here
  whyAssigned?: string
}

export interface PlanDecision {
  typ: string
  beschreibung: string
  betroffeneMitarbeiter?: string[]
  betroffenesDatum?: string
}

export interface GenerierterPlan {
  eintraege: PlanEintrag[]
  decisions: PlanDecision[]
  metadaten: {
    erstelltAm: string
    solver: string
    regelmodellVersion: string
    solverSeed?: number
  }
  // §68: per-day/employee explanations for unassigned slots
  whyNotAssigned?: Array<{
    mitarbeiterId: string
    datum: string
    grund: string
  }>
}

// §13: PlanningSnapshot — immutable snapshot of a completed planning session
export type PlanningSnapshot = {
  sessionId: string
  locationId: string
  customerId: string
  zeitraumVon: string
  zeitraumBis: string
  plan: GenerierterPlan
  bewertung: PlanBewertung
  createdAt: string
}

export type FreigabeEmpfehlung = 'freigeben' | 'optimieren' | 'ueberarbeiten'

export interface RegelVerletzung {
  schwere: 'kritisch' | 'hoch' | 'mittel' | 'niedrig'
  regelId: string
  beschreibung: string
  betrifft: string[]
}

export interface OptimierungsVorschlag {
  typ: 'tausch' | 'verschiebung' | 'anpassung' | 'regel'
  beschreibung: string
  erwarteteVerbesserung: number
}

export interface PlanBewertung {
  gesamtScore: number
  kategorien: {
    regelkonformitaet: number
    fairness: number
    abdeckung: number
    wunscherfuellung: number
    qualitaet: number
  }
  verletzungen: RegelVerletzung[]
  optimierungsVorschlaege: OptimierungsVorschlag[]
  freigabeEmpfehlung: FreigabeEmpfehlung
  zusammenfassung: string
}

// ─── §34 Legal Jurisdiction ───────────────────────────────────────────────────
// Enum of supported legal jurisdictions for labor law compliance.
// Configurable per location; determines which statutory defaults apply.

export type LegalJurisdiction =
  | 'DE_ARBZG'         // German Arbeitszeitgesetz (default)
  | 'DE_BW'            // Baden-Württemberg (state-specific additions)
  | 'DE_BAY'           // Bavaria
  | 'DE_NRW'           // North Rhine-Westphalia
  | 'AT_ARBZG'         // Austrian Arbeitszeitgesetz
  | 'CH_OR'            // Swiss Code of Obligations
  | 'CUSTOM'           // Customer-defined rules only

export interface LegalPolicy {
  jurisdiction: LegalJurisdiction
  // Override individual statutory limits (leave null to use jurisdiction defaults)
  maxWeeklyHoursOverride?: number    // e.g. 40 for company policy stricter than law
  minRestHoursOverride?: number
  maxConsecutiveDaysOverride?: number
}

// ─── Planning Policy ─────────────────────────────────────────────────────────
// Human-readable admin configuration that governs how the solver is run.

export interface PlanningPolicy {
  locationId: string
  // How to handle employees with excess hours before the planning run
  defaultOvertimeHandling: 'reduce' | 'normal' | 'compensate'
  // Minimum acceptable quality score for auto-approval
  minAutoApproveScore: number
  // Whether to skip planning when staffing is provably infeasible
  failFastOnInfeasible: boolean
  updatedAt: string
}

// ─── Employee Requests ────────────────────────────────────────────────────────
// Structured employee requests that the solver considers.

export type EmployeeRequestType =
  | 'shift_wish'        // wants a specific shift
  | 'day_off_wish'      // wants a day off (wunschfrei)
  | 'vacation'          // approved vacation (hard block)
  | 'absence'           // approved absence (hard block)
  | 'overtime_reduce'   // wants fewer hours this period
  | 'overtime_compensate' // wants more hours this period

export type EmployeeRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired'
export type EmployeeRequestPriority = 'low' | 'normal' | 'high' | 'critical'

export interface EmployeeRequest {
  id: string
  employeeId: string
  type: EmployeeRequestType
  status: EmployeeRequestStatus
  priority: EmployeeRequestPriority
  date?: string            // for day-specific requests
  dateRange?: { from: string; to: string }
  shiftId?: string         // for shift_wish
  reason?: string
  submittedAt: string
  respondedAt?: string
}
