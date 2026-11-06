export interface VacationRulesDraft {
  facilityDescription?: string
  maxConcurrent?: number
  customRules?: string[]
  schoolHolidayPriorityMode?: 'always' | 'slight' | 'none'
  readyToSave?: boolean
  confirmed?: boolean
}
