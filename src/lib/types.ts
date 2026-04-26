export type Role = 'employee' | 'admin' | 'company'
export type ShiftType = 'early' | 'late' | 'mid' | 'night'
export type RequestStatus = 'pending' | 'approved' | 'denied'

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
