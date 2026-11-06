import type { WorkflowDefinition } from '../types'
import { OrgOnboardingWorkflow } from './org-onboarding'
import { LocationOnboardingWorkflow } from './location-onboarding'
import { EmployeeCreationWorkflow } from './employee-creation'

const REGISTRY: Record<string, WorkflowDefinition> = {
  [OrgOnboardingWorkflow.id]: OrgOnboardingWorkflow,
  [LocationOnboardingWorkflow.id]: LocationOnboardingWorkflow,
  [EmployeeCreationWorkflow.id]: EmployeeCreationWorkflow,
}

export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return REGISTRY[id]
}

export { OrgOnboardingWorkflow, LocationOnboardingWorkflow, EmployeeCreationWorkflow }
