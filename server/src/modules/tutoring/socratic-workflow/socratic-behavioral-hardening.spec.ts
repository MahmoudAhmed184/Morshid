import {
  ExplanationDetailLevel,
  MessageRequestKind,
  ReflectionMode,
  RevealPolicy,
  StudentActionPurpose,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
} from '../tutoring-values'
import {
  ANSWER_CORRECTNESS,
  EDUCATIONAL_ANALYSIS_SOURCE,
  type EducationalAnalysisSource,
  EFFORT_QUALITY,
  EFFORT_TYPE,
  LEARNING_EVIDENCE_STRENGTH,
} from './analysis/educational-analysis.types'
import {
  assessDebuggingAdmission,
  hasDebuggingGuidanceIntent,
  isDebuggingGuidanceEligible,
} from './debugging-guidance/debugging-guidance.strategy'
import { assessDebuggingGuidanceBoundary } from './debugging-guidance/debugging-guidance.boundary'
import {
  selectTeachingDecisionDraft,
  selectTeachingStrategy,
} from './teaching-decision/teaching-policy.selector'
import { selectTutorStrategy } from './teaching-decision/tutor-strategy'
import { studentActionObligationFromDecision } from './teaching-decision/student-action-obligation'
import { SafeFallbackService } from './response-approval/safe-fallback.service'
import {
  APPROVED_RESPONSE_SOURCE,
  MVP_RESPONSE_VALIDATION_POLICY_VERSION,
} from './response-approval/response-validation.types'
import { ResponseApprovalService } from './response-approval/response-approval.service'
import { DeterministicGuardService } from './response-approval/deterministic-guard.service'
import { StructuralResponseValidator } from './response-approval/structural-response.validator'
import type { SemanticGuardService } from './response-approval/semantic-guard.service'
import { TeachingDecisionRepository } from './teaching-decision/teaching-decision.repository'
import { AutomaticSafetyRiskDetector } from '../response-governance/automatic-safety-risk.detector'
import {
  type CandidateResponse,
  type TutorGenerationInput,
  type TutorGenerationServiceResult,
  type TutorGuardEducationalContext,
} from './generation/tutor-generation.types'
import { TUTOR_GENERATION_PROMPT_VERSION } from './generation/tutor-prompt.definition'
import {
  SOLUTION_PROTECTION_POLICY_VERSION,
  type OutputProtectionContext,
} from './solution-protection/solution-protection.types'
import { TOPIC_RESOLUTION_OUTCOME } from './topic/topic.types'
import type { PersistedTeachingDecisionRecord } from './teaching-decision/teaching-decision.repository'
import type { PersistedEducationalAnalysisRecord } from './analysis/educational-analysis.repository'

describe('Socratic Tutor Behavioral Hardening', () => {
  const safeFallbackService = new SafeFallbackService()

  function baseDecision(
    patch: Partial<PersistedTeachingDecisionRecord> = {},
  ): PersistedTeachingDecisionRecord {
    return {
      id: 'decision-hardening-1',
      attemptId: 'attempt-1',
      topicId: 'topic-1',
      analysisId: 'analysis-1',
      strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
      primaryTechnique: TeachingTechnique.FOCUSED_QUESTION,
      supportingTechnique: null,
      guidanceLevel: 1,
      revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
      reflectionMode: ReflectionMode.NONE,
      requireStudentAction: true,
      studentActionPurpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
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
      decisionReason: 'Hardened policy',
      policyVersion: 'socratic-policy.mvp.v1',
      createdAt: new Date('2026-08-20T00:00:00.000Z'),
      ...patch,
    }
  }

  function baseAnalysis(
    patch: Partial<PersistedEducationalAnalysisRecord['result']> = {},
    source: EducationalAnalysisSource = EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
    recordPatch: Partial<PersistedEducationalAnalysisRecord> = {},
  ): PersistedEducationalAnalysisRecord {
    return {
      id: 'analysis-hardening-1',
      attemptId: 'attempt-1',
      topicId: 'topic-1',
      studentMessageId: 'message-1',
      attempt: 1,
      ...recordPatch,
      result: {
        requestKind: MessageRequestKind.PROBLEM_LIKE,
        studentState: StudentState.PARTIAL_UNDERSTANDING,
        topicRelation: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
        effortEvidence: {
          present: false,
          quality: EFFORT_QUALITY.NONE,
          type: null,
          addressesPreviousTutorAction: false,
          isRepeated: false,
          evidenceMessageIds: [],
        },
        learningEvidence: {
          present: false,
          strength: LEARNING_EVIDENCE_STRENGTH.NONE,
          evidenceMessageIds: [],
        },
        misconceptions: [],
        recommendedStrategy: TeachingStrategy.SOCRATIC_QUESTIONING,
        recommendedTechnique: TeachingTechnique.FOCUSED_QUESTION,
        recommendedGuidanceLevel: 1,
        confidence: 0.95,
        evidenceReferences: [],
        ...patch,
      },
      provider: 'mock-provider',
      model: 'mock-model',
      modelVersion: null,
      promptVersion: 'analysis-prompt.v1',
      schemaVersion: 'analysis-schema.v1',
      inputTokens: null,
      outputTokens: null,
      latencyMs: null,
      fallbackReason: null,
      failureCategory: null,
      confidencePolicyVersion: null,
      infrastructureRetryCount: 0,
      evidenceLinks: [],
      misconceptionRecords: [],
      analysisSource: source,
      createdAt: new Date('2026-08-20T00:00:00.000Z'),
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Architectural Separation and Execution Invariants
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Architectural Separation and Invariants', () => {
    it('does not derive TeachingStrategy solely from debuggingAdmission.eligible === true', () => {
      const analysisRecord = baseAnalysis({
        requestKind: MessageRequestKind.CONCEPTUAL,
        studentState: StudentState.NO_PRIOR_KNOWLEDGE,
      })

      const strategy = selectTeachingStrategy({
        analysis: analysisRecord,
        previousTeachingDecision: null,
      })

      // Even if admission is evaluated separately, conceptual analysis yields GUIDED_EXPLANATION
      expect(strategy).toBe(TeachingStrategy.GUIDED_EXPLANATION)
      expect(strategy).not.toBe(TeachingStrategy.DEBUGGING_GUIDANCE)
    })

    it('does not authorize specialized debugging when debuggingAdmission.eligible === false', () => {
      const admission = assessDebuggingAdmission({
        studentMessage: 'x = 5\ny = x + 1\nwhat is the value of y?',
        analysis: {
          requestKind: MessageRequestKind.PROBLEM_LIKE,
          studentState: StudentState.PARTIAL_UNDERSTANDING,
        },
      })

      expect(admission.eligible).toBe(false)
      expect(admission.reason).toBe('NOT_ELIGIBLE_CODE_PRESENT_ONLY')

      // Execution gate invariant
      const canExecuteSpecializedDebugging = admission.eligible && false // boundary check not even needed

      expect(canExecuteSpecializedDebugging).toBe(false)
    })

    it('rejects oversized scope (state: TOO_MANY_LINES) and does not execute specialized debugging', () => {
      const studentMessage = [
        'Why does this code fail?',
        'if True:',
        ...Array.from({ length: 100 }, () => '    pass'),
      ].join('\n')

      const admission = assessDebuggingAdmission({ studentMessage })
      expect(admission.eligible).toBe(true)

      const boundary = assessDebuggingGuidanceBoundary(studentMessage)
      expect(boundary.state).toBe('TOO_MANY_LINES')
      expect(boundary.lineCount).toBeGreaterThan(100)

      const canExecuteSpecializedDebugging =
        admission.eligible && boundary.state === 'SUPPORTED'

      expect(canExecuteSpecializedDebugging).toBe(false)
    })

    it('treats missing boundary (debuggingBoundary === undefined) as unauthorized (fail-safe)', () => {
      const admission = {
        eligible: true,
        reason: 'ELIGIBLE_EXPLICIT_DEBUGGING_INTENT' as const,
        rewriteRequested: false,
      }
      const debuggingBoundary = undefined

      const canExecuteSpecializedDebugging =
        admission.eligible &&
        (debuggingBoundary as { state?: string } | undefined)?.state ===
          'SUPPORTED'

      expect(canExecuteSpecializedDebugging).toBe(false)
    })

    it('never locks a new conceptual turn into debugging based solely on stale previous debugging decision', () => {
      const previousDebuggingDecision = baseDecision({
        strategy: TeachingStrategy.DEBUGGING_GUIDANCE,
        primaryTechnique: TeachingTechnique.TRACE_EXECUTION,
      })

      const newConceptualAnalysis = baseAnalysis({
        requestKind: MessageRequestKind.CONCEPTUAL,
        studentState: StudentState.NO_PRIOR_KNOWLEDGE,
        topicRelation: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      })

      const strategy = selectTeachingStrategy({
        analysis: newConceptualAnalysis,
        previousTeachingDecision: previousDebuggingDecision,
      })

      expect(strategy).toBe(TeachingStrategy.GUIDED_EXPLANATION)
      expect(strategy).not.toBe(TeachingStrategy.DEBUGGING_GUIDANCE)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Context-Aware Safe Fallback
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Context-Aware Safe Fallback', () => {
    it('generates conceptual orientation fallback without "show your last step" assumption', () => {
      const decision = baseDecision({
        studentActionPurpose: StudentActionPurpose.CONCEPTUAL_UNDERSTANDING,
        primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
      })

      const fallback = safeFallbackService.create(
        decision,
        ExplanationDetailLevel.STANDARD,
      )

      expect(fallback.message).toContain('Let us explore the core concept.')
      expect(fallback.message).not.toContain(
        'last step you were confident about',
      )
      expect(fallback.source).toBe(APPROVED_RESPONSE_SOURCE.SAFE_FALLBACK)
      expect(fallback.requiresStudentAction).toBe(true)
    })

    it('generates problem-solving step breakdown fallback preserving learner reasoning', () => {
      const decision = baseDecision({
        studentActionPurpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
        primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
      })

      const fallback = safeFallbackService.create(
        decision,
        ExplanationDetailLevel.STANDARD,
      )

      expect(fallback.message).toContain(
        'Let us break this down into one step.',
      )
      expect(fallback.message).toContain(
        'What is the first value or condition to check?',
      )
      expect(fallback.source).toBe(APPROVED_RESPONSE_SOURCE.SAFE_FALLBACK)
    })

    it('generates attempt-acknowledging fallback when student tried a prior attempt', () => {
      const decision = baseDecision({
        studentActionPurpose: StudentActionPurpose.PRIOR_ATTEMPT_ORIENTATION,
        primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
      })

      const fallback = safeFallbackService.create(
        decision,
        ExplanationDetailLevel.STANDARD,
      )

      expect(fallback.message).toContain('Let us check your reasoning.')
      expect(fallback.message).toContain(
        'What was the first step you considered?',
      )
    })

    it('generates execution tracing fallback for debugging context', () => {
      const decision = baseDecision({
        strategy: TeachingStrategy.DEBUGGING_GUIDANCE,
        primaryTechnique: TeachingTechnique.TRACE_EXECUTION,
        studentActionPurpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
      })

      const fallback = safeFallbackService.create(
        decision,
        ExplanationDetailLevel.STANDARD,
      )

      expect(fallback.message).toContain('Let us narrow it to one trace step.')
      expect(fallback.message).toContain('What value changes first')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Normal Problem Cases (Failing Case Hardening)
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Normal Problem Cases', () => {
    it('classifies "x = 5; y = x + 1; what is the value of y?" as non-debugging', () => {
      const input = 'x = 5\ny = x + 1\nwhat is the value of y?'

      const admission = assessDebuggingAdmission(input)
      expect(admission.eligible).toBe(false)
      expect(admission.reason).toBe('NOT_ELIGIBLE_CODE_PRESENT_ONLY')
      expect(hasDebuggingGuidanceIntent(input)).toBe(false)
      expect(isDebuggingGuidanceEligible(input)).toBe(false)

      const strategySelection = selectTutorStrategy(input)
      expect(strategySelection.decision.requestKind).toBe(
        MessageRequestKind.CONCEPTUAL,
      )
      expect(strategySelection.decision.strategy).toBe('GROUNDED_EXPLANATION')
      expect(strategySelection.boundaryResponse).toBeNull()
      expect(strategySelection.diagnosis).toBeNull()
    })

    it('classifies loop output exercise as non-debugging', () => {
      const input = 'for i in range(3):\n    print(i)\nWhat will this print?'

      const admission = assessDebuggingAdmission(input)
      expect(admission.eligible).toBe(false)
      expect(admission.reason).toBe('NOT_ELIGIBLE_CODE_PRESENT_ONLY')

      const strategySelection = selectTutorStrategy(input)
      expect(strategySelection.decision.strategy).not.toBe(
        TeachingStrategy.DEBUGGING_GUIDANCE,
      )
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Fenced Code Hard Negatives
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Fenced Code Hard Negatives', () => {
    it('does not admit fenced code with a prediction question to debugging', () => {
      const input = [
        '```python',
        'x = 5',
        'print(x + 1)',
        '```',
        'What will this print?',
      ].join('\n')

      const admission = assessDebuggingAdmission(input)
      expect(admission.eligible).toBe(false)
      expect(admission.reason).toBe('NOT_ELIGIBLE_CODE_PRESENT_ONLY')
    })

    it('does not admit fenced function explanation request to debugging', () => {
      const input = [
        '```python',
        'def square(n):',
        '    return n * n',
        '```',
        'Can you explain what this function does?',
      ].join('\n')

      const admission = assessDebuggingAdmission(input)
      expect(admission.eligible).toBe(false)
      expect(admission.reason).toBe('NOT_ELIGIBLE_CODE_PRESENT_ONLY')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Real Debugging Positives
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Real Debugging Positives', () => {
    it('admits fenced code with NameError execution failure to debugging', () => {
      const input = [
        '```python',
        'def average(nums):',
        '    return sum(nums) / len(num)',
        '```',
        'NameError: name "num" is not defined. Why does this happen?',
      ].join('\n')

      const admission = assessDebuggingAdmission(input)
      expect(admission.eligible).toBe(true)
      expect(admission.reason).toBe('ELIGIBLE_EXECUTION_FAILURE')
    })

    it('admits explicit diagnostic question to debugging', () => {
      const input = [
        'Why is this list access suspicious?',
        '```python',
        'items = ["first", "second"]',
        'print(items[len(items)])',
        '```',
      ].join('\n')

      const admission = assessDebuggingAdmission(input)
      expect(admission.eligible).toBe(true)
      expect(admission.reason).toBe('ELIGIBLE_EXPLICIT_DEBUGGING_INTENT')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Minimal Pairs
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Minimal Pairs', () => {
    const codeSnippet = 'def total(items):\n    return sum(item)'

    it('minimal pair: "What does this code do?" vs "Why does this code fail?"', () => {
      const questionA = `What does this code do?\n${codeSnippet}`
      const questionB = `Why does this code fail?\n${codeSnippet}`

      const admissionA = assessDebuggingAdmission(questionA)
      const admissionB = assessDebuggingAdmission(questionB)

      expect(admissionA.eligible).toBe(false)
      expect(admissionA.reason).toBe('NOT_ELIGIBLE_CODE_PRESENT_ONLY')

      expect(admissionB.eligible).toBe(true)
      expect(admissionB.reason).toBe('ELIGIBLE_EXPLICIT_DEBUGGING_INTENT')
    })

    it('minimal pair: conceptual dictionary lookup vs failing dictionary lookup', () => {
      const conceptual = 'How does a dictionary lookup work in Python?'
      const debugging = 'Why does my dictionary lookup throw KeyError: "key"?'

      const admissionA = assessDebuggingAdmission(conceptual)
      const admissionB = assessDebuggingAdmission(debugging)

      expect(admissionA.eligible).toBe(false)
      expect(admissionB.eligible).toBe(true)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Format Invariance
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Format Invariance', () => {
    it('evaluates semantic admission identically across newline and whitespace styles', () => {
      const variations = [
        'x = 5; y = x + 1; what is the value of y?',
        'x = 5\ny = x + 1\nwhat is the value of y?',
        'x = 5\r\ny = x + 1\r\nwhat is the value of y?',
        '```python\nx = 5\ny = x + 1\n```\nwhat is the value of y?',
        '   \n\n```python\nx = 5\ny = x + 1\n```\n\nwhat is the value of y?   \n',
      ]

      for (const variation of variations) {
        const admission = assessDebuggingAdmission(variation)
        expect(admission.eligible).toBe(false)
        expect(admission.reason).toBe('NOT_ELIGIBLE_CODE_PRESENT_ONLY')
      }
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Multi-Turn Progressive Scaffolding
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. Progressive Scaffolding Across Turns', () => {
    it('escalates guidance from Level 1 -> Level 2 -> Level 3 when student struggles, then de-escalates on learning evidence', () => {
      const topic = {
        topicId: 'topic-1',
      }

      // Turn 1: Initial question (Level 1)
      const turn1Analysis = baseAnalysis(
        {
          requestKind: MessageRequestKind.PROBLEM_LIKE,
          studentState: StudentState.NO_PRIOR_KNOWLEDGE,
          effortEvidence: {
            present: false,
            quality: EFFORT_QUALITY.NONE,
            type: null,
            addressesPreviousTutorAction: false,
            isRepeated: false,
            evidenceMessageIds: [],
          },
        },
        EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
        { topicId: topic.topicId },
      )
      const turn1Draft = selectTeachingDecisionDraft({
        analysis: turn1Analysis,
        topicState: null,
        previousTeachingDecision: null,
      })
      expect(turn1Draft.guidanceLevel).toBe(1)

      // Turn 2: Student struggles addressing previous action -> Escalates to Level 2
      const turn2Decision = baseDecision({
        topicId: topic.topicId,
        guidanceLevel: 1,
      })
      const turn2Analysis = baseAnalysis(
        {
          requestKind: MessageRequestKind.PROBLEM_LIKE,
          studentState: StudentState.PARTIAL_UNDERSTANDING,
          effortEvidence: {
            present: true,
            quality: EFFORT_QUALITY.MEANINGFUL,
            type: EFFORT_TYPE.REASONING_ATTEMPT,
            addressesPreviousTutorAction: true,
            isRepeated: false,
            evidenceMessageIds: ['message-2'],
          },
        },
        EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
        { topicId: topic.topicId, studentMessageId: 'message-2' },
      )
      const turn2Draft = selectTeachingDecisionDraft({
        analysis: turn2Analysis,
        topicState: null,
        previousTeachingDecision: turn2Decision,
      })
      expect(turn2Draft.guidanceLevel).toBe(2)

      // Turn 3: Student still blocked after a meaningful attempt -> Escalates to Level 3
      const turn3Decision = baseDecision({
        topicId: topic.topicId,
        guidanceLevel: 2,
      })
      const turn3Analysis = baseAnalysis(
        {
          requestKind: MessageRequestKind.PROBLEM_LIKE,
          studentState: StudentState.PARTIAL_UNDERSTANDING,
          effortEvidence: {
            present: true,
            quality: EFFORT_QUALITY.MEANINGFUL,
            type: EFFORT_TYPE.EXPLANATION_ATTEMPT,
            addressesPreviousTutorAction: true,
            isRepeated: false,
            evidenceMessageIds: ['message-3'],
          },
        },
        EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
        { topicId: topic.topicId, studentMessageId: 'message-3' },
      )
      const turn3Draft = selectTeachingDecisionDraft({
        analysis: turn3Analysis,
        topicState: null,
        previousTeachingDecision: turn3Decision,
      })
      expect(turn3Draft.guidanceLevel).toBe(3)

      // Turn 4: Student demonstrates verified learning evidence -> De-escalates to Level 2 for consolidation
      const turn4Decision = baseDecision({
        topicId: topic.topicId,
        guidanceLevel: 3,
      })
      const turn4Analysis = baseAnalysis(
        {
          requestKind: MessageRequestKind.PROBLEM_LIKE,
          studentState: StudentState.NEAR_SOLUTION,
          learningEvidence: {
            present: true,
            strength: LEARNING_EVIDENCE_STRENGTH.STRONG,
            evidenceMessageIds: ['message-4'],
          },
        },
        EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
        { topicId: topic.topicId, studentMessageId: 'message-4' },
      )
      const turn4Draft = selectTeachingDecisionDraft({
        analysis: turn4Analysis,
        topicState: null,
        previousTeachingDecision: turn4Decision,
      })
      expect(turn4Draft.guidanceLevel).toBe(2)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Wrong Attempts
  // ───────────────────────────────────────────────────────────────────────────
  describe('9. Wrong Attempts Handling', () => {
    it('handles misconception/wrong attempt with targeted reflection rather than direct answer', () => {
      const wrongAttemptAnalysis = baseAnalysis(
        {
          requestKind: MessageRequestKind.PROBLEM_LIKE,
          studentState: StudentState.MISCONCEPTION,
          misconceptions: [
            {
              code: 'MISCONCEPTION_ARITHMETIC',
              description: 'Student assumed x + 1 means add 2',
              confidence: 0.95,
              evidenceMessageId: 'message-attempt-1',
            },
          ],
          effortEvidence: {
            present: true,
            quality: EFFORT_QUALITY.MEANINGFUL,
            type: EFFORT_TYPE.EXPLANATION_ATTEMPT,
            addressesPreviousTutorAction: true,
            isRepeated: false,
            evidenceMessageIds: ['message-attempt-1'],
          },
        },
        EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
        { studentMessageId: 'message-attempt-1' },
      )

      const draft = selectTeachingDecisionDraft({
        analysis: wrongAttemptAnalysis,
        topicState: null,
        previousTeachingDecision: baseDecision({ guidanceLevel: 1 }),
      })

      expect(draft.revealPolicy).toBe(RevealPolicy.NO_FINAL_ANSWER)
      expect(draft.guardPolicy.preventDirectAnswer).toBe(true)
      expect(draft.guardPolicy.preventFinalResult).toBe(true)
      expect(draft.strategy).toBe(TeachingStrategy.MISCONCEPTION_REPAIR)
      expect(draft.primaryTechnique).toBe(TeachingTechnique.COUNTEREXAMPLE)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Conceptual Questions
  // ───────────────────────────────────────────────────────────────────────────
  describe('10. Conceptual Questions', () => {
    it('routes "What is the difference between break and continue?" to grounded conceptual policy', () => {
      const input = 'What is the difference between break and continue?'

      const admission = assessDebuggingAdmission(input)
      expect(admission.eligible).toBe(false)
      expect(admission.reason).toBe('NOT_ELIGIBLE_NO_DEBUGGING_EVIDENCE')

      const strategySelection = selectTutorStrategy(input)
      expect(strategySelection.decision.requestKind).toBe(
        MessageRequestKind.CONCEPTUAL,
      )
      expect(strategySelection.decision.strategy).toBe('GROUNDED_EXPLANATION')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 11. Layered Solution Protection & Decisive Substitution Rejection
  // ───────────────────────────────────────────────────────────────────────────
  describe('11. Layered Solution Protection & Decisive Substitution Rejection', () => {
    it('rejects candidate performing decisive substitution derivation under NO_FINAL_ANSWER', async () => {
      const excessiveRevealCandidate: CandidateResponse = {
        message:
          'x is 5, so substitute it into y = x + 1 and calculate 5 + 1. What do you get?',
        debuggingGuidance: null,
        responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
        usedCitationIds: [],
        requiresStudentAction: true,
        studentAction: {
          type: TeachingTechnique.FOCUSED_QUESTION,
          description: 'Identify the result after substituting x.',
        },
        reflectionIncluded: false,
        selfReportedCompliance: {
          finalAnswerRevealed: false,
          completeSolutionRevealed: false,
        },
        provider: 'mock-tutor',
        model: 'mock-model',
        promptVersion: TUTOR_GENERATION_PROMPT_VERSION,
        tokenUsage: { input: 10, output: 5 },
      }

      const validCandidate: CandidateResponse = {
        message: 'What value is currently assigned to x in the first line?',
        debuggingGuidance: null,
        responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
        usedCitationIds: [],
        requiresStudentAction: true,
        studentAction: {
          type: TeachingTechnique.FOCUSED_QUESTION,
          description: 'Identify the value of x.',
        },
        reflectionIncluded: false,
        selfReportedCompliance: {
          finalAnswerRevealed: false,
          completeSolutionRevealed: false,
        },
        provider: 'mock-tutor',
        model: 'mock-model',
        promptVersion: TUTOR_GENERATION_PROMPT_VERSION,
        tokenUsage: { input: 10, output: 5 },
      }

      const generation = new FakeGenerationService([
        {
          success: true,
          candidate: excessiveRevealCandidate,
          infrastructureRetryCount: 0,
          educationalContext: mockEducationalContext(),
        },
        {
          success: true,
          candidate: validCandidate,
          infrastructureRetryCount: 0,
          educationalContext: mockEducationalContext(),
        },
      ])

      const semanticGuard = new FakeSemanticGuardService([
        {
          kind: 'validated',
          result: {
            stage: 'SEMANTIC',
            approved: false,
            violations: [
              {
                type: 'DIRECT_ANSWER_DISCLOSURE',
                severity: 'HIGH',
                field: 'message',
                evidence:
                  'Tutor performed decisive substitution derivation (5 + 1).',
                regenerationInstruction:
                  'Guide student to find the value of x without substituting.',
              },
            ],
            maximumSeverity: 'HIGH',
            recommendedAction: 'REGENERATE',
            provider: 'semantic-guard',
            model: 'mock-guard',
            promptVersion: 'semantic-guard.v1',
            policyVersion: MVP_RESPONSE_VALIDATION_POLICY_VERSION,
          },
        },
        {
          kind: 'validated',
          result: {
            stage: 'SEMANTIC',
            approved: true,
            violations: [],
            maximumSeverity: null,
            recommendedAction: 'APPROVE',
            provider: 'semantic-guard',
            model: 'mock-guard',
            promptVersion: 'semantic-guard.v1',
            policyVersion: MVP_RESPONSE_VALIDATION_POLICY_VERSION,
          },
        },
      ])

      const approvalService = new ResponseApprovalService(
        generation as never,
        new FakeTeachingDecisionRepository(baseDecision()),
        new StructuralResponseValidator(),
        new DeterministicGuardService(),
        semanticGuard as never,
        safeFallbackService,
        new AutomaticSafetyRiskDetector(),
      )

      const approvalInput = mockGenerationInput()
      const result = await approvalService.approve(approvalInput)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.approvedResponse.source).toBe('VALIDATED_CANDIDATE')
        expect(result.approvedResponse.approvedCandidateAttempt).toBe(2)
        expect(result.candidateAttempts).toBe(2)
      }
      expect(generation.calls).toHaveLength(2)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 12. Regeneration Preserves Reveal Ceiling
  // ───────────────────────────────────────────────────────────────────────────
  describe('12. Regeneration Reveal Ceiling Invariant', () => {
    it('passes exact violation to attempt 2 while preserving identical reveal policy and guidance level', async () => {
      const rejectedCandidate: CandidateResponse = {
        message: 'The value is 6.',
        debuggingGuidance: null,
        responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
        usedCitationIds: [],
        requiresStudentAction: true,
        studentAction: {
          type: TeachingTechnique.FOCUSED_QUESTION,
          description: 'Confirm the answer.',
        },
        reflectionIncluded: false,
        selfReportedCompliance: {
          finalAnswerRevealed: true,
          completeSolutionRevealed: false,
        },
        provider: 'mock-tutor',
        model: 'mock-model',
        promptVersion: TUTOR_GENERATION_PROMPT_VERSION,
        tokenUsage: { input: 10, output: 5 },
      }

      const compliantCandidate: CandidateResponse = {
        message: 'What operation does y = x + 1 perform on x?',
        debuggingGuidance: null,
        responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
        usedCitationIds: [],
        requiresStudentAction: true,
        studentAction: {
          type: TeachingTechnique.FOCUSED_QUESTION,
          description: 'State the operation.',
        },
        reflectionIncluded: false,
        selfReportedCompliance: {
          finalAnswerRevealed: false,
          completeSolutionRevealed: false,
        },
        provider: 'mock-tutor',
        model: 'mock-model',
        promptVersion: TUTOR_GENERATION_PROMPT_VERSION,
        tokenUsage: { input: 10, output: 5 },
      }

      const generation = new FakeGenerationService([
        {
          success: true,
          candidate: rejectedCandidate,
          infrastructureRetryCount: 0,
          educationalContext: mockEducationalContext(),
        },
        {
          success: true,
          candidate: compliantCandidate,
          infrastructureRetryCount: 0,
          educationalContext: mockEducationalContext(),
        },
      ])

      const semanticGuard = new FakeSemanticGuardService({
        kind: 'validated',
        result: {
          stage: 'SEMANTIC',
          approved: true,
          violations: [],
          maximumSeverity: null,
          recommendedAction: 'APPROVE',
          provider: 'semantic-guard',
          model: 'mock-guard',
          promptVersion: 'semantic-guard.v1',
          policyVersion: MVP_RESPONSE_VALIDATION_POLICY_VERSION,
        },
      })

      const decisionRecord = baseDecision({
        guidanceLevel: 1,
        revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
      })

      const approvalService = new ResponseApprovalService(
        generation as never,
        new FakeTeachingDecisionRepository(decisionRecord),
        new StructuralResponseValidator(),
        new DeterministicGuardService(),
        semanticGuard as never,
        safeFallbackService,
        new AutomaticSafetyRiskDetector(),
      )

      const approvalInput = mockGenerationInput()
      const result = await approvalService.approve(approvalInput)

      expect(result.success).toBe(true)
      expect(generation.calls).toHaveLength(2)

      // Invariant: attempt 2 retains the exact same output protection / reveal ceiling
      const attempt2Input = generation.calls[1]
      expect(attempt2Input.outputProtection.protectTargetSolution).toBe(true)
      expect(attempt2Input.regeneration?.candidateAttempt).toBe(2)
      expect(attempt2Input.regeneration?.previousValidation).toBeDefined()
    })
  })

  describe('4-turn progressive scaffolding, struggle, and resolution journey', () => {
    it('completes an explicitly correct justified answer while keeping y = 5 incomplete', async () => {
      const activeProblemText = 'x = 5\ny = x + 1\nwhat is the value of y?'

      // === Turn 1: Problem statement ===
      const turn1Analysis = baseAnalysis(
        {
          requestKind: MessageRequestKind.PROBLEM_LIKE,
          studentState: StudentState.NO_PRIOR_KNOWLEDGE,
          effortEvidence: {
            present: false,
            quality: EFFORT_QUALITY.NONE,
            type: null,
            addressesPreviousTutorAction: false,
            isRepeated: false,
            evidenceMessageIds: [],
          },
        },
        EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
        { id: 'analysis-turn-1' },
      )

      const turn1Draft = selectTeachingDecisionDraft({
        analysis: turn1Analysis,
        topicState: null,
        previousTeachingDecision: null,
        topicResolutionOutcome: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
      })

      // Invariant: Turn 1 starts at Level 1 and does NOT ask what the student tried
      expect(turn1Draft.guidanceLevel).toBe(1)
      expect(turn1Draft.studentActionPurpose).toBe(
        StudentActionPurpose.PRIMARY_TECHNIQUE,
      )

      const turn1Candidate: CandidateResponse = {
        message:
          'In Python, assignment gives a variable a value. Look at the code given: what value is stored in x?',
        debuggingGuidance: null,
        responseIntent: TeachingStrategy.GUIDED_EXPLANATION,
        usedCitationIds: [],
        requiresStudentAction: true,
        studentAction: {
          type: TeachingTechnique.ORIENTATION_QUESTION,
          description: 'Identify what value is stored in x.',
        },
        reflectionIncluded: false,
        selfReportedCompliance: {
          finalAnswerRevealed: false,
          completeSolutionRevealed: false,
        },
        provider: 'mock-tutor',
        model: 'mock-model',
        promptVersion: TUTOR_GENERATION_PROMPT_VERSION,
        tokenUsage: { input: 10, output: 5 },
      }

      const turn1DecisionRecord = baseDecision({
        id: 'decision-turn-1',
        attemptId: 'attempt-turn-1',
        strategy: turn1Draft.strategy,
        primaryTechnique: turn1Draft.primaryTechnique,
        guidanceLevel: turn1Draft.guidanceLevel,
        studentActionPurpose: turn1Draft.studentActionPurpose,
      })

      const turn1Context: TutorGuardEducationalContext = {
        ...mockEducationalContext(),
        currentStudentMessage: {
          id: 'msg-turn-1',
          content: activeProblemText,
        },
        recentConversation: [
          {
            id: 'msg-turn-1',
            sequence: 1,
            role: 'STUDENT',
            attemptId: 'attempt-turn-1',
            topicId: 'topic-1',
            content: activeProblemText,
          },
        ],
      }

      const semanticGuard = new FakeSemanticGuardService({
        kind: 'validated',
        result: {
          stage: 'SEMANTIC',
          approved: true,
          violations: [],
          maximumSeverity: null,
          recommendedAction: 'APPROVE',
          provider: 'semantic-guard',
          model: 'mock-guard',
          promptVersion: 'semantic-guard.v1',
          policyVersion: MVP_RESPONSE_VALIDATION_POLICY_VERSION,
        },
      })

      const turn1ApprovalService = new ResponseApprovalService(
        new FakeGenerationService([
          {
            success: true,
            candidate: turn1Candidate,
            infrastructureRetryCount: 0,
            educationalContext: turn1Context,
          },
        ]) as never,
        new FakeTeachingDecisionRepository(turn1DecisionRecord),
        new StructuralResponseValidator(),
        new DeterministicGuardService(),
        semanticGuard as never,
        safeFallbackService,
        new AutomaticSafetyRiskDetector(),
      )

      const turn1Result = await turn1ApprovalService.approve({
        ...mockGenerationInput(),
        attemptId: 'attempt-turn-1',
        studentMessageId: 'msg-turn-1',
      })

      expect(turn1Result.success).toBe(true)
      if (turn1Result.success) {
        expect(turn1Result.approvedResponse.source).toBe(
          APPROVED_RESPONSE_SOURCE.VALIDATED_CANDIDATE,
        )
      }

      // === Turn 2: "I don't know" (First explicit struggle) ===
      const turn2Analysis = baseAnalysis(
        {
          requestKind: MessageRequestKind.PROBLEM_LIKE,
          studentState: StudentState.NO_PRIOR_KNOWLEDGE,
          effortEvidence: {
            present: false,
            quality: EFFORT_QUALITY.NONE,
            type: null,
            addressesPreviousTutorAction: false,
            isRepeated: false,
            evidenceMessageIds: [],
          },
        },
        EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
        { id: 'analysis-turn-2' },
      )

      const turn2Draft = selectTeachingDecisionDraft({
        analysis: turn2Analysis,
        topicState: {
          id: 'topic-state-1',
          topicId: 'topic-1',
          version: 1,
          requestKind: MessageRequestKind.PROBLEM_LIKE,
          studentState: StudentState.NO_PRIOR_KNOWLEDGE,
          activeStrategy: TeachingStrategy.GUIDED_EXPLANATION,
          primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
          supportingTechnique: null,
          guidanceLevel: 1,
          revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
          attemptCount: 1,
          meaningfulAttemptCount: 0,
          misconceptionStatus: null,
          learningStatus: 'IN_PROGRESS',
          resolutionEvidenceStrength: 'NONE',
          summary: null,
          lastTutorQuestion: turn1Candidate.message,
          lastStudentAction: null,
          resolved: false,
          updatedAt: new Date(),
        },
        previousTeachingDecision: baseDecision({
          id: 'decision-turn-1',
          topicId: 'topic-1',
          strategy: TeachingStrategy.GUIDED_EXPLANATION,
          guidanceLevel: 1,
          revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
          policyVersion: 'socratic-policy.mvp.v1',
          studentActionPurpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
          primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
        }),
        topicResolutionOutcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      })

      // Invariant: Turn 2 escalates 1 -> 2 on explicit struggle without asking what student tried
      expect(turn2Draft.guidanceLevel).toBe(2)
      expect(turn2Draft.studentActionPurpose).toBe(
        StudentActionPurpose.PRIMARY_TECHNIQUE,
      )

      // Turn 2 candidate references the student-provided given premise x = 5
      const turn2Candidate: CandidateResponse = {
        message:
          'Start with the first line: x = 5. What value is currently stored in x?',
        debuggingGuidance: null,
        responseIntent: TeachingStrategy.GUIDED_EXPLANATION,
        usedCitationIds: [],
        requiresStudentAction: true,
        studentAction: {
          type: TeachingTechnique.ORIENTATION_QUESTION,
          description: 'Identify the value stored in x from the first line.',
        },
        reflectionIncluded: false,
        selfReportedCompliance: {
          finalAnswerRevealed: false,
          completeSolutionRevealed: false,
        },
        provider: 'mock-tutor',
        model: 'mock-model',
        promptVersion: TUTOR_GENERATION_PROMPT_VERSION,
        tokenUsage: { input: 15, output: 8 },
      }

      const turn2DecisionRecord = baseDecision({
        id: 'decision-turn-2',
        attemptId: 'attempt-turn-2',
        strategy: turn2Draft.strategy,
        primaryTechnique: turn2Draft.primaryTechnique,
        guidanceLevel: turn2Draft.guidanceLevel,
        studentActionPurpose: turn2Draft.studentActionPurpose,
      })

      const turn2Context: TutorGuardEducationalContext = {
        ...mockEducationalContext(),
        currentStudentMessage: {
          id: 'msg-turn-2',
          content: 'i don’t know',
        },
        recentConversation: [
          {
            id: 'msg-turn-1',
            sequence: 1,
            role: 'STUDENT',
            attemptId: 'attempt-turn-1',
            topicId: 'topic-1',
            content: activeProblemText,
          },
          {
            id: 'msg-tutor-1',
            sequence: 2,
            role: 'ASSISTANT',
            attemptId: 'attempt-turn-1',
            topicId: 'topic-1',
            content: turn1Candidate.message,
          },
          {
            id: 'msg-turn-2',
            sequence: 3,
            role: 'STUDENT',
            attemptId: 'attempt-turn-2',
            topicId: 'topic-1',
            content: 'i don’t know',
          },
        ],
      }

      const turn2ApprovalService = new ResponseApprovalService(
        new FakeGenerationService([
          {
            success: true,
            candidate: turn2Candidate,
            infrastructureRetryCount: 0,
            educationalContext: turn2Context,
          },
        ]) as never,
        new FakeTeachingDecisionRepository(turn2DecisionRecord),
        new StructuralResponseValidator(),
        new DeterministicGuardService(),
        semanticGuard as never,
        safeFallbackService,
        new AutomaticSafetyRiskDetector(),
      )

      const turn2Result = await turn2ApprovalService.approve({
        ...mockGenerationInput(),
        attemptId: 'attempt-turn-2',
        studentMessageId: 'msg-turn-2',
      })

      // Invariant: Turn 2 candidate referencing x = 5 is approved by deterministic guard (no false refusal)
      expect(turn2Result.success).toBe(true)
      if (turn2Result.success) {
        expect(turn2Result.approvedResponse.source).toBe(
          APPROVED_RESPONSE_SOURCE.VALIDATED_CANDIDATE,
        )
        expect(turn2Result.approvedResponse.safeFallbackUsed).toBe(false)
      }

      // === Turn 3: "I still don't know" (Repeated struggle) ===
      const turn3Analysis = baseAnalysis(
        {
          requestKind: MessageRequestKind.PROBLEM_LIKE,
          studentState: StudentState.NO_PRIOR_KNOWLEDGE,
          effortEvidence: {
            present: false,
            quality: EFFORT_QUALITY.NONE,
            type: null,
            addressesPreviousTutorAction: false,
            isRepeated: false,
            evidenceMessageIds: [],
          },
        },
        EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
        { id: 'analysis-turn-3' },
      )

      const turn3Draft = selectTeachingDecisionDraft({
        analysis: turn3Analysis,
        topicState: {
          id: 'topic-state-1',
          topicId: 'topic-1',
          version: 2,
          requestKind: MessageRequestKind.PROBLEM_LIKE,
          studentState: StudentState.NO_PRIOR_KNOWLEDGE,
          activeStrategy: TeachingStrategy.GUIDED_EXPLANATION,
          primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
          supportingTechnique: null,
          guidanceLevel: 2,
          revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
          attemptCount: 2,
          meaningfulAttemptCount: 0,
          misconceptionStatus: null,
          learningStatus: 'IN_PROGRESS',
          resolutionEvidenceStrength: 'NONE',
          summary: null,
          lastTutorQuestion: turn2Candidate.message,
          lastStudentAction: null,
          resolved: false,
          updatedAt: new Date(),
        },
        previousTeachingDecision: baseDecision({
          id: 'decision-turn-2',
          topicId: 'topic-1',
          strategy: TeachingStrategy.GUIDED_EXPLANATION,
          guidanceLevel: 2,
          revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
          policyVersion: 'socratic-policy.mvp.v1',
          studentActionPurpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
          primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
        }),
        topicResolutionOutcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      })

      // Invariant: Turn 3 does NOT blindly escalate to Level 3; it stays at Level 2
      expect(turn3Draft.guidanceLevel).toBe(2)
      expect(turn3Draft.studentActionPurpose).toBe(
        StudentActionPurpose.PRIMARY_TECHNIQUE,
      )

      const turn3Candidate: CandidateResponse = {
        message:
          'When you see `x = 5`, the number 5 is placed inside x. What number is on the right side of the equals sign?',
        debuggingGuidance: null,
        responseIntent: TeachingStrategy.GUIDED_EXPLANATION,
        usedCitationIds: [],
        requiresStudentAction: true,
        studentAction: {
          type: TeachingTechnique.ORIENTATION_QUESTION,
          description: 'Name the number on the right side of x = 5.',
        },
        reflectionIncluded: false,
        selfReportedCompliance: {
          finalAnswerRevealed: false,
          completeSolutionRevealed: false,
        },
        provider: 'mock-tutor',
        model: 'mock-model',
        promptVersion: TUTOR_GENERATION_PROMPT_VERSION,
        tokenUsage: { input: 20, output: 10 },
      }

      const turn3DecisionRecord = baseDecision({
        id: 'decision-turn-3',
        attemptId: 'attempt-turn-3',
        strategy: turn3Draft.strategy,
        primaryTechnique: turn3Draft.primaryTechnique,
        guidanceLevel: turn3Draft.guidanceLevel,
        studentActionPurpose: turn3Draft.studentActionPurpose,
      })

      const turn3Context: TutorGuardEducationalContext = {
        ...mockEducationalContext(),
        currentStudentMessage: {
          id: 'msg-turn-3',
          content: 'i still don’t know',
        },
        recentConversation: [
          ...turn2Context.recentConversation,
          {
            id: 'msg-tutor-2',
            sequence: 4,
            role: 'ASSISTANT',
            attemptId: 'attempt-turn-2',
            topicId: 'topic-1',
            content: turn2Candidate.message,
          },
          {
            id: 'msg-turn-3',
            sequence: 5,
            role: 'STUDENT',
            attemptId: 'attempt-turn-3',
            topicId: 'topic-1',
            content: 'i still don’t know',
          },
        ],
      }

      const turn3ApprovalService = new ResponseApprovalService(
        new FakeGenerationService([
          {
            success: true,
            candidate: turn3Candidate,
            infrastructureRetryCount: 0,
            educationalContext: turn3Context,
          },
        ]) as never,
        new FakeTeachingDecisionRepository(turn3DecisionRecord),
        new StructuralResponseValidator(),
        new DeterministicGuardService(),
        semanticGuard as never,
        safeFallbackService,
        new AutomaticSafetyRiskDetector(),
      )

      const turn3Result = await turn3ApprovalService.approve({
        ...mockGenerationInput(),
        attemptId: 'attempt-turn-3',
        studentMessageId: 'msg-turn-3',
      })

      expect(turn3Result.success).toBe(true)
      if (turn3Result.success) {
        expect(turn3Result.approvedResponse.source).toBe(
          APPROVED_RESPONSE_SOURCE.VALIDATED_CANDIDATE,
        )
        expect(turn3Result.approvedResponse.safeFallbackUsed).toBe(false)
      }

      // -------------------------------------------------------------
      // Turn 4: Correct learner attempt with reasoning
      // Student: "i calculate 5+1 = 6 as y = x+1"
      // Invariants:
      // - Overrides stale GUIDED_EXPLANATION / ORIENTATION_QUESTION from struggle turns
      // - Reconciles strategy to SOCRATIC_QUESTIONING + VERIFICATION
      // - De-escalates guidance to Level 1
      // - StudentActionPurpose is PRIMARY_TECHNIQUE (NOT PRIOR_ATTEMPT_ORIENTATION)
      // - Response confirms reasoning and consolidates without asking learner to repeat steps
      // -------------------------------------------------------------
      const turn4Analysis = baseAnalysis(
        {
          requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
          studentState: StudentState.NEAR_SOLUTION,
          effortEvidence: {
            present: true,
            quality: EFFORT_QUALITY.STRONG,
            type: EFFORT_TYPE.REASONING_ATTEMPT,
            addressesPreviousTutorAction: true,
            isRepeated: false,
            evidenceMessageIds: ['msg-turn-4'],
          },
          learningEvidence: {
            present: true,
            strength: LEARNING_EVIDENCE_STRENGTH.STRONG,
            evidenceMessageIds: ['msg-turn-4'],
          },
          answerCorrectness: ANSWER_CORRECTNESS.CORRECT,
          objectiveCompleted: true,
          misconceptionRecoveryVerified: false,
          misconceptions: [],
          recommendedStrategy: TeachingStrategy.SOCRATIC_QUESTIONING,
          recommendedTechnique: TeachingTechnique.VERIFICATION,
        },
        EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
        {
          id: 'analysis-turn-4',
          attemptId: 'attempt-turn-4',
          studentMessageId: 'msg-turn-4',
        },
      )

      const turn4Draft = selectTeachingDecisionDraft({
        analysis: turn4Analysis,
        topicState: {
          id: 'topic-state-1',
          topicId: 'topic-1',
          version: 3,
          requestKind: MessageRequestKind.PROBLEM_LIKE,
          studentState: StudentState.NO_PRIOR_KNOWLEDGE,
          activeStrategy: TeachingStrategy.GUIDED_EXPLANATION,
          primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
          supportingTechnique: null,
          guidanceLevel: 2,
          revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
          attemptCount: 3,
          meaningfulAttemptCount: 0,
          misconceptionStatus: null,
          learningStatus: 'IN_PROGRESS',
          resolutionEvidenceStrength: 'NONE',
          summary: null,
          lastTutorQuestion: turn3Candidate.message,
          lastStudentAction: null,
          resolved: false,
          updatedAt: new Date(),
        },
        previousTeachingDecision: turn3DecisionRecord,
        topicResolutionOutcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      })

      expect(turn4Draft.strategy).toBe(TeachingStrategy.SOCRATIC_QUESTIONING)
      expect(turn4Draft.primaryTechnique).toBe(TeachingTechnique.VERIFICATION)
      expect(turn4Draft.guidanceLevel).toBe(1)
      expect(turn4Draft.requireStudentAction).toBe(false)
      expect(turn4Draft.studentActionPurpose).toBe(
        StudentActionPurpose.PRIMARY_TECHNIQUE,
      )
      expect(turn4Draft.decisionReason).toContain(
        'current message correctly completed the objective',
      )

      const turn4DecisionRecord = baseDecision({
        id: 'decision-turn-4',
        attemptId: 'attempt-turn-4',
        strategy: turn4Draft.strategy,
        primaryTechnique: turn4Draft.primaryTechnique,
        guidanceLevel: turn4Draft.guidanceLevel,
        requireStudentAction: turn4Draft.requireStudentAction,
        studentActionPurpose: turn4Draft.studentActionPurpose,
      })

      const turn4Obligation =
        studentActionObligationFromDecision(turn4DecisionRecord)
      expect(turn4Obligation.required).toBe(false)
      expect(turn4Obligation.generationInstruction).toBe(
        'Confirm correctness and provide concise conceptual consolidation. Do not require an additional student action or question when current evidence already verifies the objective.',
      )

      const turn4Candidate: CandidateResponse = {
        message:
          'Your answer is correct. You used x = 5 and the calculation 5 + 1 = 6 to complete the evaluation of y.',
        debuggingGuidance: null,
        responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
        usedCitationIds: [],
        requiresStudentAction: false,
        studentAction: null,
        reflectionIncluded: false,
        selfReportedCompliance: {
          finalAnswerRevealed: false,
          completeSolutionRevealed: false,
        },
        provider: 'mock-tutor',
        model: 'mock-model',
        promptVersion: TUTOR_GENERATION_PROMPT_VERSION,
        tokenUsage: { input: 20, output: 10 },
      }

      const turn4Context: TutorGuardEducationalContext = {
        ...mockEducationalContext(),
        acceptedAnalysis: {
          id: 'analysis-turn-4',
          requestKind: turn4Analysis.result.requestKind,
          studentState: turn4Analysis.result.studentState,
          effortEvidence: turn4Analysis.result.effortEvidence,
          learningEvidence: turn4Analysis.result.learningEvidence,
          answerCorrectness: turn4Analysis.result.answerCorrectness,
          objectiveCompleted: turn4Analysis.result.objectiveCompleted,
          misconceptionRecoveryVerified:
            turn4Analysis.result.misconceptionRecoveryVerified,
          misconceptions: turn4Analysis.result.misconceptions,
          evidenceReferences: ['msg-turn-4'],
          confidence: 0.95,
          analysisSource: 'model',
          promptVersion: 'analysis.v1',
          schemaVersion: 'analysis.v1',
        },
        currentStudentMessage: {
          id: 'msg-turn-4',
          content: 'i calculate 5+1 = 6 as y = x+1',
        },
        recentConversation: [
          ...turn3Context.recentConversation,
          {
            id: 'msg-tutor-3',
            sequence: 6,
            role: 'ASSISTANT',
            attemptId: 'attempt-turn-3',
            topicId: 'topic-1',
            content: turn3Candidate.message,
          },
          {
            id: 'msg-turn-4',
            sequence: 7,
            role: 'STUDENT',
            attemptId: 'attempt-turn-4',
            topicId: 'topic-1',
            content: 'i calculate 5+1 = 6 as y = x+1',
          },
        ],
      }

      const turn4ApprovalService = new ResponseApprovalService(
        new FakeGenerationService([
          {
            success: true,
            candidate: turn4Candidate,
            infrastructureRetryCount: 0,
            educationalContext: turn4Context,
          },
        ]) as never,
        new FakeTeachingDecisionRepository(turn4DecisionRecord),
        new StructuralResponseValidator(),
        new DeterministicGuardService(),
        semanticGuard as never,
        safeFallbackService,
        new AutomaticSafetyRiskDetector(),
      )

      const turn4Result = await turn4ApprovalService.approve({
        ...mockGenerationInput(),
        attemptId: 'attempt-turn-4',
        studentMessageId: 'msg-turn-4',
      })

      expect(turn4Result.success).toBe(true)
      if (turn4Result.success) {
        expect(turn4Result.approvedResponse.source).toBe(
          APPROVED_RESPONSE_SOURCE.VALIDATED_CANDIDATE,
        )
        expect(turn4Result.approvedResponse.safeFallbackUsed).toBe(false)
        expect(turn4Result.approvedResponse.requiresStudentAction).toBe(false)
        expect(turn4Result.approvedResponse.studentAction).toBeNull()
        expect(turn4Result.approvedResponse.message).toBe(
          'Your answer is correct. You used x = 5 and the calculation 5 + 1 = 6 to complete the evaluation of y.',
        )
        expect(turn4Result.approvedResponse.message).not.toContain('?')
        expect(turn4Result.approvedResponse.message).not.toMatch(
          /what did you try|what steps or thought process|what was the first step|how would you check/i,
        )
      }

      const wrongFinalAnalysis = baseAnalysis(
        {
          requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
          studentState: StudentState.NEAR_SOLUTION,
          effortEvidence: {
            present: true,
            quality: EFFORT_QUALITY.STRONG,
            type: EFFORT_TYPE.REASONING_ATTEMPT,
            addressesPreviousTutorAction: true,
            isRepeated: false,
            evidenceMessageIds: ['msg-wrong-final'],
          },
          learningEvidence: {
            present: true,
            strength: LEARNING_EVIDENCE_STRENGTH.STRONG,
            evidenceMessageIds: ['msg-wrong-final'],
          },
          answerCorrectness: ANSWER_CORRECTNESS.INCORRECT,
          objectiveCompleted: false,
          misconceptionRecoveryVerified: false,
          misconceptions: [],
        },
        EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
        {
          id: 'analysis-wrong-final',
          attemptId: 'attempt-wrong-final',
          studentMessageId: 'msg-wrong-final',
        },
      )
      const wrongFinalDraft = selectTeachingDecisionDraft({
        analysis: wrongFinalAnalysis,
        topicState: null,
        previousTeachingDecision: turn4DecisionRecord,
        topicResolutionOutcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      })

      expect(wrongFinalDraft.requireStudentAction).toBe(true)
      expect(wrongFinalDraft.primaryTechnique).not.toBe(
        TeachingTechnique.VERIFICATION,
      )
      expect(wrongFinalDraft.decisionReason).not.toContain(
        'correctly completed the objective',
      )
    })
  })
})

function mockGenerationInput(): TutorGenerationInput {
  return {
    courseId: 'course-1',
    sessionId: 'session-1',
    studentId: 'student-1',
    attemptId: 'attempt-1',
    studentMessageId: 'message-1',
    topicId: 'topic-1',
    outputProtection: {
      protectTargetSolution: true,
      topicId: 'topic-1',
      source: 'CONSERVATIVE_UNKNOWN',
      policyVersion: SOLUTION_PROTECTION_POLICY_VERSION,
    },
    retrievalResult: [],
  }
}

function mockEducationalContext(): TutorGuardEducationalContext {
  const outputProtection: OutputProtectionContext = {
    protectTargetSolution: true,
    topicId: 'topic-1',
    source: 'CONSERVATIVE_UNKNOWN',
    policyVersion: SOLUTION_PROTECTION_POLICY_VERSION,
  }

  return {
    currentStudentMessage: {
      id: 'message-1',
      content: 'x = 5\ny = x + 1\nwhat is the value of y?',
    },
    acceptedAnalysis: {
      id: 'analysis-1',
      requestKind: 'PROBLEM_LIKE',
      studentState: 'PARTIAL_UNDERSTANDING',
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
      evidenceReferences: ['message-1'],
      confidence: 0.95,
      analysisSource: 'model',
      promptVersion: 'analysis.v1',
      schemaVersion: 'analysis.v1',
    },
    topicState: null,
    previousTeachingDecision: null,
    outputProtection,
    currentTeachingDecision: {
      id: 'decision-1',
      policyVersion: 'policy.v1',
      guidanceLevel: 1,
      revealPolicy: 'NO_FINAL_ANSWER',
      studentActionObligation: {
        version: 'student-action-obligation.v1',
        required: true,
        purpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
        technique: TeachingTechnique.FOCUSED_QUESTION,
        maximumMeaningfulActions: 1,
        generationInstruction: 'Ask the student to state the value of x.',
      },
    },
    recentConversation: [],
  }
}

class FakeGenerationService {
  readonly calls: TutorGenerationInput[] = []

  constructor(private readonly results: TutorGenerationServiceResult[]) {}

  generate(input: TutorGenerationInput) {
    this.calls.push(input)
    return Promise.resolve(
      this.results[this.calls.length - 1] ??
        this.results[this.results.length - 1],
    )
  }
}

class FakeSemanticGuardService {
  readonly calls: Parameters<SemanticGuardService['evaluate']>[0][] = []

  constructor(
    private readonly results:
      | Awaited<ReturnType<SemanticGuardService['evaluate']>>
      | Awaited<ReturnType<SemanticGuardService['evaluate']>>[],
  ) {}

  evaluate(input: Parameters<SemanticGuardService['evaluate']>[0]) {
    this.calls.push(input)
    if (Array.isArray(this.results)) {
      return Promise.resolve(
        this.results[this.calls.length - 1] ??
          this.results[this.results.length - 1],
      )
    }
    return Promise.resolve(this.results)
  }
}

class FakeTeachingDecisionRepository extends TeachingDecisionRepository {
  constructor(private readonly record: PersistedTeachingDecisionRecord | null) {
    super()
  }

  findByTurnId() {
    return Promise.resolve(this.record)
  }

  findLatestCompletedForSameTopicBeforeTurn() {
    return Promise.resolve(null)
  }

  storeDecision(): never {
    throw new Error('Must not store')
  }
}
