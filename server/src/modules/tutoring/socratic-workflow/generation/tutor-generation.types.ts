import type {
  ExplanationDetailLevel,
  ReflectionMode,
  RevealPolicy,
  TeachingStrategy,
  TeachingTechnique,
} from '../../tutoring-values'
import type { AnalysisContextMessage } from '../analysis/analysis-context.types'
import type { PersistedEducationalAnalysisRecord } from '../analysis/educational-analysis.repository'
import type { CourseEvidenceChunk } from '../../../materials/interface/course-evidence'
import type { PersistedTeachingDecisionRecord } from '../teaching-decision/teaching-decision.repository'
import type { TopicRecord } from '../topic/topic.types'
import type { TopicStateSnapshot } from '../topic/topic-state.types'
import type { TUTOR_GENERATION_PROMPT_VERSION } from './tutor-prompt.definition'
import type { ValidationResult } from '../response-approval/response-validation.types'
import type { DebuggingGuidanceContext } from '../debugging-guidance/debugging-guidance.output-validator'

export const TUTOR_RESPONSE_INTENTS = [
  'GUIDED_EXPLANATION',
  'SOCRATIC_QUESTIONING',
  'MISCONCEPTION_REPAIR',
  'DEBUGGING_GUIDANCE',
] as const satisfies readonly TeachingStrategy[]

export const TUTOR_STUDENT_ACTION_TYPES = [
  'ORIENTATION_QUESTION',
  'FOCUSED_QUESTION',
  'DECOMPOSITION',
  'ANALOGY',
  'COMPARISON',
  'COUNTEREXAMPLE',
  'TRACE_EXECUTION',
  'BOUNDARY_CHECK',
  'SELF_EXPLANATION',
  'VERIFICATION',
] as const satisfies readonly TeachingTechnique[]

export const TUTOR_CANDIDATE_LIMITS = {
  maxMessageCodePoints: 2_400,
  maxStudentActionDescriptionCodePoints: 500,
  maxCitationIds: 12,
  maxCitationIdCodePoints: 160,
  maxHistoryMessages: 24,
  maxEvidenceChunks: 8,
  maxEvidenceContentCodePoints: 1_600,
} as const

export type TutorResponseIntent = (typeof TUTOR_RESPONSE_INTENTS)[number]
export type TutorStudentActionType = (typeof TUTOR_STUDENT_ACTION_TYPES)[number]

export interface TutorStudentAction {
  readonly type: TutorStudentActionType
  readonly description: string
}

export interface TutorSelfReportedCompliance {
  readonly finalAnswerRevealed: boolean
  readonly completeSolutionRevealed: boolean
}

export interface CandidateResponse {
  readonly message: string
  readonly responseIntent: TutorResponseIntent
  readonly usedCitationIds: readonly string[]
  readonly requiresStudentAction: boolean
  readonly studentAction: TutorStudentAction
  readonly reflectionIncluded: boolean
  readonly selfReportedCompliance: TutorSelfReportedCompliance
  readonly provider: string
  readonly model: string
  readonly promptVersion: typeof TUTOR_GENERATION_PROMPT_VERSION
  readonly tokenUsage: {
    readonly input: number
    readonly output: number
  }
}

export interface CandidateResponsePolicyContext {
  readonly allowedCitationIds: ReadonlySet<string>
  readonly requireGrounding: boolean
  readonly enforceCitationSupport: boolean
  readonly requireStudentAction: boolean
  readonly reflectionMode: ReflectionMode
}

export interface TutorEvidenceContext {
  readonly citationId: string
  readonly chunkId: string
  readonly materialId: string
  readonly materialTitle: string
  readonly chunkIndex: number
  readonly rank: number
  readonly content: string
}

export interface GenerationContextPackage {
  readonly attemptId: string
  readonly sessionId: string
  readonly courseId: string
  readonly topicId: string
  readonly studentMessage: AnalysisContextMessage
  readonly acceptedAnalysis: PersistedEducationalAnalysisRecord
  readonly teachingDecision: PersistedTeachingDecisionRecord
  readonly previousTeachingDecision: PersistedTeachingDecisionRecord | null
  readonly activeTopic: TopicRecord
  readonly topicState: TopicStateSnapshot | null
  readonly selectedHistory: readonly AnalysisContextMessage[]
  readonly retrievedEvidence: readonly TutorEvidenceContext[]
  readonly allowedCitationIds: readonly string[]
  readonly conversationLanguage: string | null
  readonly explanationDetailLevel: ExplanationDetailLevel
  readonly regeneration: TutorRegenerationContext | null
  readonly debuggingGuidance: DebuggingGuidanceContext | null
}

export interface TutorRegenerationContext {
  readonly promptVersion: 'tutor-regeneration.mvp.v1'
  readonly candidateAttempt: number
  readonly previousValidation: Pick<
    ValidationResult,
    'stage' | 'violations' | 'maximumSeverity'
  >
  readonly authoritativePolicy: {
    readonly teachingDecisionId: string
    readonly policyVersion: string
    readonly guidanceLevel: number
    readonly revealPolicy: RevealPolicy
    readonly guardPolicy: PersistedTeachingDecisionRecord['guardPolicy']
  }
}

export interface TutorGenerationInput {
  readonly courseId: string
  readonly sessionId: string
  readonly studentId: string
  readonly attemptId: string
  readonly studentMessageId: string
  readonly topicId: string
  readonly retrievalResult: readonly CourseEvidenceChunk[]
  readonly explanationDetailLevel?: ExplanationDetailLevel
  readonly debuggingGuidance?: DebuggingGuidanceContext
  readonly regeneration?: TutorRegenerationContext
  readonly signal?: AbortSignal
  readonly deadlineAt?: number
}

export const TUTOR_GENERATION_FAILURE_CODE = {
  MISSING_TEACHING_DECISION: 'MISSING_TEACHING_DECISION',
  MISSING_ACCEPTED_ANALYSIS: 'MISSING_ACCEPTED_ANALYSIS',
  INVALID_GENERATION_CONTEXT: 'INVALID_GENERATION_CONTEXT',
  RETRIEVAL_SCOPE_VIOLATION: 'RETRIEVAL_SCOPE_VIOLATION',
  TUTOR_PROVIDER_TIMEOUT: 'TUTOR_PROVIDER_TIMEOUT',
  TUTOR_PROVIDER_UNAVAILABLE: 'TUTOR_PROVIDER_UNAVAILABLE',
  TUTOR_PROVIDER_RATE_LIMIT: 'TUTOR_PROVIDER_RATE_LIMIT',
  TUTOR_PROVIDER_TRANSPORT: 'TUTOR_PROVIDER_TRANSPORT',
  TUTOR_MALFORMED_OUTPUT: 'TUTOR_MALFORMED_OUTPUT',
  TUTOR_INVALID_OUTPUT: 'TUTOR_INVALID_OUTPUT',
  TUTOR_INVALID_CITATION: 'TUTOR_INVALID_CITATION',
} as const

export type TutorGenerationFailureCode =
  (typeof TUTOR_GENERATION_FAILURE_CODE)[keyof typeof TUTOR_GENERATION_FAILURE_CODE]

export type TutorGenerationServiceResult =
  | {
      readonly success: true
      readonly candidate: CandidateResponse
      readonly educationalContext: TutorGuardEducationalContext
      readonly infrastructureRetryCount: number
    }
  | {
      readonly success: false
      readonly errorCode: TutorGenerationFailureCode
      readonly infrastructureRetryCount: number
    }

export interface TutorModelRequest {
  readonly messages: readonly [
    { readonly role: 'system'; readonly content: string },
    { readonly role: 'user'; readonly content: string },
  ]
  readonly promptVersion: typeof TUTOR_GENERATION_PROMPT_VERSION
  readonly responseSchemaName: 'CandidateResponse'
  readonly signal?: AbortSignal
}

export interface TutorGuardEducationalContext {
  readonly currentStudentMessage: {
    readonly id: string
    readonly content: string
  }
  readonly acceptedAnalysis: {
    readonly id: string
    readonly requestKind: PersistedEducationalAnalysisRecord['result']['requestKind']
    readonly studentState: PersistedEducationalAnalysisRecord['result']['studentState']
    readonly effortEvidence: PersistedEducationalAnalysisRecord['result']['effortEvidence']
    readonly learningEvidence: PersistedEducationalAnalysisRecord['result']['learningEvidence']
    readonly misconceptions: PersistedEducationalAnalysisRecord['result']['misconceptions']
    readonly evidenceReferences: PersistedEducationalAnalysisRecord['result']['evidenceReferences']
    readonly confidence: number
    readonly analysisSource: PersistedEducationalAnalysisRecord['analysisSource']
    readonly promptVersion: string
    readonly schemaVersion: string
  }
  readonly topicState: TopicStateSnapshot | null
  readonly previousTeachingDecision: PersistedTeachingDecisionRecord | null
  readonly currentTeachingDecision: {
    readonly id: string
    readonly policyVersion: string
    readonly guidanceLevel: number
    readonly revealPolicy: RevealPolicy
  }
  readonly recentConversation: readonly {
    readonly id: string
    readonly sequence: number
    readonly role: AnalysisContextMessage['role']
    readonly attemptId: string | null
    readonly topicId: string | null
    readonly content: string
  }[]
}

export interface TutorModelResponse {
  readonly rawOutput: unknown
  readonly provider: string
  readonly model: string
  readonly promptVersion: typeof TUTOR_GENERATION_PROMPT_VERSION
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly latencyMs?: number
}

export interface TutorModelPort {
  generate(request: TutorModelRequest): Promise<TutorModelResponse>
}

export const TUTOR_MODEL_PORT = Symbol('TutorModelPort')

export const TUTOR_MODEL_ERROR_CODE = {
  TIMEOUT: 'TUTOR_MODEL_TIMEOUT',
  RATE_LIMITED: 'TUTOR_MODEL_RATE_LIMITED',
  TRANSPORT_FAILURE: 'TUTOR_MODEL_TRANSPORT_FAILURE',
  PROVIDER_UNAVAILABLE: 'TUTOR_MODEL_PROVIDER_UNAVAILABLE',
  MALFORMED_OUTPUT: 'TUTOR_MODEL_MALFORMED_OUTPUT',
  UNSUPPORTED_RESPONSE: 'TUTOR_MODEL_UNSUPPORTED_RESPONSE',
  CANCELLED: 'TUTOR_MODEL_CANCELLED',
  CONFIGURATION_INVALID: 'TUTOR_MODEL_CONFIGURATION_INVALID',
} as const

export type TutorModelErrorCode =
  (typeof TUTOR_MODEL_ERROR_CODE)[keyof typeof TUTOR_MODEL_ERROR_CODE]

const TUTOR_MODEL_SAFE_ERROR_MESSAGES = {
  [TUTOR_MODEL_ERROR_CODE.TIMEOUT]: 'Tutor model timed out',
  [TUTOR_MODEL_ERROR_CODE.RATE_LIMITED]: 'Tutor model rate limit reached',
  [TUTOR_MODEL_ERROR_CODE.TRANSPORT_FAILURE]: 'Tutor model transport failed',
  [TUTOR_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE]:
    'Tutor model provider is unavailable',
  [TUTOR_MODEL_ERROR_CODE.MALFORMED_OUTPUT]:
    'Tutor model returned malformed structured output',
  [TUTOR_MODEL_ERROR_CODE.UNSUPPORTED_RESPONSE]:
    'Tutor model response is unsupported',
  [TUTOR_MODEL_ERROR_CODE.CANCELLED]: 'Tutor model call was cancelled',
  [TUTOR_MODEL_ERROR_CODE.CONFIGURATION_INVALID]:
    'Tutor model configuration is invalid',
} as const satisfies Record<TutorModelErrorCode, string>

export class TutorModelError extends Error {
  readonly code: TutorModelErrorCode
  readonly status: number | undefined
  readonly headers: Headers | undefined

  constructor(
    code: TutorModelErrorCode,
    metadata: { readonly status?: number; readonly headers?: Headers } = {},
  ) {
    super(TUTOR_MODEL_SAFE_ERROR_MESSAGES[code])
    Object.defineProperty(this, 'name', {
      configurable: true,
      value: 'TutorModelError',
    })
    this.code = code
    this.status = metadata.status
    this.headers = metadata.headers
  }
}

export function revealPolicyPreventsFinalAnswer(
  revealPolicy: RevealPolicy,
): boolean {
  return revealPolicy === 'NO_FINAL_ANSWER'
}
