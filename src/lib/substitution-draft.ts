import type { SubstitutionPriority } from './substitution-constants'

export interface SubstitutionDraft {
  date?: string
  startTime?: string
  endTime?: string
  qualification?: string
  priority?: SubstitutionPriority
  note?: string
  readyToSave?: boolean
  confirmed?: boolean
}
