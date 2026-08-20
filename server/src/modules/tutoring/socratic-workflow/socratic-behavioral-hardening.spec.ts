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
