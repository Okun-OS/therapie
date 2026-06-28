export type Role = 'employee' | 'admin' | 'company' | 'okun'
export type ShiftType = 'early' | 'late' | 'mid' | 'night'
export type RequestStatus = 'pending' | 'approved' | 'denied'
export type SwapStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'
export type WishStatus = 'pending' | 'fulfilled' | 'not_fulfilled'
export type WishImportance = 'normal' | 'important' | 'urgent'

export interface Location {
  id: string
  customerId?: string
  name: string
  address: string
  city: string
  state: string
  employeeCount: number
  adminId: string
  active: boolean
}

export interface Employee {
  id: string
  customerId?: string
  name: string
  email: string
  role: Role
  locationId: string | undefined
  weeklyHours: number
  position: string
  hoursBalance: number
  vacationDaysTotal: number
  vacationDaysUsed: number
  preferences?: EmployeePreferences
  active: boolean
  joinedAt: string
  hasChildren?: boolean
  phone?: string
  birthDate?: string
  roleType?: string
  employmentType?: string
  gruppe?: string
  bereich?: string
  multiGroupCapable?: boolean
  fixedLocations?: string
  qualifications?: string[]
  allowedTasks?: string[]
  workDaysPerWeek?: number
}

export interface EmployeePreferences {
  preferredShifts: ShiftType[]
  unavailableDays: number[]
  maxConsecutiveDays?: number
  noEarlyAfterLate?: boolean
  notes?: string
}

export interface Shift {
  id: string
  name: string
  type: ShiftType
  startTime: string
  endTime: string
  color: string
  bgColor: string
  minStaff: number
  locationId: string
}

export interface LocationPlanningRules {
  locationId: string
  maxWeeklyHours: number
  restHours: number
  maxConsecutiveDays: number
  fridayLateMax: number
  mondayEarlyMax: number
  fridayEarlyMax: number
  weekendMax: number
  considerWishes: boolean
  balanceHoursAccount: boolean
}

export interface ScheduleEntry {
  id: string
  employeeId: string
  shiftId: string
  date: string
  locationId: string
  status: 'planned' | 'confirmed'
  note?: string
  reason?: string
  startTime?: string
  endTime?: string
}

export interface TimeLog {
  id: string
  employeeId: string
  date: string
  clockIn: string
  clockOut?: string
  totalMinutes?: number
  breakMinutes?: number
  breakStart?: string
  note?: string
  locationId: string
}

// ─── Überstunden ──────────────────────────────────────────────────────────────

export type OvertimeRequestStatus = 'pending' | 'approved' | 'denied' | 'partial'

export const OVERTIME_REASONS = ['Personalmangel', 'Übergabe dauerte länger', 'Dokumentation', 'Elterngespräch', 'Notfall', 'Vertretung', 'Sonstiges'] as const

export interface OvertimeRequest {
  id: string
  employeeId: string
  employeeName: string
  locationId: string
  date: string
  timeLogId: string
  overtimeMinutes: number
  reason: string
  comment?: string
  status: OvertimeRequestStatus
  approvedMinutes?: number
  adminComment?: string
  respondedAt?: string
  respondedBy?: string
  submittedAt: string
}

// ─── Krankheiten und Abwesenheiten ────────────────────────────────────────────

export type AbsenceType = 'krankheit' | 'fortbildung' | 'sonstige' | 'unentschuldigt' | 'entschuldigt'
export type AbsenceVerificationStatus = 'offen' | 'geprueft' | 'abgelehnt'

export interface Absence {
  id: string
  employeeId: string
  employeeName: string
  locationId: string
  type: AbsenceType
  startDate: string
  endDate: string
  days: number
  note?: string
  proofProvided: boolean
  verificationStatus: AbsenceVerificationStatus
  verifiedBy?: string
  verifiedAt?: string
  submittedAt: string
}

// ─── Stundenkonto / Monatsabschluss ───────────────────────────────────────────

export interface HoursAccountSummary {
  employeeId: string
  year: number
  month: number
  sollMinutes: number
  istMinutes: number
  breakMinutes: number
  overtimeMinutes: number
  undertimeMinutes: number
  vacationDays: number
  sickDays: number
  otherAbsenceDays: number
}

export type MonthlyClosingStatus = 'offen' | 'geprueft' | 'freigegeben'

export interface MonthlyClosing {
  id: string
  employeeId: string
  employeeName: string
  locationId: string
  year: number
  month: number
  status: MonthlyClosingStatus
  arbeitstage: number
  sollMinutes: number
  istMinutes: number
  breakMinutes: number
  overtimeMinutes: number
  undertimeMinutes: number
  vacationDays: number
  sickDays: number
  otherAbsenceDays: number
  approvalsCount: number
  comments: { author: string; text: string; at: string }[]
  reviewedBy?: string
  reviewedAt?: string
  releasedBy?: string
  releasedAt?: string
}

export interface VacationRequest {
  id: string
  employeeId: string
  employeeName: string
  locationId: string
  locationName: string
  startDate: string
  endDate: string
  days: number
  reason?: string
  status: RequestStatus
  submittedAt: string
  respondedAt?: string
  respondedBy?: string
}

// ─── Shift Swap ─────────────────────────────────────────────────────────────

export interface SwapRequest {
  id: string
  requesterId: string
  requesterName: string
  requesterDate: string    // ISO date they want to give away
  requesterShiftId: string
  targetEmployeeId: string
  targetEmployeeName: string
  targetDate: string       // ISO date they want to receive
  targetShiftId: string
  message?: string
  status: SwapStatus
  submittedAt: string      // ISO timestamp
  respondedAt?: string
  locationId: string
}

// ─── Wish Submissions (Dienstwünsche) ────────────────────────────────────────

export interface WishSubmission {
  id: string
  employeeId: string
  employeeName: string
  locationId: string
  date: string             // ISO date for the desired day
  preferredShiftType: ShiftType
  reason?: string
  importance: WishImportance
  submittedAt: string      // ISO timestamp – used for tie-breaking
  status: WishStatus
  conflictInfo?: {
    conflictedWith: string[]  // names of employees who also requested this slot
    reason: string            // human-readable resolution explanation
    winnerId: string
  }
}

// ─── Schließzeiten / Pflichturlaub ───────────────────────────────────────────

export interface ClosurePeriod {
  id: string
  locationId: string
  name: string
  startDate: string
  endDate: string
  createdBy: string
  createdAt: string
}

// ─── Fairness ────────────────────────────────────────────────────────────────

export interface ShiftFairnessData {
  employeeId: string
  employeeName: string
  weeklyHours: number
  // Absolute counts over the observed period
  earlyCnt: number
  lateCnt: number
  midCnt: number
  // Day-of-week distribution  (0=Sun … 6=Sat)
  dayOfWeekCounts: number[]
  fridayEarlyCnt: number
  fridayLateCnt: number
  mondayEarlyCnt: number
  mondayLateCnt: number
  weekendCnt: number
  totalShiftsCnt: number
  // Belastungsmanagement: längste Folge aufeinanderfolgender Arbeitstage im Betrachtungszeitraum
  maxConsecutiveDays: number
  // Anzahl übernommener Vertretungen im Betrachtungszeitraum (nur über getFairnessInsights befüllt, sonst 0)
  substitutionCoverageCnt: number
  // Derived: debt per type (negative = owed more of this type)
  earlyDebt: number
  lateDebt: number
  midDebt: number
  // Overall fairness score 0–100 (100 = perfectly balanced)
  fairnessScore: number
  issues: string[]
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  employeeId?: string
  locationId?: string
  customerId?: string
  position?: string
}

export interface DashboardStats {
  totalEmployees: number
  presentToday: number
  openVacationRequests: number
  hoursThisMonth: number
  understaffedShifts: number
}

// ─── Vacation Planning ────────────────────────────────────────────────────────

export interface VacationPlanPreference {
  employeeId: string
  hasChildren: boolean
  schoolHolidayPriority?: 'low' | 'medium' | 'high'  // only meaningful when hasChildren is true
  preferredMonths: number[]  // 1–12
  preferredPeriod?: string   // free text
  notes?: string
  priority: 'low' | 'medium' | 'high'
}

export interface VacationRules {
  facilityDescription: string
  maxConcurrent: number
  customRules: string[]
  // Ferienregelung für Mitarbeiter mit schulpflichtigen Kindern (facility-weit, nicht pro Mitarbeiter)
  schoolHolidayPriorityMode: 'always' | 'slight' | 'none'
}

export interface SchoolHoliday {
  name: string
  startDate: string
  endDate: string
  state: string
}

export interface VacationPlanSlot {
  startDate: string
  endDate: string
  days: number
}

export interface VacationPlanEntry {
  employeeId: string
  employeeName: string
  slots: VacationPlanSlot[]
  note?: string
}

export interface VacationPlanConflict {
  employeeNames: string[]
  reasoning: string
}

export interface VacationPlanSummary {
  fulfillmentPercent: number
  fulfilledCount: number
  totalCount: number
}

export interface VacationPlan {
  plan: VacationPlanEntry[]
  reasoning: string
  warnings: string[]
  summary?: VacationPlanSummary
  conflicts?: VacationPlanConflict[]
}

export interface VacationRecommendation {
  stance: 'empfehlung_genehmigen' | 'empfehlung_pruefen' | 'empfehlung_ablehnen'
  reasoning: string
}

// ─── OKUN Plattformverwaltung ─────────────────────────────────────────────────

export type CustomerStatus = 'trial' | 'active' | 'suspended' | 'cancelled'
export type LicensePlan = 'starter' | 'professional' | 'enterprise'

export interface Customer {
  id: string
  name: string
  contactName: string
  contactEmail: string
  status: CustomerStatus
  plan: LicensePlan
  seatsLicensed: number
  seatsUsed: number
  locationsCount: number
  createdAt: string
  renewalDate?: string
  notes?: string
  roles?: string[]
}

export interface TestAccount {
  id: string
  customerName: string
  contactEmail: string
  createdAt: string
  expiresAt: string
  converted: boolean
}

export interface Invitation {
  id: string
  email: string
  role: Role
  customerName?: string
  status: 'pending' | 'accepted' | 'expired'
  sentAt: string
}

export interface SupportAccessLogEntry {
  id: string
  customerName: string
  requestedBy: string
  reason: string
  grantedAt: string
  revokedAt?: string
}

export interface OrgSettings {
  organizationName: string
  defaultWeeklyHours: number
  defaultVacationDaysPerYear: number
  autoApproveVacationUnderDays: number
  notificationEmail: string
}
