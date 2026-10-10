// ─── Requirement Engine ────────────────────────────────────────────────────────
//
// Captures requirements that the AI discovers during a conversation but that
// don't yet exist in OKUN. Anything the system can't handle automatically lands
// in the WorkflowLearning table for review by the OKUN team.

import { prisma } from '@/lib/prisma'
import type { DiscoveredRequirement } from './types'

export async function saveDiscoveredRequirements(
  requirements: DiscoveredRequirement[],
  context: {
    workflowId: string
    customerId?: string
    locationId?: string
  },
): Promise<void> {
  if (!requirements.length) return

  await prisma.workflowLearning.createMany({
    data: requirements.map(req => ({
      id: crypto.randomUUID(),
      workflowId: context.workflowId,
      customerId: context.customerId ?? null,
      locationId: context.locationId ?? null,
      type: req.type,
      description: req.description,
      confidence: req.confidence,
      structuredData: (req.structuredData ?? {}) as object,
      status: 'pending',
    })),
    skipDuplicates: true,
  })
}
