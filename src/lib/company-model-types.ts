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
}

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
  }
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
