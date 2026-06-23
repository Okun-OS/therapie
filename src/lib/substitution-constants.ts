export type EscalationStage = 'group' | 'location' | 'organization' | 'springerpool'

export const ESCALATION_ORDER: EscalationStage[] = ['group', 'location', 'organization', 'springerpool']

export const ESCALATION_LABEL: Record<EscalationStage, string> = {
  group: 'Eigene Gruppe',
  location: 'Eigene Einrichtung',
  organization: 'Eigener Träger',
  springerpool: 'Springerpool',
}

export type SubstitutionPriority = 'low' | 'normal' | 'high' | 'urgent'

export const PRIORITY_LABEL: Record<SubstitutionPriority, string> = {
  low: 'Niedrig',
  normal: 'Normal',
  high: 'Hoch',
  urgent: 'Dringend',
}
