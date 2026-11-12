import type { WorkflowDefinition } from '../types'

// The 8 phases mirror the AI system prompt phases in employee-creation-chat.
// The AI tracks currentPhase (1–8) in its tool call — so exit condition is
// simply: is the draft's currentPhase > this phase number?
// Final gate: readyToSave=true AND confirmed=true.

const phaseData: Array<{ id: string; name: string; minPhase: number; fallback: string }> = [
  { id: 'personal',       name: 'Persönliche Daten',        minPhase: 2, fallback: 'Wie lautet der vollständige Name des Mitarbeiters?' },
  { id: 'arbeitsbereich', name: 'Arbeitsbereich',           minPhase: 3, fallback: 'In welcher Gruppe oder welchem Bereich wird der Mitarbeiter eingesetzt?' },
  { id: 'rolle',          name: 'Rolle & Position',         minPhase: 4, fallback: 'Welche Rolle oder Position hat der Mitarbeiter im Unternehmen?' },
  { id: 'arbeitszeit',    name: 'Arbeitszeit & Modell',     minPhase: 5, fallback: 'Wie viele Stunden pro Woche arbeitet der Mitarbeiter, und wie ist das Arbeitszeitmodell?' },
  { id: 'qualifikation',  name: 'Qualifikationen & Aufgaben', minPhase: 6, fallback: 'Welche Qualifikationen und Aufgaben bringt der Mitarbeiter mit?' },
  { id: 'besonderheiten', name: 'Persönliche Besonderheiten', minPhase: 7, fallback: 'Gibt es persönliche Besonderheiten, die bei der Dienstplanung berücksichtigt werden sollten?' },
  { id: 'absprachen',     name: 'Individuelle Absprachen',  minPhase: 8, fallback: 'Gibt es individuelle Absprachen oder feste Vereinbarungen mit dem Mitarbeiter?' },
  { id: 'bestaetigung',   name: 'Zusammenfassung & Bestätigung', minPhase: 9, fallback: 'Soll ich die Zusammenfassung vorlesen, damit Sie alles bestätigen können?' },
]

export const EmployeeCreationWorkflow: WorkflowDefinition = {
  id: 'employee-creation',
  name: 'Mitarbeiter-Onboarding',

  phases: phaseData.map(p => ({
    id: p.id,
    name: p.name,
    exitCondition: (data) => ((data.currentPhase as number | undefined) ?? 1) >= p.minPhase,
    missingFieldQuestion: () => p.fallback,
  })),

  isActuallyComplete: (data) =>
    data.readyToSave === true && data.confirmed === true && !!data.name && !!data.email,
}
