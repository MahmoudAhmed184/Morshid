/**
 * Controllable test-only model ports for the Socratic E2E test suite.
 *
 * These are NOT production adapters. They are injected via module overrides
 * to give the E2E tests deterministic control over tutor generation and
 * semantic guard behavior without adding production hooks.
 */
import {
  MessageRequestKind,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
} from '../../src/generated/prisma/client'
import {
  type AnalysisModelPort,
  type AnalysisModelRequest,
  type AnalysisModelResponse,
} from '../../src/modules/tutoring/socratic-workflow/analysis-model.port'
import {
  type TutorModelPort,
  type TutorModelRequest,
  type TutorModelResponse,
} from '../../src/modules/tutoring/socratic-workflow/tutor-generation.types'
import {
  SEMANTIC_GUARD_PROMPT_VERSION,
  type SemanticGuardPort,
  type SemanticGuardRequest,
  type SemanticGuardModelResponse,
  SemanticGuardModelError,
  SEMANTIC_GUARD_ERROR_CODE,
} from '../../src/modules/tutoring/socratic-workflow/semantic-guard.types'

// ────────────────────────────────────────────────────────────────────────────
// Analysis Model Port — controllable educational analysis
// ────────────────────────────────────────────────────────────────────────────

export type AnalysisModelBehavior = (
  request: AnalysisModelRequest,
) => Promise<AnalysisModelResponse>

export class ControllableAnalysisModelPort implements AnalysisModelPort {
  behavior: AnalysisModelBehavior

  constructor() {
    this.behavior = (request) =>
      Promise.resolve(defaultAnalysisResponse(request))
  }

  analyze(request: AnalysisModelRequest): Promise<AnalysisModelResponse> {
    return this.behavior(request)
  }

  reset(): void {
    this.behavior = (request) =>
      Promise.resolve(defaultAnalysisResponse(request))
  }
}

export function misconceptionAnalysisResponse(
  request: AnalysisModelRequest,
): AnalysisModelResponse {
  const evidenceMessageId = extractCurrentMessageId(request)
  return analysisResponse(request, {
    requestKind: MessageRequestKind.CONCEPTUAL,
    studentState: StudentState.MISCONCEPTION,
    effortEvidence: {
      present: true,
      quality: 'MEANINGFUL',
      type: 'REASONING_ATTEMPT',
      addressesPreviousTutorAction: true,
      isRepeated: false,
      evidenceMessageIds: [evidenceMessageId],
    },
    learningEvidence: {
      present: false,
      strength: 'NONE',
      evidenceMessageIds: [],
    },
    misconceptions: [
      {
        code: 'REVERSE_ITERATION_ORDER',
        description:
          'The student believes normal Python list iteration starts from the final item and moves backward.',
        confidence: 0.98,
        evidenceMessageId,
      },
    ],
    topicRelation: 'CONTINUE_CURRENT_TOPIC',
    recommendedStrategy: TeachingStrategy.MISCONCEPTION_REPAIR,
    recommendedTechnique: TeachingTechnique.COUNTEREXAMPLE,
    recommendedGuidanceLevel: 1,
    confidence: 0.98,
    evidenceReferences: [evidenceMessageId],
  })
}

export function progressionAnalysisResponse(
  request: AnalysisModelRequest,
  input: {
    readonly meaningfulEffort: boolean
    readonly learningEvidence?: boolean
    readonly repeatedEffort?: boolean
    readonly addressesPreviousTutorAction?: boolean
  },
): AnalysisModelResponse {
  const evidenceMessageId = extractCurrentMessageId(request)
  const learningEvidence = input.learningEvidence ?? false

  return analysisResponse(request, {
    requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
    studentState: StudentState.PARTIAL_UNDERSTANDING,
    effortEvidence: input.meaningfulEffort
      ? {
          present: true,
          quality: 'MEANINGFUL',
          type: 'REASONING_ATTEMPT',
          addressesPreviousTutorAction:
            input.addressesPreviousTutorAction ?? true,
          isRepeated: input.repeatedEffort ?? false,
          evidenceMessageIds: [evidenceMessageId],
        }
      : {
          present: false,
          quality: 'NONE',
          type: null,
          addressesPreviousTutorAction:
            input.addressesPreviousTutorAction ?? false,
          isRepeated: input.repeatedEffort ?? false,
          evidenceMessageIds: [],
        },
    learningEvidence: learningEvidence
      ? {
          present: true,
          strength: 'STRONG',
          evidenceMessageIds: [evidenceMessageId],
        }
      : {
          present: false,
          strength: 'NONE',
          evidenceMessageIds: [],
        },
    misconceptions: [],
    topicRelation: 'CONTINUE_CURRENT_TOPIC',
    recommendedStrategy: TeachingStrategy.SOCRATIC_QUESTIONING,
    recommendedTechnique: TeachingTechnique.FOCUSED_QUESTION,
    recommendedGuidanceLevel: 1,
    confidence: 0.95,
    evidenceReferences: [evidenceMessageId],
  })
}

export function functionalStoryAnalysisResponse(
  request: AnalysisModelRequest,
  input: {
    readonly requestKind: MessageRequestKind
    readonly studentState: StudentState
    readonly recommendedStrategy: TeachingStrategy
    readonly recommendedTechnique: TeachingTechnique
    readonly meaningfulEffort?: boolean
    readonly repeatedEffort?: boolean
    readonly addressesPreviousTutorAction?: boolean
    readonly learningEvidenceStrength?: 'MODERATE' | 'STRONG'
    readonly misconception?: {
      readonly code: string
      readonly description: string
    }
  },
): AnalysisModelResponse {
  const evidenceMessageId = extractCurrentMessageId(request)
  const meaningfulEffort = input.meaningfulEffort ?? false

  return analysisResponse(request, {
    requestKind: input.requestKind,
    studentState: input.studentState,
    effortEvidence: meaningfulEffort
      ? {
          present: true,
          quality: 'MEANINGFUL',
          type: 'REASONING_ATTEMPT',
          addressesPreviousTutorAction:
            input.addressesPreviousTutorAction ?? true,
          isRepeated: input.repeatedEffort ?? false,
          evidenceMessageIds: [evidenceMessageId],
        }
      : {
          present: false,
          quality: 'NONE',
          type: null,
          addressesPreviousTutorAction:
            input.addressesPreviousTutorAction ?? false,
          isRepeated: input.repeatedEffort ?? false,
          evidenceMessageIds: [],
        },
    learningEvidence:
      input.learningEvidenceStrength === undefined
        ? {
            present: false,
            strength: 'NONE',
            evidenceMessageIds: [],
          }
        : {
            present: true,
            strength: input.learningEvidenceStrength,
            evidenceMessageIds: [evidenceMessageId],
          },
    misconceptions:
      input.misconception === undefined
        ? []
        : [
            {
              ...input.misconception,
              confidence: 0.96,
              evidenceMessageId,
            },
          ],
    topicRelation: 'CONTINUE_CURRENT_TOPIC',
    recommendedStrategy: input.recommendedStrategy,
    recommendedTechnique: input.recommendedTechnique,
    recommendedGuidanceLevel: 1,
    confidence: 0.96,
    evidenceReferences: [evidenceMessageId],
  })
}

function defaultAnalysisResponse(
  request: AnalysisModelRequest,
): AnalysisModelResponse {
  const evidenceMessageId = extractCurrentMessageId(request)
  return analysisResponse(request, {
    requestKind: MessageRequestKind.AMBIGUOUS,
    studentState: StudentState.UNKNOWN,
    effortEvidence: {
      present: false,
      quality: 'NONE',
      type: null,
      addressesPreviousTutorAction: false,
      isRepeated: false,
      evidenceMessageIds: [],
    },
    learningEvidence: {
      present: false,
      strength: 'NONE',
      evidenceMessageIds: [],
    },
    misconceptions: [],
    topicRelation: 'CONTINUE_CURRENT_TOPIC',
    recommendedStrategy: TeachingStrategy.SOCRATIC_QUESTIONING,
    recommendedTechnique: TeachingTechnique.ORIENTATION_QUESTION,
    recommendedGuidanceLevel: 1,
    confidence: 0.2,
    evidenceReferences: [evidenceMessageId],
  })
}

function analysisResponse(
  request: AnalysisModelRequest,
  rawOutput: Record<string, unknown>,
): AnalysisModelResponse {
  return Object.freeze({
    rawOutput: Object.freeze(rawOutput),
    provider: 'e2e-controllable-analysis',
    model: 'e2e-controllable-analysis-v1',
    modelVersion: 'e2e-controllable-analysis-v1',
    promptVersion: request.promptVersion,
    inputTokens: 80,
    outputTokens: 40,
  })
}

function extractCurrentMessageId(request: AnalysisModelRequest): string {
  const content = request.messages[1].content
  const match = /"studentMessage":\{"id":"(?<messageId>[^"]+)"/u.exec(content)
  return match?.groups?.messageId ?? 'analysis-context-message'
}

// ────────────────────────────────────────────────────────────────────────────
// Tutor Model Port — controllable generation
// ────────────────────────────────────────────────────────────────────────────

/**
 * A valid raw CandidateResponse that passes structural validation AND
 * deterministic guard checks for the deterministic analysis model's
 * default teaching decision (SOCRATIC_QUESTIONING / ORIENTATION_QUESTION).
 *
 * rawOutput must NOT contain backend-owned keys: provider, model,
 * promptVersion, tokenUsage. The schema validator rejects them.
 */
export function validCandidateRawOutput(
  allowedCitationIds: readonly string[] = [],
): Record<string, unknown> {
  return {
    message:
      'What part of the list comprehension syntax are you most unsure about? Try writing just the expression part first.',
    responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
    usedCitationIds: [...allowedCitationIds],
    requiresStudentAction: true,
    studentAction: {
      type: TeachingTechnique.FOCUSED_QUESTION,
      description:
        'Ask the student to identify which part of the syntax they find confusing and try writing just the expression.',
    },
    reflectionIncluded: false,
    selfReportedCompliance: {
      finalAnswerRevealed: false,
      completeSolutionRevealed: false,
    },
  }
}

/**
 * A raw candidate that will FAIL the deterministic guard (responseIntent
 * mismatch), triggering regeneration when used as attempt #1.
 */
export function rejectedCandidateRawOutput(
  allowedCitationIds: readonly string[] = [],
): Record<string, unknown> {
  return {
    message: 'Can you trace through the code and predict the output?',
    // Mismatched intent: the deterministic analysis model always
    // chooses SOCRATIC_QUESTIONING; using DEBUGGING_GUIDANCE will
    // trigger a RESPONSE_INTENT_MISMATCH violation.
    responseIntent: TeachingStrategy.DEBUGGING_GUIDANCE,
    usedCitationIds: [...allowedCitationIds],
    requiresStudentAction: true,
    studentAction: {
      // Also mismatched technique
      type: TeachingTechnique.TRACE_EXECUTION,
      description:
        'Ask the student to trace through the code step by step and predict the output.',
    },
    reflectionIncluded: false,
    selfReportedCompliance: {
      finalAnswerRevealed: false,
      completeSolutionRevealed: false,
    },
  }
}

export type TutorModelBehavior = (
  request: TutorModelRequest,
) => Promise<TutorModelResponse>

export class ControllableTutorModelPort implements TutorModelPort {
  behavior: TutorModelBehavior
  callCount = 0
  private readonly calls: TutorModelRequest[] = []

  constructor() {
    this.behavior = (request) => Promise.resolve(defaultTutorResponse(request))
  }

  async generate(request: TutorModelRequest): Promise<TutorModelResponse> {
    this.callCount += 1
    this.calls.push(request)
    return this.behavior(request)
  }

  /** Extracts the allowed citation IDs from the user prompt. */
  extractAllowedCitationIds(request: TutorModelRequest): readonly string[] {
    const userContent = request.messages[1].content
    const match = /"allowedCitationIds":\[(?<ids>(?:"[^"]*"(?:,)?)*)\]/u.exec(
      userContent,
    )
    if (match?.groups?.ids === undefined || match.groups.ids.trim() === '') {
      return []
    }

    try {
      const parsed: unknown = JSON.parse(`[${match.groups.ids}]`)
      return Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string')
        : []
    } catch {
      return []
    }
  }

  reset(): void {
    this.callCount = 0
    this.calls.length = 0
    this.behavior = (request) => Promise.resolve(defaultTutorResponse(request))
  }

  getCalls(): readonly TutorModelRequest[] {
    return this.calls
  }
}

function defaultTutorResponse(request: TutorModelRequest): TutorModelResponse {
  const citationIds = extractAllowedCitationIdsFromPrompt(request)
  return Object.freeze({
    rawOutput: Object.freeze(validCandidateRawOutput(citationIds)),
    provider: 'e2e-controllable-tutor',
    model: 'e2e-controllable-tutor-v1',
    promptVersion: request.promptVersion,
    inputTokens: 100,
    outputTokens: 50,
  })
}

function extractAllowedCitationIdsFromPrompt(
  request: TutorModelRequest,
): readonly string[] {
  const userContent = request.messages[1].content
  const match = /"allowedCitationIds":\[(?<ids>(?:"[^"]*"(?:,)?)*)\]/u.exec(
    userContent,
  )
  if (match?.groups?.ids === undefined || match.groups.ids.trim() === '') {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(`[${match.groups.ids}]`)
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : []
  } catch {
    return []
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Semantic Guard Port — controllable evaluation
// ────────────────────────────────────────────────────────────────────────────

export type SemanticGuardBehavior = (
  request: SemanticGuardRequest,
) => Promise<SemanticGuardModelResponse>

export class ControllableSemanticGuardPort implements SemanticGuardPort {
  behavior: SemanticGuardBehavior
  callCount = 0
  private readonly calls: SemanticGuardRequest[] = []

  constructor() {
    this.behavior = () => Promise.resolve(approvedSemanticGuardResponse())
  }

  async evaluate(
    request: SemanticGuardRequest,
  ): Promise<SemanticGuardModelResponse> {
    this.callCount += 1
    this.calls.push(request)
    return this.behavior(request)
  }

  reset(): void {
    this.callCount = 0
    this.calls.length = 0
    this.behavior = () => Promise.resolve(approvedSemanticGuardResponse())
  }

  getCalls(): readonly SemanticGuardRequest[] {
    return this.calls
  }
}

export function approvedSemanticGuardResponse(): SemanticGuardModelResponse {
  return Object.freeze({
    rawOutput: Object.freeze({
      approved: true,
      violations: Object.freeze([]),
    }),
    provider: 'e2e-controllable-semantic-guard',
    model: 'e2e-controllable-semantic-guard-v1',
    promptVersion: SEMANTIC_GUARD_PROMPT_VERSION,
    inputTokens: 80,
    outputTokens: 20,
  })
}

export function rejectedSemanticGuardResponse(
  violationType = 'SEMANTIC_POLICY_VIOLATION',
): SemanticGuardModelResponse {
  return Object.freeze({
    rawOutput: Object.freeze({
      approved: false,
      violations: Object.freeze([
        Object.freeze({
          type: violationType,
          severity: 'HIGH',
          field: 'message',
          evidence: 'Candidate is too direct for the guard policy.',
          regenerationInstruction:
            'Remove direct answer disclosure and ask for one student reasoning step.',
        }),
      ]),
    }),
    provider: 'e2e-controllable-semantic-guard',
    model: 'e2e-controllable-semantic-guard-v1',
    promptVersion: SEMANTIC_GUARD_PROMPT_VERSION,
    inputTokens: 80,
    outputTokens: 20,
  })
}

export function failingSemanticGuardBehavior(): SemanticGuardBehavior {
  return () =>
    Promise.reject(
      new SemanticGuardModelError(SEMANTIC_GUARD_ERROR_CODE.TRANSPORT_FAILURE),
    )
}

// ────────────────────────────────────────────────────────────────────────────
// Deferred Promise — deterministic concurrency gate
// ────────────────────────────────────────────────────────────────────────────

export interface DeferredPromise<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
  reject(error: Error): void
}

export function createDeferredPromise<T>(): DeferredPromise<T> {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
