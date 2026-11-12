// ─── OKUN Workflow Engine — Core Types ────────────────────────────────────────
//
// The engine is split into three concerns:
//   1. Workflow Engine   — controls phase progression and completion
//   2. Conversation Engine (the AI) — handles language and extraction
//   3. Supervisor        — validates AI output, injects continuations
//
// The key rule: the Workflow Engine owns exit decisions.
// The AI may suggest phaseComplete/workflowComplete, but the Supervisor
// always validates against deterministic exit conditions before accepting them.

export interface WorkflowPhase {
  id: string
  name: string
  /** Deterministic check — true means the Supervisor allows phase exit */
  exitCondition: (collectedData: Record<string, unknown>) => boolean
  /** Fallback question injected when AI forgets to ask one */
  missingFieldQuestion: (collectedData: Record<string, unknown>) => string
}

export interface WorkflowDefinition {
  id: string
  name: string
  phases: WorkflowPhase[]
  /** Final gate — called when AI says workflowComplete=true */
  isActuallyComplete: (collectedData: Record<string, unknown>) => boolean
}

/** Structured output the AI MUST provide via the workflow_status tool */
export interface WorkflowStatusCall {
  phaseComplete: boolean
  /** Required when phaseComplete=false and workflowComplete=false */
  nextQuestion?: string
  workflowComplete: boolean
  discoveredRequirements?: DiscoveredRequirement[]
}

export interface DiscoveredRequirement {
  type: 'new_field' | 'new_rule' | 'new_process' | 'new_entity' | 'unresolvable'
  description: string
  confidence: 'high' | 'medium' | 'low'
  structuredData?: Record<string, unknown>
}

export interface SupervisorResult {
  supervisedReply: string
  intervened: boolean
  completionBlocked: boolean
}

/** Available modules the Module Engine can suggest */
export interface ModuleDefinition {
  id: string
  name: string
  description: string
  triggers: string[]
}
