import {
  ReflectionMode,
  RevealPolicy,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
} from '../../../generated/prisma/client'
import type { PersistedEducationalAnalysisRecord } from './educational-analysis.repository'
import {
  EDUCATIONAL_ANALYSIS_SOURCE,
  EFFORT_QUALITY,
  LEARNING_EVIDENCE_STRENGTH,
} from './educational-analysis.types'
import type { TopicStateSnapshot } from './topic-state.types'
import {
  TOPIC_RESOLUTION_OUTCOME,
  type TopicResolutionOutcome,
} from './topic.types'
import {
  TEACHING_POLICY_VERSION,
  type CourseTutorConfiguration,
  type PreviousTeachingDecisionSnapshot,
  type TeachingGuardPolicy,
  type TeachingPolicyDefaults,
} from './teaching-policy.types'

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
  requireStudentAction: true
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
  const strategy = selectTeachingStrategy(input)
  const guidanceLevel = calculateGuidanceLevel(input, defaults)

  return {
    attemptId: input.analysis.attemptId,
    topicId: input.analysis.topicId,
    analysisId: input.analysis.id,
    strategy,
    primaryTechnique: primaryTechniqueForStrategy(strategy),
    supportingTechnique: null,
    guidanceLevel,
    revealPolicy: defaults.defaultRevealPolicy,
    reflectionMode: ReflectionMode.NONE,
    requireStudentAction: true,
    guardPolicy: fixedGuardPolicy,
    decisionReason: decisionReasonFor(input, strategy, guidanceLevel),
    policyVersion: TEACHING_POLICY_VERSION,
  }
}

export function selectTeachingStrategy(
  input: Pick<
    SelectTeachingDecisionInput,
    'analysis' | 'previousTeachingDecision' | 'topicResolutionOutcome'
  >,
): TeachingStrategy {
  const state = input.analysis.result.studentState

  if (hasAuthoritativeTopicConflict(input)) {
    return TeachingStrategy.SOCRATIC_QUESTIONING
  }
  if (
    input.analysis.analysisSource === EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK ||
    state === StudentState.UNKNOWN
  ) {
    return TeachingStrategy.SOCRATIC_QUESTIONING
  }

  if (canPreservePreviousStrategy(input)) {
    if (
      state === StudentState.MISCONCEPTION &&
      input.analysis.result.misconceptions.length > 0
    ) {
      return TeachingStrategy.MISCONCEPTION_REPAIR
    }
    if (state === StudentState.DEBUGGING_ISSUE) {
      return TeachingStrategy.DEBUGGING_GUIDANCE
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
  if (input.analysis.analysisSource === EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK) {
    return 1
  }
  if (input.analysis.result.studentState === StudentState.UNKNOWN) {
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
  return (
    authoritativeTopicOutcome(input) ===
      TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC ||
    (input.previousTeachingDecision !== null &&
      input.previousTeachingDecision.topicId !== input.analysis.topicId)
  )
}

function isRestoredTopic(input: SelectTeachingDecisionInput): boolean {
  return restorableTopicOutcomes.has(authoritativeTopicOutcome(input))
}

function hasEscalationEvidence(input: SelectTeachingDecisionInput): boolean {
  const effort = input.analysis.result.effortEvidence

  return (
    input.previousTeachingDecision !== null &&
    blockedStates.has(input.analysis.result.studentState) &&
    authoritativeTopicOutcome(input) ===
      TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC &&
    effort.present &&
    effort.type !== null &&
    effort.addressesPreviousTutorAction &&
    !effort.isRepeated &&
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

  const reason =
    analysis.analysisSource === EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK
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
