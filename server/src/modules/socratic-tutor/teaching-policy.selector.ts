import {
  ReflectionMode,
  RevealPolicy,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
} from '../../generated/prisma/client'
import type { PersistedEducationalAnalysisRecord } from './educational-analysis.repository'
import {
  EDUCATIONAL_ANALYSIS_SOURCE,
  EFFORT_QUALITY,
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
  turnId: string
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

const topicResetOutcomes = new Set<string>([
  TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
  TOPIC_RESOLUTION_OUTCOME.RESUME_PREVIOUS_TOPIC,
  TOPIC_RESOLUTION_OUTCOME.REOPEN_EXISTING_TOPIC,
])

export function selectTeachingDecisionDraft(
  input: SelectTeachingDecisionInput,
): TeachingDecisionPolicyDraft {
  const defaults = teachingPolicyDefaults(input.courseTutorConfiguration)
  const strategy = selectTeachingStrategy(input)

  return {
    turnId: input.analysis.turnId,
    topicId: input.analysis.topicId,
    analysisId: input.analysis.id,
    strategy,
    primaryTechnique: primaryTechniqueForStrategy(strategy),
    supportingTechnique: null,
    guidanceLevel: calculateGuidanceLevel(input, defaults),
    revealPolicy: defaults.defaultRevealPolicy,
    reflectionMode: ReflectionMode.NONE,
    requireStudentAction: true,
    guardPolicy: fixedGuardPolicy,
    decisionReason: decisionReasonFor(input.analysis, strategy),
    policyVersion: TEACHING_POLICY_VERSION,
  }
}

export function selectTeachingStrategy(
  input: Pick<
    SelectTeachingDecisionInput,
    'analysis' | 'previousTeachingDecision'
  >,
): TeachingStrategy {
  const state = input.analysis.result.studentState

  if (
    state === StudentState.NEAR_SOLUTION &&
    canPreservePreviousStrategy(input)
  ) {
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

  if (isTopicReset(input)) {
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
  if (!hasMeaningfulEffort(input.analysis)) {
    return capGuidanceLevel(currentLevel, defaults.maximumGuidanceLevel)
  }
  if (!blockedStates.has(input.analysis.result.studentState)) {
    return capGuidanceLevel(currentLevel, defaults.maximumGuidanceLevel)
  }

  return capGuidanceLevel(currentLevel + 1, defaults.maximumGuidanceLevel)
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
    'analysis' | 'previousTeachingDecision'
  >,
): input is Pick<SelectTeachingDecisionInput, 'analysis'> & {
  previousTeachingDecision: PreviousTeachingDecisionSnapshot
} {
  const previous = input.previousTeachingDecision

  return (
    previous !== null &&
    previous.topicId === input.analysis.topicId &&
    canonicalStrategies.has(previous.strategy)
  )
}

function currentGuidanceLevel(
  input: SelectTeachingDecisionInput,
): number | null {
  return (
    input.previousTeachingDecision?.guidanceLevel ??
    input.topicState?.guidanceLevel ??
    null
  )
}

function isTopicReset(input: SelectTeachingDecisionInput): boolean {
  const authoritativeOutcome =
    input.topicResolutionOutcome ?? input.analysis.result.topicRelation

  return (
    topicResetOutcomes.has(authoritativeOutcome) ||
    (input.previousTeachingDecision !== null &&
      input.previousTeachingDecision.topicId !== input.analysis.topicId)
  )
}

function hasMeaningfulEffort(
  analysis: PersistedEducationalAnalysisRecord,
): boolean {
  return (
    analysis.result.effortEvidence.present &&
    (analysis.result.effortEvidence.quality === EFFORT_QUALITY.MEANINGFUL ||
      analysis.result.effortEvidence.quality === EFFORT_QUALITY.STRONG)
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
  analysis: PersistedEducationalAnalysisRecord,
  strategy: TeachingStrategy,
): string {
  const state = analysis.result.studentState
  const reason =
    state === StudentState.UNKNOWN
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

  return reason.slice(0, 240)
}
