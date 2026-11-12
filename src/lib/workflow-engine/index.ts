// ─── OKUN Workflow Engine — Public API ────────────────────────────────────────
//
// This is the entry point consumed by all AI chat routes.
// Usage in a chat route:
//
//   import { WORKFLOW_STATUS_TOOL, extractWorkflowStatus, runSupervisor } from '@/lib/workflow-engine'
//
//   // 1. Add WORKFLOW_STATUS_TOOL to your tools array
//   // 2. After processing all tool calls, call extractWorkflowStatus(response.content)
//   // 3. Call runSupervisor(...) to get the supervised reply
//   // 4. Optionally call saveRequirements(...) for the Requirement Engine

export { superviseTurn, validateCompletion } from './supervisor'
export { saveDiscoveredRequirements } from './requirement'
export { detectModuleSuggestions } from './module-registry'
export { getWorkflow, OrgOnboardingWorkflow, LocationOnboardingWorkflow, EmployeeCreationWorkflow } from './workflows'
export type { WorkflowDefinition, WorkflowPhase, WorkflowStatusCall, DiscoveredRequirement, SupervisorResult } from './types'

import type { WorkflowStatusCall } from './types'

/**
 * The mandatory tool that EVERY AI chat must include in its tools list.
 * The AI is required to call this at the end of each response.
 * The Supervisor reads its output to enforce continuation.
 */
export const WORKFLOW_STATUS_TOOL = {
  name: 'workflow_status',
  description: [
    'PFLICHT: Muss in JEDER Antwort aufgerufen werden — auch wenn lediglich eine Folgefrage gestellt wird.',
    'Dieser Aufruf teilt der Conversation Supervisor Engine mit, ob der aktuelle Workflow-Schritt abgeschlossen ist',
    'und welche Frage als Nächstes gestellt werden soll.',
    'Ohne diesen Aufruf kann der Supervisor den Ablauf nicht kontrollieren.',
  ].join(' '),
  input_schema: {
    type: 'object' as const,
    properties: {
      phaseComplete: {
        type: 'boolean',
        description: 'true wenn alle erforderlichen Informationen des aktuellen Schritts erfasst wurden.',
      },
      nextQuestion: {
        type: 'string',
        description: 'Die nächste Frage an den Nutzer. Pflicht wenn phaseComplete=false und workflowComplete=false.',
      },
      workflowComplete: {
        type: 'boolean',
        description: 'true NUR wenn der gesamte Prozess vollständig abgeschlossen und vom Nutzer ausdrücklich bestätigt wurde.',
      },
      discoveredRequirements: {
        type: 'array',
        description: 'Neu entdeckte Anforderungen, die bisher im System nicht vorhanden sind.',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['new_field', 'new_rule', 'new_process', 'new_entity', 'unresolvable'],
            },
            description: { type: 'string' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            structuredData: { type: 'object' },
          },
          required: ['type', 'description', 'confidence'],
        },
      },
    },
    required: ['phaseComplete', 'workflowComplete'],
  },
}

/**
 * The system prompt suffix appended to EVERY AI chat system prompt.
 * Makes the AI aware of the Supervisor and the required tool call.
 */
export const SUPERVISOR_SYSTEM_SUFFIX = `

## Conversation Supervisor Engine

Du arbeitest innerhalb der OKUN Workflow Engine. Eine Conversation Supervisor Engine überwacht jede deiner Antworten.

**Pflichtregeln:**
1. Rufe am Ende JEDER Antwort das Tool \`workflow_status\` auf — ohne Ausnahme.
2. Wenn \`phaseComplete=false\`: Setze \`nextQuestion\` auf die konkrete nächste Frage.
3. Setze \`workflowComplete=true\` AUSSCHLIESSLICH wenn der Nutzer den Prozess ausdrücklich bestätigt hat.
4. Falls du während des Gesprächs neue Anforderungen erkennst, die im System noch nicht existieren, trage sie in \`discoveredRequirements\` ein.

Der Supervisor prüft deine Antwort vor der Zustellung. Fehlt eine Folgefrage obwohl der Prozess nicht abgeschlossen ist, wird der Supervisor automatisch eingreifen.`

/**
 * Extracts the workflow_status tool call result from an Anthropic response content array.
 * Returns null if the AI forgot to call the tool.
 */
export function extractWorkflowStatus(
  content: Array<{ type: string; name?: string; input?: unknown }>,
): WorkflowStatusCall | null {
  const block = content.find(b => b.type === 'tool_use' && b.name === 'workflow_status')
  if (!block) return null
  return block.input as WorkflowStatusCall
}

/**
 * Determines which phase in the workflow definition is currently active,
 * given the accumulated data from the conversation so far.
 */
export function resolveCurrentPhase(
  phases: import('./types').WorkflowPhase[],
  collectedData: Record<string, unknown>,
): import('./types').WorkflowPhase | null {
  // First phase whose exit condition is NOT yet met is the active one
  return phases.find(p => !p.exitCondition(collectedData)) ?? null
}
