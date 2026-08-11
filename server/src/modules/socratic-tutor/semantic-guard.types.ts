import type { TeachingGuardPolicy } from './teaching-policy.types'
import type {
  CandidateResponse,
  TutorGuardEducationalContext,
  TutorEvidenceContext,
} from './tutor-generation.types'
import type {
  CandidateValidationContext,
  ResponseValidationViolation,
  ValidationResult,
} from './response-validation.types'

export const SEMANTIC_GUARD_PORT = Symbol('SemanticGuardPort')
export const SEMANTIC_GUARD_PROMPT_VERSION = 'semantic-guard.mvp.v6'

export const SEMANTIC_GUARD_ERROR_CODE = {
  TIMEOUT: 'SEMANTIC_GUARD_TIMEOUT',
  RATE_LIMITED: 'SEMANTIC_GUARD_RATE_LIMIT',
  TRANSPORT_FAILURE: 'SEMANTIC_GUARD_TRANSPORT',
  PROVIDER_UNAVAILABLE: 'SEMANTIC_GUARD_UNAVAILABLE',
  MALFORMED_OUTPUT: 'SEMANTIC_GUARD_MALFORMED_OUTPUT',
  UNSUPPORTED_RESPONSE: 'SEMANTIC_GUARD_MALFORMED_OUTPUT',
  CANCELLED: 'SEMANTIC_GUARD_UNAVAILABLE',
  CONFIGURATION_INVALID: 'SEMANTIC_GUARD_UNAVAILABLE',
} as const

export type SemanticGuardErrorCode =
  (typeof SEMANTIC_GUARD_ERROR_CODE)[keyof typeof SEMANTIC_GUARD_ERROR_CODE]

export class SemanticGuardModelError extends Error {
  readonly code: SemanticGuardErrorCode
  readonly status: number | undefined
  readonly headers: Headers | undefined

  constructor(
    code: SemanticGuardErrorCode,
    metadata: { readonly status?: number; readonly headers?: Headers } = {},
  ) {
    super('Semantic guard model failure')
    Object.defineProperty(this, 'name', {
      configurable: true,
      value: 'SemanticGuardModelError',
    })
    this.code = code
    this.status = metadata.status
    this.headers = metadata.headers
  }
}

export interface SemanticGuardRequest {
  readonly messages: readonly [
    { readonly role: 'system'; readonly content: string },
    { readonly role: 'user'; readonly content: string },
  ]
  readonly promptVersion: typeof SEMANTIC_GUARD_PROMPT_VERSION
  readonly responseSchemaName: 'SemanticGuardResult'
  readonly signal?: AbortSignal
}

export interface SemanticGuardModelResponse {
  readonly rawOutput: unknown
  readonly provider: string
  readonly model: string
  readonly promptVersion: typeof SEMANTIC_GUARD_PROMPT_VERSION
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly latencyMs?: number
}

export interface SemanticGuardPort {
  evaluate(request: SemanticGuardRequest): Promise<SemanticGuardModelResponse>
}

export interface SemanticGuardEvaluationInput {
  readonly turnId: string
  readonly topicId: string
  readonly courseId: string
  readonly candidateAttempt: number
  readonly candidate: CandidateResponse
  readonly educationalContext: TutorGuardEducationalContext
  readonly validationContext: CandidateValidationContext
  readonly guardPolicy: TeachingGuardPolicy
  readonly allowedCitationSummaries: readonly TutorEvidenceContext[]
  readonly signal?: AbortSignal
  readonly deadlineAt?: number
}

export type SemanticGuardServiceResult =
  | {
      readonly kind: 'validated'
      readonly result: ValidationResult
    }
  | {
      readonly kind: 'infrastructure_failure'
      readonly errorCode: SemanticGuardErrorCode
      readonly result: ValidationResult
    }

export interface SemanticGuardOutput {
  readonly approved: boolean
  readonly violations: readonly ResponseValidationViolation[]
}
