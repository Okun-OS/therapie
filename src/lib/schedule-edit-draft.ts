export interface ScheduleEditChange {
  employeeId: string
  employeeName: string
  date: string
  action: 'assign' | 'remove'
  shiftId?: string
  shiftName?: string
  startTime?: string
  endTime?: string
  reason?: string
}

export interface ScheduleEditDraft {
  changes?: ScheduleEditChange[]
  permanentRules?: string[]
  readyToApply?: boolean
}

/** Lesbare Vorschau der vorgemerkten Einzeländerungen am bestehenden Dienstplan
 * (gilt nur für die konkret genannten Tage/Mitarbeiter, siehe permanentRules für Dauerregeln). */
export function draftToChangeStrings(draft: ScheduleEditDraft): string[] {
  return (draft.changes ?? []).map(c => {
    if (c.action === 'remove') return `${c.employeeName}: ${c.date} frei`
    const time = c.startTime && c.endTime ? ` (${c.startTime}–${c.endTime})` : ''
    return `${c.employeeName}: ${c.date} → ${c.shiftName ?? c.shiftId ?? ''}${time}`
  })
}

export function draftToPermanentRuleStrings(draft: ScheduleEditDraft): string[] {
  return draft.permanentRules ?? []
}
