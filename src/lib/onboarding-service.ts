import { prisma } from './prisma'

export interface OrganizationOnboardingUpdate {
  traegerName?: string
  rollenmodell?: string
  unternehmensweiteRegeln?: string
  completed?: boolean
}

export async function upsertOrganizationOnboarding(update: OrganizationOnboardingUpdate) {
  return prisma.organizationOnboarding.upsert({
    where: { id: 'singleton' },
    update: {
      ...(update.traegerName !== undefined && { traegerName: update.traegerName }),
      ...(update.rollenmodell !== undefined && { rollenmodell: update.rollenmodell }),
      ...(update.unternehmensweiteRegeln !== undefined && { unternehmensweiteRegeln: update.unternehmensweiteRegeln }),
      ...(update.completed !== undefined && { completed: update.completed }),
    },
    create: {
      id: 'singleton',
      traegerName: update.traegerName,
      rollenmodell: update.rollenmodell,
      unternehmensweiteRegeln: update.unternehmensweiteRegeln,
      completed: update.completed ?? false,
    },
  })
}

export interface LocationOnboardingUpdate {
  einrichtungsart?: string
  organisationsstruktur?: string
  personalstruktur?: string
  arbeitszeiten?: string
  dienstplanlogik?: string
  pausenlogik?: string
  wiederkehrendeAufgaben?: string
  individuelleRegeln?: string[]
  vertretungsregeln?: string
  urlaubslogik?: string
  zeiterfassung?: string
  besonderheiten?: string
  completedPhases?: string[]
  completed?: boolean
}

const LOCATION_FIELDS: (keyof LocationOnboardingUpdate)[] = [
  'einrichtungsart', 'organisationsstruktur', 'personalstruktur', 'arbeitszeiten',
  'dienstplanlogik', 'pausenlogik', 'wiederkehrendeAufgaben', 'individuelleRegeln',
  'vertretungsregeln', 'urlaubslogik', 'zeiterfassung', 'besonderheiten',
  'completedPhases', 'completed',
]

export async function upsertLocationOnboarding(locationId: string, update: LocationOnboardingUpdate) {
  const data: Record<string, unknown> = {}
  for (const field of LOCATION_FIELDS) {
    if (update[field] !== undefined) data[field] = update[field]
  }
  return prisma.locationOnboarding.upsert({
    where: { locationId },
    update: data,
    create: { locationId, ...data },
  })
}

// All 12 Phasen aus 02_ONBOARDING_CHAT.md – die Reihenfolge dient nur der
// Anzeige/Fortschrittsmessung, die KI darf im Gespräch frei zwischen
// zusammenhängenden Themen wechseln.
export const ONBOARDING_PHASES = [
  { key: 'phase1', label: 'Einrichtung verstehen' },
  { key: 'phase2', label: 'Organisationsstruktur' },
  { key: 'phase3', label: 'Mitarbeiterstruktur' },
  { key: 'phase4', label: 'Arbeitszeiten' },
  { key: 'phase5', label: 'Dienstplanlogik' },
  { key: 'phase6', label: 'Pausenlogik' },
  { key: 'phase7', label: 'Wiederkehrende Aufgaben' },
  { key: 'phase8', label: 'Individuelle Regeln' },
  { key: 'phase9', label: 'Vertretungsregeln' },
  { key: 'phase10', label: 'Urlaubslogik' },
  { key: 'phase11', label: 'Zeiterfassung' },
  { key: 'phase12', label: 'Abschluss & offene Fragen' },
] as const
