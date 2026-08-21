import type {
  ReflectionMode,
  RevealPolicy,
  TeachingStrategy,
} from '../../tutoring-values'
import type { CandidateResponse } from '../generation/tutor-generation.types'
import type { DebuggingGuidanceContext } from '../debugging-guidance/debugging-guidance.output-validator'
import type { StudentActionObligation } from '../teaching-decision/student-action-obligation'

export const MVP_RESPONSE_VALIDATION_POLICY_VERSION =
  'response-validation.mvp.v3'
export const MAX_MVP_CANDIDATE_ATTEMPTS = 3

export const RESPONSE_VALIDATION_STAGE = {
  STRUCTURAL: 'STRUCTURAL',
  DETERMINISTIC: 'DETERMINISTIC',
  SEMANTIC: 'SEMANTIC',
} as const

export type ResponseValidationStage =
  (typeof RESPONSE_VALIDATION_STAGE)[keyof typeof RESPONSE_VALIDATION_STAGE]

export const RESPONSE_VALIDATION_ACTION = {
  APPROVE: 'APPROVE',
  REGENERATE: 'REGENERATE',
  USE_SAFE_FALLBACK: 'USE_SAFE_FALLBACK',
} as const

export type ResponseValidationAction =
  (typeof RESPONSE_VALIDATION_ACTION)[keyof typeof RESPONSE_VALIDATION_ACTION]

export const RESPONSE_VALIDATION_SEVERITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const

export type ResponseValidationSeverity =
  (typeof RESPONSE_VALIDATION_SEVERITY)[keyof typeof RESPONSE_VALIDATION_SEVERITY]

export const RESPONSE_VIOLATION_TYPE = {
  MALFORMED_RESPONSE: 'MALFORMED_RESPONSE',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_ENUM_VALUE: 'INVALID_ENUM_VALUE',
  MESSAGE_TOO_LONG: 'MESSAGE_TOO_LONG',
  INVALID_STUDENT_ACTION: 'INVALID_STUDENT_ACTION',
  INVALID_CITATION: 'INVALID_CITATION',
  DUPLICATE_CITATION: 'DUPLICATE_CITATION',
  DIRECT_ANSWER_DISCLOSURE: 'DIRECT_ANSWER_DISCLOSURE',
  FINAL_ANSWER_DISCLOSURE: 'FINAL_ANSWER_DISCLOSURE',
  COMPLETE_SOLUTION_DISCLOSURE: 'COMPLETE_SOLUTION_DISCLOSURE',
  SUBMISSION_READY_CODE: 'SUBMISSION_READY_CODE',
  CODE_LEAKAGE: 'CODE_LEAKAGE',
  EXCESSIVE_DISCLOSED_STEPS: 'EXCESSIVE_DISCLOSED_STEPS',
  GUIDANCE_LEVEL_VIOLATION: 'GUIDANCE_LEVEL_VIOLATION',
  REVEAL_POLICY_VIOLATION: 'REVEAL_POLICY_VIOLATION',
  MISSING_REQUIRED_STUDENT_ACTION: 'MISSING_REQUIRED_STUDENT_ACTION',
  MISSING_STUDENT_REASONING: 'MISSING_STUDENT_REASONING',
  RESPONSE_INTENT_MISMATCH: 'RESPONSE_INTENT_MISMATCH',
  TECHNIQUE_MISMATCH: 'TECHNIQUE_MISMATCH',
  DEBUGGING_GUIDANCE_CONTRACT: 'DEBUGGING_GUIDANCE_CONTRACT',
  DEBUGGING_MISSING_GUIDANCE: 'DEBUGGING_MISSING_GUIDANCE',
  DEBUGGING_MISSING_DIAGNOSIS: 'DEBUGGING_MISSING_DIAGNOSIS',
  DEBUGGING_EMPTY_DIAGNOSIS: 'DEBUGGING_EMPTY_DIAGNOSIS',
  DEBUGGING_MISSING_RELEVANT_LOCATION: 'DEBUGGING_MISSING_RELEVANT_LOCATION',
  DEBUGGING_EMPTY_RELEVANT_LOCATION: 'DEBUGGING_EMPTY_RELEVANT_LOCATION',
  DEBUGGING_MISSING_CONCEPT: 'DEBUGGING_MISSING_CONCEPT',
  DEBUGGING_EMPTY_CONCEPT: 'DEBUGGING_EMPTY_CONCEPT',
  DEBUGGING_MISSING_AUTHORIZED_CITATION:
    'DEBUGGING_MISSING_AUTHORIZED_CITATION',
  DEBUGGING_INVALID_AUTHORIZED_CITATION:
    'DEBUGGING_INVALID_AUTHORIZED_CITATION',
  DEBUGGING_RENDERED_CITATION_MISMATCH: 'DEBUGGING_RENDERED_CITATION_MISMATCH',
  DEBUGGING_MISSING_STUDENT_ACTION: 'DEBUGGING_MISSING_STUDENT_ACTION',
  DEBUGGING_MULTIPLE_STUDENT_ACTIONS: 'DEBUGGING_MULTIPLE_STUDENT_ACTIONS',
  DEBUGGING_INVALID_STUDENT_ACTION: 'DEBUGGING_INVALID_STUDENT_ACTION',
  DEBUGGING_STUDENT_ACTION_MISMATCH: 'DEBUGGING_STUDENT_ACTION_MISMATCH',
  DEBUGGING_RENDERED_RESPONSE_MISMATCH: 'DEBUGGING_RENDERED_RESPONSE_MISMATCH',
  GROUNDING_VIOLATION: 'GROUNDING_VIOLATION',
  SEMANTIC_POLICY_VIOLATION: 'SEMANTIC_POLICY_VIOLATION',
  GUARD_MALFORMED_OUTPUT: 'GUARD_MALFORMED_OUTPUT',
  GUARD_UNAVAILABLE: 'GUARD_UNAVAILABLE',
} as const

export type ResponseViolationType =
  (typeof RESPONSE_VIOLATION_TYPE)[keyof typeof RESPONSE_VIOLATION_TYPE]

export interface ResponseValidationViolation {
  readonly type: ResponseViolationType
  readonly severity: ResponseValidationSeverity
  readonly field: string | null
  readonly evidence: string
  readonly regenerationInstruction: string
}

export interface ValidationResult {
  readonly stage: ResponseValidationStage
  readonly approved: boolean
  readonly violations: readonly ResponseValidationViolation[]
  readonly maximumSeverity: ResponseValidationSeverity | null
  readonly recommendedAction: ResponseValidationAction
  readonly provider: string | null
  readonly model: string | null
  readonly promptVersion: string | null
  readonly policyVersion: typeof MVP_RESPONSE_VALIDATION_POLICY_VERSION
}

export interface CandidateValidationContext {
  readonly allowedCitationIds: ReadonlySet<string>
  readonly requireGrounding: boolean
  readonly enforceCitationSupport: boolean
  readonly reflectionMode: ReflectionMode
  readonly responseIntent: TeachingStrategy
  readonly studentActionObligation: StudentActionObligation
  readonly guidanceLevel: number
  readonly revealPolicy: RevealPolicy
  readonly maximumDisclosedSteps: number
  readonly debuggingGuidance?: DebuggingGuidanceContext
  readonly debuggingGuidanceRequired?: boolean
  readonly givenPremises?: ReadonlySet<string>
  readonly targetVariables?: ReadonlySet<string>
}

export const APPROVED_RESPONSE_SOURCE = {
  VALIDATED_CANDIDATE: 'VALIDATED_CANDIDATE',
  SAFE_FALLBACK: 'SAFE_FALLBACK',
} as const

export type ApprovedResponseSource =
  (typeof APPROVED_RESPONSE_SOURCE)[keyof typeof APPROVED_RESPONSE_SOURCE]

export interface ApprovedResponse {
  readonly message: string
  readonly responseIntent: CandidateResponse['responseIntent']
  readonly usedCitationIds: readonly string[]
  readonly requiresStudentAction: boolean
  readonly studentAction: CandidateResponse['studentAction']
  readonly reflectionIncluded: boolean
  readonly source: ApprovedResponseSource
  readonly approvedCandidateAttempt: number | null
  readonly safeFallbackUsed: boolean
  readonly approvalMetadata: {
    readonly provider: string | null
    readonly model: string | null
    readonly promptVersion: string
    readonly inputTokens: number
    readonly outputTokens: number
    readonly validationPolicyVersion: typeof MVP_RESPONSE_VALIDATION_POLICY_VERSION
    readonly structuralApproved: boolean
    readonly deterministicApproved: boolean
    readonly semanticApproved: boolean | null
  }
}

export function approvedValidationResult(
  stage: ResponseValidationStage,
  metadata: {
    readonly provider?: string | null
    readonly model?: string | null
    readonly promptVersion?: string | null
  } = {},
): ValidationResult {
  return Object.freeze({
    stage,
    approved: true,
    violations: Object.freeze([]),
    maximumSeverity: null,
    recommendedAction: RESPONSE_VALIDATION_ACTION.APPROVE,
    provider: metadata.provider ?? null,
    model: metadata.model ?? null,
    promptVersion: metadata.promptVersion ?? null,
    policyVersion: MVP_RESPONSE_VALIDATION_POLICY_VERSION,
  })
}

export function rejectedValidationResult(
  stage: ResponseValidationStage,
  violations: readonly ResponseValidationViolation[],
  recommendedAction: Exclude<
    ResponseValidationAction,
    typeof RESPONSE_VALIDATION_ACTION.APPROVE
  >,
  metadata: {
    readonly provider?: string | null
    readonly model?: string | null
    readonly promptVersion?: string | null
  } = {},
): ValidationResult {
  return Object.freeze({
    stage,
    approved: false,
    violations: Object.freeze([...violations]),
    maximumSeverity: maximumSeverity(violations),
    recommendedAction,
    provider: metadata.provider ?? null,
    model: metadata.model ?? null,
    promptVersion: metadata.promptVersion ?? null,
    policyVersion: MVP_RESPONSE_VALIDATION_POLICY_VERSION,
  })
}

function maximumSeverity(
  violations: readonly ResponseValidationViolation[],
): ResponseValidationSeverity | null {
  let current: ResponseValidationSeverity | null = null
  for (const violation of violations) {
    if (
      current === null ||
      severityRank(violation.severity) > severityRank(current)
    ) {
      current = violation.severity
    }
  }
  return current
}

function severityRank(severity: ResponseValidationSeverity): number {
  switch (severity) {
    case RESPONSE_VALIDATION_SEVERITY.LOW:
      return 1
    case RESPONSE_VALIDATION_SEVERITY.MEDIUM:
      return 2
    case RESPONSE_VALIDATION_SEVERITY.HIGH:
      return 3
    case RESPONSE_VALIDATION_SEVERITY.CRITICAL:
      return 4
  }
}
