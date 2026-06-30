export interface EmployeeDraft {
  name?: string
  email?: string
  phone?: string
  birthDate?: string
  entryDate?: string
  gruppe?: string
  bereich?: string
  multiGroupCapable?: boolean
  fixedLocations?: string
  roleType?: string
  employmentType?: string
  weeklyHours?: number
  workDaysPerWeek?: number
  workDays?: string[]
  dailyTargetHours?: number
  fixedOffDays?: string[]
  qualifications?: string[]
  allowedTasks?: string[]
  besonderheiten?: string[]
  absprachen?: string
  currentPhase?: number
  readyToSave?: boolean
  confirmed?: boolean
}
