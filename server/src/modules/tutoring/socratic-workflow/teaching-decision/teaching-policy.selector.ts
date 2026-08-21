import {
  MessageRequestKind,
  ReflectionMode,
  RevealPolicy,
  StudentActionPurpose,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
} from '../../tutoring-values'
import type { PersistedEducationalAnalysisRecord } from '../analysis/educational-analysis.repository'
import {
  ANSWER_CORRECTNESS,
  EDUCATIONAL_ANALYSIS_SOURCE,
  EFFORT_QUALITY,
  LEARNING_EVIDENCE_STRENGTH,
} from '../analysis/educational-analysis.types'
import type { TopicStateSnapshot } from '../topic/topic-state.types'
import {
  TOPIC_RESOLUTION_OUTCOME,
  type TopicResolutionOutcome,
} from '../topic/topic.types'
import {
  TEACHING_POLICY_VERSION,
  type CourseTutorConfiguration,
  type PreviousTeachingDecisionSnapshot,
  type TeachingGuardPolicy,
  type TeachingPolicyDefaults,
} from './teaching-policy.types'
import { isDirectConceptualAnalysis } from './direct-conceptual-policy'
import { hasSupportedMisconceptionRecoveryEvidence } from '../analysis/supported-misconception-recovery'

export interface TeachingDecisionPolicyDraft {
  attemptId: string
  topicId: string
  analysisId: string
  strategy: TeachingStrategy
  primaryTechnique: TeachingTechnique
  supportingTechnique: TeachingTechnique | null
  guidanceLevel: number
  revealPolicy: RevealPolicy
  reflectionMode: ReflectionMode
  requireStudentAction: boolean
  studentActionPurpose: StudentActionPurpose
  guardPolicy: TeachingGuardPolicy
  decisionReason: string
  policyVersion: string
}

export interface SelectTeachingDecisionInput {
  analysis: PersistedEducationalAnalysisRecord
  topicState: TopicStateSnapshot | null
  previousTeachingDecision: PreviousTeachingDecisionSnapshot | null
  topicResolutionOutcome?: TopicResolutionOutcome
  previousTopicId?: string | null
  courseTutorConfiguration?: CourseTutorConfiguration | null
}

const canonicalStrategies = new Set<TeachingStrategy>(
  Object.values(TeachingStrategy),
)

const fixedGuardPolicy: TeachingGuardPolicy = {
  preventDirectAnswer: true,
  preventFinalResult: true,
  preventCompleteSolution: true,
  preventSubmissionReadyCode: true,
  preventProtectedCodeLeakage: true,
  requireStudentReasoning: true,
  requireGrounding: true,
  enforceCitationSupport: true,
  maximumDisclosedSteps: 1,
}

const strategyByStudentState = {
  [StudentState.NO_PRIOR_KNOWLEDGE]: TeachingStrategy.GUIDED_EXPLANATION,
  [StudentState.PARTIAL_UNDERSTANDING]: TeachingStrategy.SOCRATIC_QUESTIONING,
  [StudentState.MISCONCEPTION]: TeachingStrategy.MISCONCEPTION_REPAIR,
  [StudentState.DEBUGGING_ISSUE]: TeachingStrategy.DEBUGGING_GUIDANCE,
  [StudentState.NEAR_SOLUTION]: TeachingStrategy.SOCRATIC_QUESTIONING,
  [StudentState.UNKNOWN]: TeachingStrategy.SOCRATIC_QUESTIONING,
} satisfies Record<StudentState, TeachingStrategy>

const primaryTechniqueByStrategy = {
  [TeachingStrategy.GUIDED_EXPLANATION]: TeachingTechnique.ORIENTATION_QUESTION,
  [TeachingStrategy.SOCRATIC_QUESTIONING]: TeachingTechnique.FOCUSED_QUESTION,
  [TeachingStrategy.MISCONCEPTION_REPAIR]: TeachingTechnique.COUNTEREXAMPLE,
  [TeachingStrategy.DEBUGGING_GUIDANCE]: TeachingTechnique.TRACE_EXECUTION,
} satisfies Record<TeachingStrategy, TeachingTechnique>

const blockedStates = new Set<StudentState>([
  StudentState.NO_PRIOR_KNOWLEDGE,
  StudentState.PARTIAL_UNDERSTANDING,
  StudentState.MISCONCEPTION,
  StudentState.DEBUGGING_ISSUE,
])

const restorableTopicOutcomes = new Set<TopicResolutionOutcome>([
  TOPIC_RESOLUTION_OUTCOME.RESUME_PREVIOUS_TOPIC,
  TOPIC_RESOLUTION_OUTCOME.REOPEN_EXISTING_TOPIC,
])

export function selectTeachingDecisionDraft(
  input: SelectTeachingDecisionInput,
): TeachingDecisionPolicyDraft {
  const defaults = teachingPolicyDefaults(input.courseTutorConfiguration)
  const misconceptionRecovered = isMisconceptionRecovery(input)
  const solutionVerified = isSolutionVerification(input)
  const strategy = selectTeachingStrategy(input)
  const guidanceLevel = calculateGuidanceLevel(input, defaults)
  const directConceptual = isDirectConceptualAnalysis(input.analysis.result)
  const primaryTechnique =
    misconceptionRecovered || solutionVerified
      ? TeachingTechnique.VERIFICATION
      : primaryTechniqueForStrategy(strategy)
  const requireStudentAction = !solutionVerified

  return {
    attemptId: input.analysis.attemptId,
    topicId: input.analysis.topicId,
    analysisId: input.analysis.id,
    strategy,
    primaryTechnique,
    supportingTechnique: null,
    guidanceLevel,
    revealPolicy: directConceptual
      ? RevealPolicy.PARTIAL_RESULT_ALLOWED
      : defaults.defaultRevealPolicy,
    reflectionMode: ReflectionMode.NONE,
    requireStudentAction,
    studentActionPurpose: selectStudentActionPurpose({
      analysis: input.analysis,
      directConceptual,
      guidanceLevel,
      primaryTechnique,
    }),
    guardPolicy: directConceptual
      ? { ...fixedGuardPolicy, preventDirectAnswer: false }
      : requireStudentAction
        ? fixedGuardPolicy
        : { ...fixedGuardPolicy, requireStudentReasoning: false },
    decisionReason: decisionReasonFor(input, strategy, guidanceLevel),
    policyVersion: TEACHING_POLICY_VERSION,
  }
}

function isVagueOrIncompleteAttempt(
  analysis: PersistedEducationalAnalysisRecord['result'],
): boolean {
  const effort = analysis.effortEvidence
  const learning = analysis.learningEvidence
  const hasLearning =
    learning.present && learning.strength !== LEARNING_EVIDENCE_STRENGTH.NONE
  const hasMisconception =
    analysis.misconceptions.length > 0 ||
    analysis.studentState === StudentState.MISCONCEPTION
  const isNearSolution = analysis.studentState === StudentState.NEAR_SOLUTION
  const hasConcreteMeaningfulEffort =
    (effort.quality === EFFORT_QUALITY.MEANINGFUL ||
      effort.quality === EFFORT_QUALITY.STRONG) &&
    effort.type !== null

  return (
    effort.present &&
    !hasLearning &&
    !hasMisconception &&
    !isNearSolution &&
    (!hasConcreteMeaningfulEffort || effort.quality === EFFORT_QUALITY.LOW)
  )
}

function selectStudentActionPurpose(input: {
  readonly analysis: PersistedEducationalAnalysisRecord
  readonly directConceptual: boolean
  readonly guidanceLevel: number
  readonly primaryTechnique: TeachingTechnique
}): StudentActionPurpose {
  if (input.directConceptual) {
    return StudentActionPurpose.CONCEPTUAL_UNDERSTANDING
  }

  if (
    isVagueOrIncompleteAttempt(input.analysis.result) &&
    input.primaryTechnique === TeachingTechnique.ORIENTATION_QUESTION
  ) {
    return StudentActionPurpose.PRIOR_ATTEMPT_ORIENTATION
  }

  return StudentActionPurpose.PRIMARY_TECHNIQUE
}

export function selectTeachingStrategy(
  input: Pick<
    SelectTeachingDecisionInput,
    'analysis' | 'previousTeachingDecision' | 'topicResolutionOutcome'
  >,
): TeachingStrategy {
  const state = input.analysis.result.studentState
  const requestKind = input.analysis.result.requestKind

  if (hasAuthoritativeTopicConflict(input)) {
    return TeachingStrategy.SOCRATIC_QUESTIONING
  }
  if (isDirectConceptualAnalysis(input.analysis.result)) {
    return TeachingStrategy.GUIDED_EXPLANATION
  }
  if (
    input.analysis.analysisSource === EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK ||
    state === StudentState.UNKNOWN
  ) {
    return TeachingStrategy.SOCRATIC_QUESTIONING
  }

  if (isMisconceptionRecovery(input)) {
    return TeachingStrategy.SOCRATIC_QUESTIONING
  }

  if (canPreservePreviousStrategy(input)) {
    if (
      state === StudentState.MISCONCEPTION &&
      input.analysis.result.misconceptions.length > 0
    ) {
      return TeachingStrategy.MISCONCEPTION_REPAIR
    }
    if (
      state === StudentState.DEBUGGING_ISSUE &&
      requestKind === MessageRequestKind.CODE_DIAGNOSIS
    ) {
      return TeachingStrategy.DEBUGGING_GUIDANCE
    }
    // Never preserve DEBUGGING_GUIDANCE when current turn is not a debugging issue / diagnosis
    if (
      input.previousTeachingDecision.strategy ===
        TeachingStrategy.DEBUGGING_GUIDANCE &&
      requestKind !== MessageRequestKind.CODE_DIAGNOSIS &&
      state !== StudentState.DEBUGGING_ISSUE
    ) {
      return strategyByStudentState[state]
    }
    // Never preserve GUIDED_EXPLANATION when learner evidence demonstrates meaningful progress or state transition
    if (
      input.previousTeachingDecision.strategy ===
        TeachingStrategy.GUIDED_EXPLANATION &&
      hasMeaningfulLearnerProgress(input.analysis)
    ) {
      return strategyByStudentState[state]
    }

    return input.previousTeachingDecision.strategy
  }

  return strategyByStudentState[state]
}

export function primaryTechniqueForStrategy(
  strategy: TeachingStrategy,
): TeachingTechnique {
  return primaryTechniqueByStrategy[strategy]
}

export function calculateGuidanceLevel(
  input: SelectTeachingDecisionInput,
  defaults: TeachingPolicyDefaults = teachingPolicyDefaults(
    input.courseTutorConfiguration,
  ),
): number {
  const currentLevel = currentGuidanceLevel(input)

  if (hasAuthoritativeTopicConflict(input) || isNewOrSwitchedTopic(input)) {
    return 1
  }
  if (
    input.analysis.analysisSource === EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK ||
    input.analysis.result.studentState === StudentState.UNKNOWN
  ) {
    return 1
  }
  if (currentLevel === null) {
    return 1
  }

  if (isRestoredTopic(input)) {
    return capGuidanceLevel(currentLevel, defaults.maximumGuidanceLevel)
  }

  if (hasEscalationEvidence(input)) {
    return capGuidanceLevel(currentLevel + 1, defaults.maximumGuidanceLevel)
  }
  if (hasVerifiedLearningEvidence(input.analysis)) {
    return capGuidanceLevel(currentLevel - 1, defaults.maximumGuidanceLevel)
  }

  return capGuidanceLevel(currentLevel, defaults.maximumGuidanceLevel)
}

export function teachingPolicyDefaults(
  configuration?: CourseTutorConfiguration | null,
): TeachingPolicyDefaults {
  return {
    maximumGuidanceLevel: normalizeMaximumGuidanceLevel(
      configuration?.maximumGuidanceLevel,
    ),
    defaultRevealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    reflectionEnabled: false,
  }
}

export function fixedTeachingGuardPolicy(): TeachingGuardPolicy {
  return { ...fixedGuardPolicy }
}

function canPreservePreviousStrategy(
  input: Pick<
    SelectTeachingDecisionInput,
    'analysis' | 'previousTeachingDecision' | 'topicResolutionOutcome'
  >,
): input is Pick<SelectTeachingDecisionInput, 'analysis'> & {
  previousTeachingDecision: PreviousTeachingDecisionSnapshot
} {
  const previous = input.previousTeachingDecision

  return (
    previous !== null &&
    previous.topicId === input.analysis.topicId &&
    canonicalStrategies.has(previous.strategy) &&
    !isNewOrSwitchedTopic(input)
  )
}

export function isMisconceptionRecovery(
  input: Pick<
    SelectTeachingDecisionInput,
    'analysis' | 'previousTeachingDecision' | 'topicResolutionOutcome'
  >,
): boolean {
  return (
    canPreservePreviousStrategy(input) &&
    input.previousTeachingDecision.strategy ===
      TeachingStrategy.MISCONCEPTION_REPAIR &&
    hasSupportedMisconceptionRecoveryEvidence(input.analysis)
  )
}

function currentGuidanceLevel(
  input: SelectTeachingDecisionInput,
): number | null {
  return input.previousTeachingDecision?.guidanceLevel ?? null
}

function isNewOrSwitchedTopic(
  input: Pick<
    SelectTeachingDecisionInput,
    'analysis' | 'previousTeachingDecision' | 'topicResolutionOutcome'
  >,
): boolean {
  const previousTopicId = input.previousTeachingDecision?.topicId
  return (
    authoritativeTopicOutcome(input) ===
      TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC ||
    (typeof previousTopicId === 'string' &&
      previousTopicId !== input.analysis.topicId)
  )
}

function isRestoredTopic(input: SelectTeachingDecisionInput): boolean {
  return restorableTopicOutcomes.has(authoritativeTopicOutcome(input))
}

function hasEscalationEvidence(input: SelectTeachingDecisionInput): boolean {
  if (
    input.previousTeachingDecision === null ||
    authoritativeTopicOutcome(input) !==
      TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC
  ) {
    return false
  }

  const effort = input.analysis.result.effortEvidence
  const state = input.analysis.result.studentState

  if (effort.isRepeated) {
    return false
  }

  if (state === StudentState.NO_PRIOR_KNOWLEDGE) {
    if (!effort.present) {
      return currentGuidanceLevel(input) === 1
    }
  }

  return (
    blockedStates.has(state) &&
    effort.present &&
    effort.type !== null &&
    effort.addressesPreviousTutorAction &&
    effort.evidenceMessageIds.includes(input.analysis.studentMessageId) &&
    (effort.quality === EFFORT_QUALITY.MEANINGFUL ||
      effort.quality === EFFORT_QUALITY.STRONG)
  )
}

function hasVerifiedLearningEvidence(
  analysis: PersistedEducationalAnalysisRecord,
): boolean {
  const evidence = analysis.result.learningEvidence

  return (
    evidence.present &&
    evidence.evidenceMessageIds.includes(analysis.studentMessageId) &&
    (evidence.strength === LEARNING_EVIDENCE_STRENGTH.MODERATE ||
      evidence.strength === LEARNING_EVIDENCE_STRENGTH.STRONG)
  )
}

function authoritativeTopicOutcome(
  input: Pick<
    SelectTeachingDecisionInput,
    'analysis' | 'topicResolutionOutcome'
  >,
): TopicResolutionOutcome {
  return input.topicResolutionOutcome ?? input.analysis.result.topicRelation
}

function hasAuthoritativeTopicConflict(
  input: Pick<
    SelectTeachingDecisionInput,
    'analysis' | 'topicResolutionOutcome'
  >,
): boolean {
  return (
    input.topicResolutionOutcome !== undefined &&
    input.analysis.result.topicRelation !==
      TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC &&
    input.topicResolutionOutcome !== input.analysis.result.topicRelation
  )
}

function capGuidanceLevel(level: number, maximum: number): number {
  return Math.min(Math.max(level, 1), maximum)
}

function normalizeMaximumGuidanceLevel(level: number | undefined): number {
  if (level === undefined || !Number.isSafeInteger(level)) {
    return 4
  }

  return capGuidanceLevel(level, 4)
}

export function isSolutionVerification(
  input: Pick<
    SelectTeachingDecisionInput,
    'analysis' | 'previousTeachingDecision' | 'topicResolutionOutcome'
  >,
): boolean {
  const analysis = input.analysis
  const result = analysis.result

  if (isDirectConceptualAnalysis(result)) {
    return false
  }

  if (
    input.previousTeachingDecision?.strategy ===
    TeachingStrategy.MISCONCEPTION_REPAIR
  ) {
    return false
  }

  return (
    analysis.analysisSource === EDUCATIONAL_ANALYSIS_SOURCE.MODEL &&
    result.requestKind === MessageRequestKind.ATTEMPT_DIAGNOSIS &&
    result.answerCorrectness === ANSWER_CORRECTNESS.CORRECT &&
    result.objectiveCompleted === true &&
    result.misconceptions.length === 0 &&
    result.studentState === StudentState.NEAR_SOLUTION &&
    result.learningEvidence.present &&
    result.learningEvidence.strength === LEARNING_EVIDENCE_STRENGTH.STRONG &&
    result.learningEvidence.evidenceMessageIds.includes(
      analysis.studentMessageId,
    )
  )
}

function hasMeaningfulLearnerProgress(
  analysis: PersistedEducationalAnalysisRecord,
): boolean {
  const result = analysis.result
  const state = result.studentState
  const effort = result.effortEvidence

  if (state === StudentState.NEAR_SOLUTION) {
    return true
  }

  if (hasVerifiedLearningEvidence(analysis)) {
    return true
  }

  if (
    state === StudentState.PARTIAL_UNDERSTANDING &&
    effort.present &&
    !effort.isRepeated &&
    (effort.quality === EFFORT_QUALITY.MEANINGFUL ||
      effort.quality === EFFORT_QUALITY.STRONG)
  ) {
    return true
  }

  return false
}

function decisionReasonFor(
  input: SelectTeachingDecisionInput,
  strategy: TeachingStrategy,
  guidanceLevel: number,
): string {
  const analysis = input.analysis
  const state = analysis.result.studentState
  if (hasAuthoritativeTopicConflict(input)) {
    return 'Selected conservative Level 1 Socratic guidance because authoritative TopicResolution conflicts with the accepted analysis topic relation.'
  }

  const reason = isMisconceptionRecovery(input)
    ? 'Selected verification-oriented Socratic questioning because strong current-message-supported learning evidence corrected the active misconception.'
    : isSolutionVerification(input)
      ? 'Selected verification-oriented Socratic questioning because the current message correctly completed the objective with strong supporting evidence.'
      : isDirectConceptualAnalysis(analysis.result)
        ? 'Selected guided explanation because the accepted analysis identifies a direct conceptual request without an attempt, misconception, or debugging context.'
        : analysis.analysisSource === EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK
          ? 'Selected conservative Socratic questioning because the accepted analysis is a fallback.'
          : state === StudentState.UNKNOWN
            ? 'Selected conservative Socratic questioning because the accepted analysis uses an unknown student state.'
            : strategy === TeachingStrategy.GUIDED_EXPLANATION
              ? 'Selected guided explanation because the accepted analysis indicates no prior knowledge.'
              : strategy === TeachingStrategy.MISCONCEPTION_REPAIR
                ? 'Selected misconception repair because the accepted analysis contains a supported misconception.'
                : strategy === TeachingStrategy.DEBUGGING_GUIDANCE
                  ? 'Selected debugging guidance because the accepted analysis indicates a debugging issue.'
                  : state === StudentState.NEAR_SOLUTION
                    ? 'Selected Socratic questioning because the accepted analysis indicates the student is near a solution.'
                    : 'Selected Socratic questioning because the accepted analysis indicates partial understanding.'

  return `${reason} ${guidanceTransitionReasonFor(input, guidanceLevel)}`.slice(
    0,
    240,
  )
}

function guidanceTransitionReasonFor(
  input: SelectTeachingDecisionInput,
  guidanceLevel: number,
): string {
  if (isNewOrSwitchedTopic(input)) {
    return 'Reset guidance to Level 1 for the authoritative new or switched topic.'
  }
  if (input.analysis.analysisSource === EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK) {
    return 'Applied conservative Level 1 guidance because fallback analysis cannot support stateful recalibration.'
  }
  if (input.analysis.result.studentState === StudentState.UNKNOWN) {
    return 'Applied conservative Level 1 guidance because an unknown student state cannot support stateful recalibration.'
  }

  const previousLevel = input.previousTeachingDecision?.guidanceLevel ?? null
  if (previousLevel === null) {
    return 'Initialized authoritative guidance at Level 1.'
  }
  if (isRestoredTopic(input)) {
    return 'Restored the latest completed same-topic guidance without recalibration.'
  }
  if (hasEscalationEvidence(input)) {
    return guidanceLevel > previousLevel
      ? 'Escalated guidance by one after meaningful, relevant, non-repeated effort addressing the prior tutor action.'
      : 'Preserved guidance at the configured maximum despite supported escalation evidence.'
  }
  if (hasVerifiedLearningEvidence(input.analysis)) {
    return guidanceLevel < previousLevel
      ? 'De-escalated guidance after current-message-supported learning evidence.'
      : 'Preserved Level 1 because verified learning evidence cannot de-escalate below the minimum.'
  }
  if (guidanceLevel !== previousLevel) {
    return 'Adjusted guidance to the configured maximum.'
  }

  return 'Preserved the latest completed same-topic guidance.'
}
