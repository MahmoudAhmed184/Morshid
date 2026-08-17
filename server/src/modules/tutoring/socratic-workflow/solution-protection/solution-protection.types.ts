import type {
  SolutionProtectionSource,
  SolutionProtectionStatus,
} from '../../tutoring-values'

export const SOLUTION_PROTECTION_POLICY_VERSION = 'solution-protection.v1'

export interface TopicSolutionProtection {
  readonly status: SolutionProtectionStatus
  readonly source: SolutionProtectionSource | null
  readonly policyVersion: string | null
  readonly establishedAt: Date | null
}

export interface OutputProtectionContext {
  readonly protectTargetSolution: boolean
  readonly topicId: string
  readonly source: SolutionProtectionSource
  readonly policyVersion: typeof SOLUTION_PROTECTION_POLICY_VERSION
}

export interface PersistedOutputProtectionDecision extends OutputProtectionContext {
  readonly explicitProtectedSolutionSignal: boolean
  readonly resolvedAt: Date
}
