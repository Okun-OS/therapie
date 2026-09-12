import { prisma } from './prisma'

export interface HumanContextUpdate {
  strengths?: string[]
  lifeCircumstances?: string[]
  preferredGroups?: string[]
  preferredActivities?: string[]
  shiftPreferences?: string[]
  agreements?: string | null
}

export async function upsertHumanContext(employeeId: string, update: HumanContextUpdate) {
  return prisma.employeeHumanContext.upsert({
    where: { employeeId },
    update: {
      ...(update.strengths !== undefined && { strengths: update.strengths }),
      ...(update.lifeCircumstances !== undefined && { lifeCircumstances: update.lifeCircumstances }),
      ...(update.preferredGroups !== undefined && { preferredGroups: update.preferredGroups }),
      ...(update.preferredActivities !== undefined && { preferredActivities: update.preferredActivities }),
      ...(update.shiftPreferences !== undefined && { shiftPreferences: update.shiftPreferences }),
      ...(update.agreements !== undefined && { agreements: update.agreements }),
    },
    create: {
      employeeId,
      strengths: update.strengths ?? [],
      lifeCircumstances: update.lifeCircumstances ?? [],
      preferredGroups: update.preferredGroups ?? [],
      preferredActivities: update.preferredActivities ?? [],
      shiftPreferences: update.shiftPreferences ?? [],
      agreements: update.agreements ?? null,
    },
  })
}
