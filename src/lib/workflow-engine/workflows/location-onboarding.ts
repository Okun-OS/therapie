import type { WorkflowDefinition } from '../types'

// The 13 onboarding phases mirror ONBOARDING_PHASES in onboarding-service.ts.
// Exit condition for each: is that phase key present in completedPhases array?
// Final gate: all phases done AND at least one shift defined (checked separately).

const phaseQuestion: Record<string, string> = {
  phase1: 'Was für eine Einrichtung ist Ihr Standort? (z.B. stationäre Einrichtung, ambulanter Dienst, Kita …)',
  phase2: 'Wie ist die Organisationsstruktur am Standort aufgebaut? Welche Gruppen oder Bereiche gibt es?',
  phase3: 'Wie ist die Personalstruktur? Wie viele Mitarbeitende gibt es, und welche Qualifikationen bringen sie mit?',
  phase4: 'Welche Arbeitszeiten und Schichtmodelle sind bei Ihnen üblich? Nennen Sie bitte Schichtnamen und Zeiten.',
  phase5: 'Nach welcher Logik wird der Dienstplan erstellt? Welche Regeln sind dabei besonders wichtig?',
  phase6: 'Welche Pausenregelungen gelten? Gibt es automatische Abzüge oder feste Pausenzeiten?',
  phase7: 'Welche wiederkehrenden Aufgaben gibt es, die im Dienstplan berücksichtigt werden müssen?',
  phase8: 'Gibt es individuelle Regeln oder Besonderheiten, die für diesen Standort spezifisch sind?',
  phase9: 'Wie wird mit Vertretungen umgegangen? Wer springt ein, und wie wird das koordiniert?',
  phase10: 'Wie funktioniert die Urlaubsplanung? Gibt es besondere Regeln für Mindestbesetzung oder Schulferien?',
  phase11: 'Wie wird die Zeiterfassung am Standort gehandhabt?',
  phase12: 'Gibt es noch offene Punkte oder Besonderheiten, die ich wissen sollte?',
  phase13: 'Bitte beschreiben Sie den typischen Tagesablauf an einem normalen Arbeitstag.',
}

export const LocationOnboardingWorkflow: WorkflowDefinition = {
  id: 'location-onboarding',
  name: 'Standort-Onboarding',

  phases: Object.entries(phaseQuestion).map(([key, question]) => ({
    id: key,
    name: key,
    exitCondition: (data) => {
      const completedPhases = (data.completedPhases as string[] | undefined) ?? []
      return completedPhases.includes(key)
    },
    missingFieldQuestion: () => question,
  })),

  isActuallyComplete: (data) => {
    const completedPhases = (data.completedPhases as string[] | undefined) ?? []
    const shiftCount = (data._shiftCount as number | undefined) ?? 0
    return data.completed === true && completedPhases.length >= 12 && shiftCount > 0
  },
}
