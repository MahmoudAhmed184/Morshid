import {
  ReflectionMode,
  RevealPolicy,
  TeachingStrategy,
  TeachingTechnique,
} from '../../generated/prisma/client'
import { RESPONSE_VALIDATION_ACTION } from './response-validation.types'
import { SemanticGuardService } from './semantic-guard.service'
import {
  SEMANTIC_GUARD_ERROR_CODE,
  SEMANTIC_GUARD_PROMPT_VERSION,
  SemanticGuardModelError,
  type SemanticGuardEvaluationInput,
  type SemanticGuardModelResponse,
  type SemanticGuardPort,
  type SemanticGuardRequest,
} from './semantic-guard.types'
import type { CandidateResponse } from './tutor-generation.types'

describe('SemanticGuardService', () => {
  it('uses only the independent SemanticGuardPort and attaches backend metadata', async () => {
    const guard = new FakeSemanticGuardPort({ approved: true, violations: [] })
    const tutorGenerate = jest.fn()
    const analysisAnalyze = jest.fn()

    const result = await new SemanticGuardService(guard).evaluate(input())

    expect(result.kind).toBe('validated')
    expect(result.result).toMatchObject({
      approved: true,
      provider: 'deterministic',
      model: 'semantic-guard-test',
      promptVersion: SEMANTIC_GUARD_PROMPT_VERSION,
    })
    expect(guard.requests).toHaveLength(1)
    expect(tutorGenerate).not.toHaveBeenCalled()
    expect(analysisAnalyze).not.toHaveBeenCalled()
  })

  it('returns semantic rejection with backend-owned metadata', async () => {
    const result = await new SemanticGuardService(
      new FakeSemanticGuardPort({
        approved: false,
        violations: [
          {
            type: 'SEMANTIC_POLICY_VIOLATION',
            severity: 'HIGH',
            field: 'message',
            evidence: 'Too direct.',
            regenerationInstruction: 'Ask one smaller question.',
          },
        ],
      }),
    ).evaluate(input())

    expect(result.kind).toBe('validated')
    expect(result.result).toMatchObject({
      approved: false,
      recommendedAction: RESPONSE_VALIDATION_ACTION.REGENERATE,
    })
  })

  it.each([
    [
      'malformed output',
      { notApproved: true },
      'SEMANTIC_GUARD_MALFORMED_OUTPUT',
    ],
    [
      'timeout',
      new SemanticGuardModelError(SEMANTIC_GUARD_ERROR_CODE.TIMEOUT),
      'SEMANTIC_GUARD_TIMEOUT',
    ],
    [
      'transport',
      new SemanticGuardModelError(SEMANTIC_GUARD_ERROR_CODE.TRANSPORT_FAILURE),
      'SEMANTIC_GUARD_TRANSPORT',
    ],
    [
      'rate limit',
      new SemanticGuardModelError(SEMANTIC_GUARD_ERROR_CODE.RATE_LIMITED),
      'SEMANTIC_GUARD_RATE_LIMIT',
    ],
    [
      'unavailable',
      new SemanticGuardModelError(
        SEMANTIC_GUARD_ERROR_CODE.PROVIDER_UNAVAILABLE,
      ),
      'SEMANTIC_GUARD_UNAVAILABLE',
    ],
  ])('fails closed on %s', async (_name, outputOrError, errorCode) => {
    const guard =
      outputOrError instanceof Error
        ? new FakeSemanticGuardPort(outputOrError)
        : new FakeSemanticGuardPort(outputOrError)

    const result = await new SemanticGuardService(guard).evaluate(input())

    expect(result.kind).toBe('infrastructure_failure')
    if (result.kind === 'infrastructure_failure') {
      expect(result.errorCode).toBe(errorCode)
    }
    expect(result.result.recommendedAction).toBe(
      RESPONSE_VALIDATION_ACTION.USE_SAFE_FALLBACK,
    )
  })
})

class FakeSemanticGuardPort implements SemanticGuardPort {
  readonly requests: SemanticGuardRequest[] = []

  constructor(private readonly outputOrError: unknown) {}

  evaluate(request: SemanticGuardRequest): Promise<SemanticGuardModelResponse> {
    this.requests.push(request)
    if (this.outputOrError instanceof Error) {
      return Promise.reject(this.outputOrError)
    }
    return Promise.resolve({
      rawOutput: this.outputOrError,
      provider: 'deterministic',
      model: 'semantic-guard-test',
      promptVersion: SEMANTIC_GUARD_PROMPT_VERSION,
    })
  }
}

function input(
  patch: Partial<SemanticGuardEvaluationInput> = {},
): SemanticGuardEvaluationInput {
  return {
    turnId: 'turn-1',
    topicId: 'topic-1',
    courseId: 'course-1',
    candidateAttempt: 1,
    candidate: candidate(),
    educationalContext: {
      currentStudentMessage: {
        id: 'message-1',
        content:
          'I think iteration begins at the final item and moves backward.',
      },
      acceptedAnalysis: {
        requestKind: 'CONCEPTUAL',
        studentState: 'MISCONCEPTION',
        misconceptions: [
          {
            code: 'REVERSE_ITERATION',
            description:
              'The student believes normal collection iteration moves from the final item backward.',
            confidence: 0.95,
            evidenceMessageId: 'message-1',
          },
        ],
      },
      recentConversation: [
        {
          role: 'ASSISTANT',
          content: 'Trace the collection and predict the next value.',
        },
      ],
    },
    validationContext: {
      allowedCitationIds: new Set(['retrieval.rank.1']),
      requireStudentAction: true,
      reflectionMode: ReflectionMode.NONE,
      responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
      primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
      guidanceLevel: 1,
      revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
      maximumDisclosedSteps: 1,
    },
    guardPolicy: {
      preventDirectAnswer: true,
      preventFinalResult: true,
      preventCompleteSolution: true,
      preventSubmissionReadyCode: true,
      requireStudentReasoning: true,
      requireGrounding: true,
      enforceCitationSupport: true,
      maximumDisclosedSteps: 1,
    },
    allowedCitationSummaries: [],
    ...patch,
  }
}

function candidate(): CandidateResponse {
  return {
    message: 'What changes first in the loop?',
    responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
    usedCitationIds: [],
    requiresStudentAction: true,
    studentAction: {
      type: TeachingTechnique.ORIENTATION_QUESTION,
      description: 'Ask for one reasoning step.',
    },
    reflectionIncluded: false,
    selfReportedCompliance: {
      finalAnswerRevealed: false,
      completeSolutionRevealed: false,
    },
    provider: 'deterministic',
    model: 'deterministic-tutor',
    promptVersion: 'tutor-generation.mvp.v1',
    tokenUsage: { input: 0, output: 0 },
  }
}
