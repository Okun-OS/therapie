import { prisma } from './prisma'

/**
 * §232 Freiwillige persönliche Angaben — und wohin sie gehen.
 *
 * Nicht in den Rechendienst. Sie stehen in der Personalakte und der
 * OKUN-Assistent kann sie auf Frage heranziehen; das ist ihr Zweck und ihre
 * Grenze. Die Maske sagte vorher „damit die Dienstplanung darauf Rücksicht
 * nehmen kann" — ein Versprechen, das nichts einhielt.
 *
 * `preferredGroups` und `shiftPreferences` sind entfallen: Beide standen ein
 * zweites Mal da, wo es schon ein planendes Feld gab.
 */

export interface HumanContextUpdate {
  strengths?: string[]
  lifeCircumstances?: string[]
  preferredActivities?: string[]
  agreements?: string | null
}

export async function upsertHumanContext(employeeId: string, update: HumanContextUpdate) {
  return prisma.employeeHumanContext.upsert({
    where: { employeeId },
    update: {
      ...(update.strengths !== undefined && { strengths: update.strengths }),
      ...(update.lifeCircumstances !== undefined && { lifeCircumstances: update.lifeCircumstances }),
      ...(update.preferredActivities !== undefined && { preferredActivities: update.preferredActivities }),
      ...(update.agreements !== undefined && { agreements: update.agreements }),
    },
    create: {
      employeeId,
      strengths: update.strengths ?? [],
      lifeCircumstances: update.lifeCircumstances ?? [],
      preferredActivities: update.preferredActivities ?? [],
      agreements: update.agreements ?? null,
    },
  })
}
