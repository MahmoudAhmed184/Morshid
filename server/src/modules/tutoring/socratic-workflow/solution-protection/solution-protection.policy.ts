import {
  MessageRequestKind,
  SolutionProtectionSource,
  SolutionProtectionStatus,
  TopicType,
} from '../../tutoring-values'
import {
  EDUCATIONAL_ANALYSIS_SOURCE,
  type EducationalAnalysisSource,
} from '../analysis/educational-analysis.types'
import type { PersistedEducationalAnalysisRecord } from '../analysis/educational-analysis.repository'
import {
  TOPIC_RESOLUTION_OUTCOME,
  type TopicRecord,
  type TopicResolutionOutcome,
} from '../topic/topic.types'

export interface TopicSolutionProtectionProposal {
  readonly status: SolutionProtectionStatus
  readonly source: SolutionProtectionSource | null
}

export function proposeTopicSolutionProtection(input: {
  readonly topic: TopicRecord
  readonly topicResolutionOutcome: TopicResolutionOutcome
  readonly explicitProtectedSolutionSignal: boolean
  readonly analysis?: Pick<
    PersistedEducationalAnalysisRecord,
    'analysisSource' | 'result'
  >
}): TopicSolutionProtectionProposal {
  if (
    input.topic.solutionProtectionStatus === SolutionProtectionStatus.PROTECTED
  ) {
    return {
      status: SolutionProtectionStatus.PROTECTED,
      source: input.topic.solutionProtectionSource,
    }
  }

  if (hasAuthoritativeProtectedTaskMetadata(input.topic)) {
    return {
      status: SolutionProtectionStatus.PROTECTED,
      source: SolutionProtectionSource.AUTHORITATIVE_TASK_METADATA,
    }
  }

  if (input.explicitProtectedSolutionSignal) {
    return {
      status: SolutionProtectionStatus.PROTECTED,
      source: SolutionProtectionSource.EXPLICIT_PROTECTED_REQUEST,
    }
  }

  if (acceptedAnalysisEstablishesTask(input)) {
    return {
      status: SolutionProtectionStatus.PROTECTED,
      source: SolutionProtectionSource.ACCEPTED_TASK_ANALYSIS,
    }
  }

  if (
    input.topic.solutionProtectionStatus ===
    SolutionProtectionStatus.UNPROTECTED
  ) {
    return {
      status: SolutionProtectionStatus.UNPROTECTED,
      source: input.topic.solutionProtectionSource,
    }
  }

  if (acceptedAnalysisEstablishesConcept(input)) {
    return {
      status: SolutionProtectionStatus.UNPROTECTED,
      source: SolutionProtectionSource.ACCEPTED_CONCEPT_ANALYSIS,
    }
  }

  return {
    status: SolutionProtectionStatus.UNKNOWN,
    source: null,
  }
}

function hasAuthoritativeProtectedTaskMetadata(topic: TopicRecord): boolean {
  return (
    topic.problemId !== null ||
    topic.topicType === TopicType.PROBLEM ||
    topic.topicType === TopicType.DEBUGGING_TASK ||
    topic.topicType === TopicType.ASSIGNMENT_ITEM
  )
}

function acceptedAnalysisEstablishesTask(input: {
  topicResolutionOutcome: TopicResolutionOutcome
  analysis?: Pick<
    PersistedEducationalAnalysisRecord,
    'analysisSource' | 'result'
  >
}): boolean {
  return (
    isAcceptedModelAnalysis(input.analysis?.analysisSource) &&
    input.topicResolutionOutcome ===
      TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC &&
    (input.analysis?.result.requestKind === MessageRequestKind.PROBLEM_LIKE ||
      input.analysis?.result.requestKind === MessageRequestKind.CODE_DIAGNOSIS)
  )
}

function acceptedAnalysisEstablishesConcept(input: {
  topicResolutionOutcome: TopicResolutionOutcome
  analysis?: Pick<
    PersistedEducationalAnalysisRecord,
    'analysisSource' | 'result'
  >
}): boolean {
  return (
    isAcceptedModelAnalysis(input.analysis?.analysisSource) &&
    input.topicResolutionOutcome ===
      TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC &&
    input.analysis?.result.requestKind === MessageRequestKind.CONCEPTUAL
  )
}

function isAcceptedModelAnalysis(
  source: EducationalAnalysisSource | undefined,
): boolean {
  return source === EDUCATIONAL_ANALYSIS_SOURCE.MODEL
}
