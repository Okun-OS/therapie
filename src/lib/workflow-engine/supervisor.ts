// ─── Conversation Supervisor ───────────────────────────────────────────────────
//
// The Supervisor is the only component allowed to decide whether a workflow step
// may end. It receives the AI's raw reply plus its structured workflow_status
// output, cross-checks them against the deterministic exit conditions defined in
// the WorkflowDefinition, and either approves the reply as-is or injects a
// continuation question before the message reaches the user.
//
// Rules (in priority order):
//  1. If the deterministic exit condition says "not done" the Supervisor always
//     ensures the reply ends with a question — regardless of what the AI said.
//  2. If the AI provided a `nextQuestion` in its workflow_status call, that is
//     preferred over a generic fallback.
//  3. The Supervisor NEVER makes a second AI call — it only appends text.

import type { WorkflowPhase, WorkflowStatusCall, SupervisorResult } from './types'

/** Checks whether a string already contains at least one question */
function hasQuestion(text: string): boolean {
  return text.includes('?')
}

/**
 * Supervises a single AI turn.
 *
 * @param aiReply      Raw text the AI produced (may or may not contain a question)
 * @param status       Structured output from the AI's workflow_status tool call
 *                     (null if the AI forgot to call it — counts as intervention)
 * @param phase        Current phase definition (null for free-form chats with no phases)
 * @param collectedData Accumulated data from this conversation so far
 */
export function superviseTurn(
  aiReply: string,
  status: WorkflowStatusCall | null,
  phase: WorkflowPhase | null,
  collectedData: Record<string, unknown>,
): SupervisorResult {
  const trimmed = aiReply.trim()

  // ── 1. No phase = free-form chat (schedule edits, etc.) ────────────────────
  //    These chats don't have structured exit conditions.
  //    Only enforce: if AI says workflowComplete=false and no question → inject.
  if (!phase) {
    if (status?.workflowComplete === false && !hasQuestion(trimmed)) {
      const continuation = status?.nextQuestion ?? 'Wie kann ich Ihnen noch weiterhelfen?'
      return {
        supervisedReply: `${trimmed}\n\n${continuation}`,
        intervened: true,
        completionBlocked: false,
      }
    }
    return { supervisedReply: trimmed, intervened: false, completionBlocked: false }
  }

  // ── 2. Check deterministic exit condition ──────────────────────────────────
  const phaseActuallyDone = phase.exitCondition(collectedData)

  if (phaseActuallyDone) {
    // Phase genuinely complete — let reply through unchanged
    return { supervisedReply: trimmed, intervened: false, completionBlocked: false }
  }

  // ── 3. Phase NOT done yet ──────────────────────────────────────────────────
  //    Ensure the reply contains a follow-up question.
  if (hasQuestion(trimmed)) {
    // AI already asked something — accept as-is (content control belongs to AI)
    return { supervisedReply: trimmed, intervened: false, completionBlocked: false }
  }

  // AI reply has no question. Inject one.
  const injectedQuestion =
    status?.nextQuestion ??          // AI provided in structured output → prefer it
    phase.missingFieldQuestion(collectedData)  // fallback from phase definition

  return {
    supervisedReply: `${trimmed}\n\n${injectedQuestion}`,
    intervened: true,
    completionBlocked: false,
  }
}

/**
 * Validates that a workflow_complete signal is legitimate.
 * Returns { blocked: true, reason } if the completion should be rejected.
 */
export function validateCompletion(
  isActuallyComplete: (data: Record<string, unknown>) => boolean,
  collectedData: Record<string, unknown>,
  blockerMessage: string,
): { blocked: boolean; reply?: string } {
  if (isActuallyComplete(collectedData)) {
    return { blocked: false }
  }
  return { blocked: true, reply: blockerMessage }
}
