/**
 * Controllable test-only model ports for the Socratic E2E test suite.
 *
 * These are NOT production adapters. They are injected via module overrides
 * to give the E2E tests deterministic control over tutor generation and
 * semantic guard behavior without adding production hooks.
 */
import {
  TeachingStrategy,
  TeachingTechnique,
} from '../../src/generated/prisma/client'
import {
  type TutorModelPort,
  type TutorModelRequest,
  type TutorModelResponse,
} from '../../src/modules/socratic-tutor/tutor-generation.types'
import {
  SEMANTIC_GUARD_PROMPT_VERSION,
  type SemanticGuardPort,
  type SemanticGuardRequest,
  type SemanticGuardModelResponse,
  SemanticGuardModelError,
  SEMANTIC_GUARD_ERROR_CODE,
} from '../../src/modules/socratic-tutor/semantic-guard.types'

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
export function rejectedCandidateRawOutput(): Record<string, unknown> {
  return {
    message: 'Can you trace through the code and predict the output?',
    // Mismatched intent: the deterministic analysis model always
    // chooses SOCRATIC_QUESTIONING; using DEBUGGING_GUIDANCE will
    // trigger a RESPONSE_INTENT_MISMATCH violation.
    responseIntent: TeachingStrategy.DEBUGGING_GUIDANCE,
    usedCitationIds: [],
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

  constructor() {
    this.behavior = () => Promise.resolve(approvedSemanticGuardResponse())
  }

  async evaluate(
    request: SemanticGuardRequest,
  ): Promise<SemanticGuardModelResponse> {
    return this.behavior(request)
  }

  reset(): void {
    this.behavior = () => Promise.resolve(approvedSemanticGuardResponse())
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

export function rejectedSemanticGuardResponse(): SemanticGuardModelResponse {
  return Object.freeze({
    rawOutput: Object.freeze({
      approved: false,
      violations: Object.freeze([
        Object.freeze({
          type: 'SEMANTIC_POLICY_VIOLATION',
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
