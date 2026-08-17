import {
  ReflectionMode,
  RevealPolicy,
  StudentActionPurpose,
  TeachingStrategy,
  TeachingTechnique,
} from '../../tutoring-values'
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
import type { CandidateResponse } from '../generation/tutor-generation.types'

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

  it('uses the focused TeachingDecision obligation without adding a prior-attempt requirement', async () => {
    const guard = new FakeSemanticGuardPort({ approved: true, violations: [] })
    const base = input()
    const focusedObligation = studentActionObligation(
      StudentActionPurpose.PRIMARY_TECHNIQUE,
      TeachingTechnique.FOCUSED_QUESTION,
    )

    await new SemanticGuardService(guard).evaluate({
      ...base,
      candidate: candidate({
        studentAction: {
          type: TeachingTechnique.FOCUSED_QUESTION,
          description: 'Trace one update and identify the first mismatch.',
        },
      }),
      educationalContext: {
        ...base.educationalContext,
        acceptedAnalysis: {
          ...base.educationalContext.acceptedAnalysis,
          requestKind: 'PROBLEM_LIKE',
          studentState: 'UNKNOWN',
          effortEvidence: {
            present: false,
            quality: 'NONE',
            type: null,
            addressesPreviousTutorAction: false,
            isRepeated: false,
            evidenceMessageIds: [],
          },
          misconceptions: [],
        },
        currentTeachingDecision: {
          ...base.educationalContext.currentTeachingDecision,
          studentActionObligation: focusedObligation,
        },
      },
      validationContext: {
        ...base.validationContext,
        studentActionObligation: focusedObligation,
      },
    })

    const payloadText = guard.requests[0]?.messages[1].content ?? '{}'
    const payload = JSON.parse(payloadText) as {
      trustedPolicy: { studentActionObligation: unknown }
    }

    expect(payload.trustedPolicy.studentActionObligation).toEqual(
      focusedObligation,
    )
    expect(payloadText).not.toContain('askWhatStudentTried')
  })

  it('accepts compliant supported-work affirmation followed by verification', async () => {
    const guard = new FakeSemanticGuardPort({ approved: true, violations: [] })
    const base = input()
    const result = await new SemanticGuardService(guard).evaluate({
      ...base,
      candidate: candidate({
        message:
          'Yes—that distinction is correct. In a loop with an early match, which statement would skip only the remaining work in that iteration, and why?',
        studentAction: {
          type: TeachingTechnique.VERIFICATION,
          description:
            'Transfer the distinction to a new loop case and explain why.',
        },
      }),
      educationalContext: {
        ...base.educationalContext,
        currentStudentMessage: {
          id: 'message-1',
          content:
            'Break stops the whole loop, while continue moves to the next iteration.',
        },
        acceptedAnalysis: {
          ...base.educationalContext.acceptedAnalysis,
          requestKind: 'ATTEMPT_DIAGNOSIS',
          studentState: 'NEAR_SOLUTION',
          learningEvidence: {
            present: true,
            strength: 'STRONG',
            evidenceMessageIds: ['message-1'],
          },
          misconceptions: [],
        },
      },
      validationContext: {
        ...base.validationContext,
        studentActionObligation: studentActionObligation(
          StudentActionPurpose.PRIMARY_TECHNIQUE,
          TeachingTechnique.VERIFICATION,
        ),
      },
    })

    expect(result).toMatchObject({
      kind: 'validated',
      result: { approved: true },
    })
    const payload = JSON.parse(
      guard.requests[0]?.messages[1].content ?? '{}',
    ) as {
      trustedPolicy: {
        functionalResponseRequirements: {
          acknowledgeStudentSupportedCorrectWork: boolean
        }
      }
      adjudicationRules: string[]
    }
    expect(
      payload.trustedPolicy.functionalResponseRequirements
        .acknowledgeStudentSupportedCorrectWork,
    ).toBe(true)
    expect(payload.adjudicationRules.join(' ')).toContain(
      'brief factual acknowledgment',
    )
  })

  it.each(['CODE_LEAKAGE', 'MISSING_STUDENT_REASONING'] as const)(
    'preserves canonical %s semantic violation typing',
    async (type) => {
      const result = await new SemanticGuardService(
        new FakeSemanticGuardPort({
          approved: false,
          violations: [
            {
              type,
              severity: 'HIGH',
              field: 'message',
              evidence: 'The protected reasoning was supplied.',
              regenerationInstruction:
                'Preserve the protected reasoning for the student.',
            },
          ],
        }),
      ).evaluate(input())

      expect(result).toMatchObject({
        kind: 'validated',
        result: { approved: false, violations: [{ type }] },
      })
    },
  )

  it('supplies the reasoning target and rejects low-guidance correction disclosure', async () => {
    const guard = new FakeSemanticGuardPort({
      approved: false,
      violations: [
        {
          type: 'DIRECT_ANSWER_DISCLOSURE',
          severity: 'HIGH',
          field: 'message',
          evidence:
            'The candidate states the misconception correction before asking for trivial application.',
          regenerationInstruction:
            'Preserve the target inference and ask one focused inspection question.',
        },
      ],
    })
    const evaluation = input({
      candidate: candidate({
        message:
          'The iteration begins at the leading list item. Which item is at the beginning?',
      }),
    })

    const result = await new SemanticGuardService(guard).evaluate(evaluation)

    expect(result).toMatchObject({
      kind: 'validated',
      result: {
        approved: false,
        maximumSeverity: 'HIGH',
        recommendedAction: RESPONSE_VALIDATION_ACTION.REGENERATE,
        violations: [{ type: 'DIRECT_ANSWER_DISCLOSURE' }],
      },
    })
    const payload = JSON.parse(
      guard.requests[0]?.messages[1].content ?? '{}',
    ) as Record<string, unknown>
    expect(payload).toMatchObject({
      trustedPolicy: {
        disclosureContract: { directTargetInferenceAllowed: false },
        functionalResponseRequirements: {
          requestKind: 'CONCEPTUAL',
          strategyAndTechniqueMustNotReduceGuidanceShape: true,
          minimumUsefulConceptualExplanationRequired: false,
          evaluateSemanticallyWithoutPhraseMatching: true,
        },
      },
      educationalContext: {
        currentStudentMessage: {
          content:
            'I think iteration begins at the final item and moves backward.',
        },
        acceptedAnalysis: {
          id: 'analysis-1',
          studentState: 'MISCONCEPTION',
          evidenceReferences: ['message-1'],
          misconceptions: [
            {
              code: 'REVERSE_ITERATION',
            },
          ],
        },
        currentTeachingDecision: {
          id: 'decision-1',
          policyVersion: 'policy-test.v1',
        },
        recentConversation: [
          {
            id: 'assistant-previous',
            topicId: 'topic-1',
          },
        ],
      },
    })
    expect(payload).toMatchObject({
      trustedPolicy: {
        disclosurePolicyVersion: 'socratic-disclosure-policy.v3',
      },
    })
    expect(Reflect.get(payload, 'requiredChecks')).toEqual(
      expect.arrayContaining([
        expect.stringContaining('cumulative disclosure'),
      ]),
    )
    expect(Reflect.get(payload, 'violationTypingRules')).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'the violation type MUST be DIRECT_ANSWER_DISCLOSURE',
        ),
      ]),
    )
    expect(Reflect.get(payload, 'adjudicationRules')).toEqual(
      expect.arrayContaining([
        expect.stringContaining('For GUIDED_DECOMPOSITION'),
        expect.stringContaining('For STRONG_GUIDANCE'),
      ]),
    )
    expect(Reflect.get(payload, 'semanticCalibrationExamples')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          policyCondition: 'guidanceShape.mode is GUIDED_DECOMPOSITION',
          verdict: 'REJECT as GUIDANCE_LEVEL_VIOLATION',
        }),
        expect.objectContaining({
          policyCondition: 'guidanceShape.mode is STRONG_GUIDANCE',
          verdict: 'REJECT as GUIDANCE_LEVEL_VIOLATION',
        }),
      ]),
    )
  })

  it('approves a bounded question that preserves the target inference', async () => {
    const guard = new FakeSemanticGuardPort({ approved: true, violations: [] })
    const result = await new SemanticGuardService(guard).evaluate(
      input({
        candidate: candidate({
          message:
            'Inspect the two ends of the collection. Which position should you trace first?',
        }),
      }),
    )

    expect(result).toMatchObject({
      kind: 'validated',
      result: {
        approved: true,
        maximumSeverity: null,
        recommendedAction: RESPONSE_VALIDATION_ACTION.APPROVE,
        violations: [],
      },
    })
  })

  it.each([
    {
      label: 'under-informative conceptual response',
      message: 'They are different. What do you think happens?',
      guardOutput: {
        approved: false,
        violations: [
          {
            type: 'SEMANTIC_POLICY_VIOLATION',
            severity: 'HIGH',
            field: 'message',
            evidence: 'The response omits the minimum useful distinction.',
            regenerationInstruction:
              'State the concise grounded distinction before the understanding question.',
          },
        ],
      },
      approved: false,
    },
    {
      label: 'bounded distinction with an understanding check',
      message:
        '`break` exits the loop, while `continue` skips the rest of the current iteration. What difference would that make on the next iteration?',
      guardOutput: { approved: true, violations: [] },
      approved: true,
    },
  ])(
    'carries the direct conceptual golden contract for $label',
    async ({ message, guardOutput, approved }) => {
      const guard = new FakeSemanticGuardPort(guardOutput)
      const result = await new SemanticGuardService(guard).evaluate(
        directConceptualInput(message),
      )

      expect(result).toMatchObject({
        kind: 'validated',
        result: { approved },
      })
      const payload = JSON.parse(
        guard.requests[0]?.messages[1].content ?? '{}',
      ) as Record<string, unknown>
      expect(payload).toMatchObject({
        trustedPolicy: {
          disclosureContract: {
            boundedConceptualExplanationAllowed: true,
            directTargetInferenceAllowed: true,
            finalAnswerAllowed: false,
            completeSolutionAllowed: false,
          },
          functionalResponseRequirements: {
            minimumUsefulConceptualExplanationRequired: true,
          },
          studentActionObligation: {
            purpose: StudentActionPurpose.CONCEPTUAL_UNDERSTANDING,
          },
        },
      })
      const semanticCalibrationExamples = Reflect.get(
        payload,
        'semanticCalibrationExamples',
      ) as readonly {
        readonly candidateMeaning: string
        readonly verdict: string
      }[]
      expect(
        semanticCalibrationExamples.some(
          (example) =>
            example.candidateMeaning.includes('only says') &&
            example.verdict === 'REJECT as SEMANTIC_POLICY_VIOLATION',
        ),
      ).toBe(true)
      expect(
        semanticCalibrationExamples.some(
          (example) =>
            example.candidateMeaning.includes('concise grounded distinction') &&
            example.verdict === 'APPROVE when all other checks pass',
        ),
      ).toBe(true)
    },
  )

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
    attemptId: 'turn-1',
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
        id: 'analysis-1',
        requestKind: 'CONCEPTUAL',
        studentState: 'MISCONCEPTION',
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
        misconceptions: [
          {
            code: 'REVERSE_ITERATION',
            description:
              'The student believes normal collection iteration moves from the final item backward.',
            confidence: 0.95,
            evidenceMessageId: 'message-1',
          },
        ],
        evidenceReferences: ['message-1'],
        confidence: 0.95,
        analysisSource: 'model',
        promptVersion: 'analysis-test.v1',
        schemaVersion: 'analysis-schema.v1',
      },
      topicState: null,
      previousTeachingDecision: null,
      outputProtection: {
        protectTargetSolution: false,
        topicId: 'topic-1',
        source: 'ACCEPTED_CONCEPT_ANALYSIS',
        policyVersion: 'solution-protection.v1',
      },
      currentTeachingDecision: {
        id: 'decision-1',
        policyVersion: 'policy-test.v1',
        guidanceLevel: 1,
        revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
        studentActionObligation: studentActionObligation(),
      },
      recentConversation: [
        {
          id: 'assistant-previous',
          sequence: 1,
          role: 'ASSISTANT',
          attemptId: 'turn-previous',
          topicId: 'topic-1',
          content: 'Trace the collection and predict the next value.',
        },
      ],
    },
    validationContext: {
      allowedCitationIds: new Set(['retrieval.rank.1']),
      requireGrounding: true,
      enforceCitationSupport: true,
      studentActionObligation: studentActionObligation(),
      reflectionMode: ReflectionMode.NONE,
      responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
      guidanceLevel: 1,
      revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
      maximumDisclosedSteps: 1,
    },
    guardPolicy: {
      preventDirectAnswer: true,
      preventFinalResult: true,
      preventCompleteSolution: true,
      preventSubmissionReadyCode: true,
      preventProtectedCodeLeakage: true,
      requireStudentReasoning: true,
      requireGrounding: true,
      enforceCitationSupport: true,
      maximumDisclosedSteps: 1,
    },
    allowedCitationSummaries: [],
    ...patch,
  }
}

function candidate(patch: Partial<CandidateResponse> = {}): CandidateResponse {
  return {
    message: 'What changes first in the loop?',
    debuggingGuidance: null,
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
    promptVersion: 'tutor-generation.mvp.v9',
    tokenUsage: { input: 0, output: 0 },
    ...patch,
  }
}

function directConceptualInput(message: string): SemanticGuardEvaluationInput {
  const base = input()
  return {
    ...base,
    candidate: candidate({
      message,
      responseIntent: TeachingStrategy.GUIDED_EXPLANATION,
      studentAction: {
        type: TeachingTechnique.ORIENTATION_QUESTION,
        description:
          'Ask the student to compare the effect on the next iteration.',
      },
    }),
    educationalContext: {
      ...base.educationalContext,
      currentStudentMessage: {
        id: 'message-1',
        content:
          'What is the difference between break and continue in a Python loop?',
      },
      acceptedAnalysis: {
        ...base.educationalContext.acceptedAnalysis,
        requestKind: 'CONCEPTUAL',
        studentState: 'UNKNOWN',
        misconceptions: [],
        confidence: 0.1,
        analysisSource: 'fallback',
      },
      currentTeachingDecision: {
        ...base.educationalContext.currentTeachingDecision,
        revealPolicy: RevealPolicy.PARTIAL_RESULT_ALLOWED,
        studentActionObligation: studentActionObligation(
          StudentActionPurpose.CONCEPTUAL_UNDERSTANDING,
        ),
      },
      recentConversation: [],
    },
    validationContext: {
      ...base.validationContext,
      responseIntent: TeachingStrategy.GUIDED_EXPLANATION,
      studentActionObligation: studentActionObligation(
        StudentActionPurpose.CONCEPTUAL_UNDERSTANDING,
      ),
      revealPolicy: RevealPolicy.PARTIAL_RESULT_ALLOWED,
    },
    guardPolicy: {
      ...base.guardPolicy,
      preventDirectAnswer: false,
    },
  }
}

function studentActionObligation(
  purpose: StudentActionPurpose = StudentActionPurpose.PRIOR_ATTEMPT_ORIENTATION,
  technique: TeachingTechnique = TeachingTechnique.ORIENTATION_QUESTION,
) {
  return {
    version: 'student-action-obligation.v1' as const,
    required: true,
    purpose,
    technique,
    maximumMeaningfulActions: 1 as const,
    generationInstruction: 'Request exactly one meaningful student action.',
  }
}
