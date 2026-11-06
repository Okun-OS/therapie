import type { WorkflowDefinition } from '../types'

export const OrgOnboardingWorkflow: WorkflowDefinition = {
  id: 'org-onboarding',
  name: 'Unternehmens-Onboarding',

  phases: [
    {
      id: 'grunddaten',
      name: 'Grunddaten',
      exitCondition: (data) => !!data.traegerName,
      missingFieldQuestion: () =>
        'Wie lautet der offizielle Name Ihres Unternehmens oder Trägers?',
    },
    {
      id: 'rollenmodell',
      name: 'Rollenmodell & Hierarchie',
      exitCondition: (data) => !!data.rollenmodell,
      missingFieldQuestion: () =>
        'Wie ist die Hierarchie in Ihrem Unternehmen aufgebaut? Gibt es z.B. Geschäftsführung, Einrichtungsleitung und Mitarbeiter?',
    },
    {
      id: 'regeln',
      name: 'Unternehmensweite Regeln',
      exitCondition: (data) => !!data.unternehmensweiteRegeln || data.completed === true,
      missingFieldQuestion: () =>
        'Gibt es unternehmensweite Regeln oder Besonderheiten, die für alle Standorte gelten?',
    },
    {
      id: 'abschluss',
      name: 'Bestätigung',
      exitCondition: (data) => data.completed === true,
      missingFieldQuestion: () =>
        'Haben Sie alle wichtigen Informationen geteilt? Möchten Sie das Onboarding jetzt abschließen?',
    },
  ],

  isActuallyComplete: (data) => data.completed === true && !!data.traegerName && !!data.rollenmodell,
}
