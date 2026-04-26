export type Role = 'employee' | 'admin' | 'company'
export type ShiftType = 'early' | 'late' | 'mid' | 'night'
export type RequestStatus = 'pending' | 'approved' | 'denied'
export type SwapStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'
export type WishStatus = 'pending' | 'fulfilled' | 'not_fulfilled'
export type WishImportance = 'normal' | 'important' | 'urgent'

export interface Location {
  id: string
  name: string
  address: string
  city: string
  employeeCount: number
  adminId: string
  active: boolean
}

export interface Employee {
  id: string
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

export interface ScheduleEntry {
  id: string
  employeeId: string
  shiftId: string
  date: string
  locationId: string
  status: 'planned' | 'confirmed'
  note?: string
}

export interface TimeLog {
  id: string
  employeeId: string
  date: string
  clockIn: string
  clockOut?: string
  totalMinutes?: number
  note?: string
  locationId: string
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
  totalShiftsCnt: number
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
  locationId?: string
  position?: string
}

export interface DashboardStats {
  totalEmployees: number
  presentToday: number
  openVacationRequests: number
  hoursThisMonth: number
  understaffedShifts: number
}
