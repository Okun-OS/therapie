export interface ScheduleTask {
  description: string
  duration?: string
  priority?: string
  affectedEmployees?: string
  period?: string
}

export interface SchedulePlanningDraft {
  events?: string[]
  tasks?: ScheduleTask[]
  employeeNotes?: string[]
  currentPhase?: number
  readyToSave?: boolean
}

export function draftToNoteStrings(draft: SchedulePlanningDraft): string[] {
  const notes: string[] = []
  draft.events?.forEach(e => notes.push(`Ereignis: ${e}`))
  draft.tasks?.forEach(t => {
    const parts = [t.description]
    if (t.duration) parts.push(`Dauer: ${t.duration}`)
    if (t.priority) parts.push(`Priorität: ${t.priority}`)
    if (t.affectedEmployees) parts.push(`Betrifft: ${t.affectedEmployees}`)
    if (t.period) parts.push(`Zeitraum: ${t.period}`)
    notes.push(`Aufgabe: ${parts.join(' · ')}`)
  })
  draft.employeeNotes?.forEach(n => notes.push(`Mitarbeiterhinweis: ${n}`))
  return notes
}
