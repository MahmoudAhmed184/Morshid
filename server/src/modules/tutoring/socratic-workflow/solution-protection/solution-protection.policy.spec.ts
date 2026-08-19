import {
  MessageRequestKind,
  SolutionProtectionSource,
  SolutionProtectionStatus,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
  TopicStatus,
  TopicType,
} from '../../tutoring-values'
import {
  EDUCATIONAL_ANALYSIS_SOURCE,
  EFFORT_QUALITY,
  LEARNING_EVIDENCE_STRENGTH,
  type EducationalAnalysisResult,
  type EducationalAnalysisSource,
} from '../analysis/educational-analysis.types'
import {
  TOPIC_RESOLUTION_OUTCOME,
  type TopicRecord,
  type TopicResolutionOutcome,
} from '../topic/topic.types'
import { proposeTopicSolutionProtection } from './solution-protection.policy'

describe('solution protection policy', () => {
  it.each([
    ['ordinary conceptual question', MessageRequestKind.CONCEPTUAL],
    ['conceptual misconception', MessageRequestKind.CONCEPTUAL],
    ['conceptual student attempt', MessageRequestKind.ATTEMPT_DIAGNOSIS],
  ])('%s remains unprotected on an established conceptual Topic', (_, kind) => {
    expect(
      proposal({
        topic: topic({
          topicType: TopicType.CONCEPT,
          solutionProtectionStatus: SolutionProtectionStatus.UNPROTECTED,
          solutionProtectionSource:
            SolutionProtectionSource.ACCEPTED_CONCEPT_ANALYSIS,
        }),
        requestKind: kind,
        outcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      }),
    ).toEqual({
      status: SolutionProtectionStatus.UNPROTECTED,
      source: SolutionProtectionSource.ACCEPTED_CONCEPT_ANALYSIS,
    })
  })

  it.each([
    ['initial protected problem', MessageRequestKind.PROBLEM_LIKE],
    ['I do not know', MessageRequestKind.CONCEPTUAL],
    ['bare hint request', MessageRequestKind.CONCEPTUAL],
    ['meaningful student attempt', MessageRequestKind.ATTEMPT_DIAGNOSIS],
    ['misconception', MessageRequestKind.ATTEMPT_DIAGNOSIS],
    ['near solution', MessageRequestKind.ATTEMPT_DIAGNOSIS],
    ['verification', MessageRequestKind.ATTEMPT_DIAGNOSIS],
  ])('%s remains protected on the same protected Topic', (_, kind) => {
    expect(
      proposal({
        topic: topic({
          solutionProtectionStatus: SolutionProtectionStatus.PROTECTED,
          solutionProtectionSource:
            SolutionProtectionSource.AUTHORITATIVE_TASK_METADATA,
        }),
        requestKind: kind,
        outcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      }),
    ).toEqual({
      status: SolutionProtectionStatus.PROTECTED,
      source: SolutionProtectionSource.AUTHORITATIVE_TASK_METADATA,
    })
  })

  it('establishes protection from authoritative problem metadata', () => {
    expect(
      proposal({
        topic: topic({ problemId: 'problem-1', topicType: TopicType.PROBLEM }),
        requestKind: MessageRequestKind.CONCEPTUAL,
      }),
    ).toEqual({
      status: SolutionProtectionStatus.PROTECTED,
      source: SolutionProtectionSource.AUTHORITATIVE_TASK_METADATA,
    })
  })

  it('uses the current deterministic classifier only as an explicit signal', () => {
    expect(
      proposal({
        explicitProtectedSolutionSignal: true,
        requestKind: MessageRequestKind.CONCEPTUAL,
      }),
    ).toEqual({
      status: SolutionProtectionStatus.PROTECTED,
      source: SolutionProtectionSource.EXPLICIT_PROTECTED_REQUEST,
    })
  })

  it.each([MessageRequestKind.PROBLEM_LIKE, MessageRequestKind.CODE_DIAGNOSIS])(
    'lets accepted non-fallback task analysis establish %s on a new Topic',
    (kind) => {
      expect(
        proposal({
          requestKind: kind,
          outcome: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
        }),
      ).toEqual({
        status: SolutionProtectionStatus.PROTECTED,
        source: SolutionProtectionSource.ACCEPTED_TASK_ANALYSIS,
      })
    },
  )

  it('lets accepted non-fallback conceptual analysis establish a new Topic as unprotected', () => {
    expect(
      proposal({
        requestKind: MessageRequestKind.CONCEPTUAL,
        outcome: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
      }),
    ).toEqual({
      status: SolutionProtectionStatus.UNPROTECTED,
      source: SolutionProtectionSource.ACCEPTED_CONCEPT_ANALYSIS,
    })
  })

  it.each([
    ['fallback task analysis', EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK],
    ['missing analysis', undefined],
  ])('%s cannot establish protection provenance', (_, analysisSource) => {
    expect(
      proposal({
        requestKind: MessageRequestKind.PROBLEM_LIKE,
        outcome: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
        analysisSource,
      }),
    ).toEqual({ status: SolutionProtectionStatus.UNKNOWN, source: null })
  })

  it('does not downgrade a protected Topic from conceptual analysis', () => {
    expect(
      proposal({
        topic: topic({
          solutionProtectionStatus: SolutionProtectionStatus.PROTECTED,
          solutionProtectionSource:
            SolutionProtectionSource.ACCEPTED_TASK_ANALYSIS,
        }),
        requestKind: MessageRequestKind.CONCEPTUAL,
        outcome: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
      }),
    ).toEqual({
      status: SolutionProtectionStatus.PROTECTED,
      source: SolutionProtectionSource.ACCEPTED_TASK_ANALYSIS,
    })
  })

  it.each([
    TOPIC_RESOLUTION_OUTCOME.RESUME_PREVIOUS_TOPIC,
    TOPIC_RESOLUTION_OUTCOME.REOPEN_EXISTING_TOPIC,
  ])('restores persisted protection for %s', (outcome) => {
    expect(
      proposal({
        topic: topic({
          status: TopicStatus.PAUSED,
          solutionProtectionStatus: SolutionProtectionStatus.PROTECTED,
          solutionProtectionSource:
            SolutionProtectionSource.EXPLICIT_PROTECTED_REQUEST,
        }),
        requestKind: MessageRequestKind.CONCEPTUAL,
        outcome,
      }),
    ).toEqual({
      status: SolutionProtectionStatus.PROTECTED,
      source: SolutionProtectionSource.EXPLICIT_PROTECTED_REQUEST,
    })
  })

  it('upgrades an unprotected Topic to protected when a problem request is introduced', () => {
    expect(
      proposal({
        topic: topic({
          solutionProtectionStatus: SolutionProtectionStatus.UNPROTECTED,
          solutionProtectionSource:
            SolutionProtectionSource.ACCEPTED_CONCEPT_ANALYSIS,
        }),
        requestKind: MessageRequestKind.PROBLEM_LIKE,
        outcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      }),
    ).toEqual({
      status: SolutionProtectionStatus.PROTECTED,
      source: SolutionProtectionSource.ACCEPTED_TASK_ANALYSIS,
    })
  })

  it('leaves ambiguous new Topics UNKNOWN for conservative screening', () => {
    expect(
      proposal({
        requestKind: MessageRequestKind.AMBIGUOUS,
        outcome: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
      }),
    ).toEqual({ status: SolutionProtectionStatus.UNKNOWN, source: null })
  })
})

function proposal(input: {
  topic?: TopicRecord
  requestKind: MessageRequestKind
  outcome?: TopicResolutionOutcome
  explicitProtectedSolutionSignal?: boolean
  analysisSource?: EducationalAnalysisSource
}) {
  const omitAnalysis =
    Object.prototype.hasOwnProperty.call(input, 'analysisSource') &&
    input.analysisSource === undefined

  return proposeTopicSolutionProtection({
    topic: input.topic ?? topic(),
    topicResolutionOutcome:
      input.outcome ?? TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
    explicitProtectedSolutionSignal:
      input.explicitProtectedSolutionSignal ?? false,
    ...(omitAnalysis
      ? {}
      : {
          analysis: analysis(
            input.requestKind,
            input.analysisSource ?? EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
          ),
        }),
  })
}

function analysis(
  requestKind: MessageRequestKind,
  analysisSource: EducationalAnalysisSource = EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
) {
  const result: EducationalAnalysisResult = {
    requestKind,
    studentState: StudentState.UNKNOWN,
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
    topicRelation: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
    recommendedStrategy: TeachingStrategy.SOCRATIC_QUESTIONING,
    recommendedTechnique: TeachingTechnique.ORIENTATION_QUESTION,
    recommendedGuidanceLevel: 1,
    confidence: 0.9,
    evidenceReferences: [],
  }

  return { analysisSource, result }
}

function topic(patch: Partial<TopicRecord> = {}): TopicRecord {
  const now = new Date('2026-08-15T00:00:00.000Z')
  return {
    id: 'topic-1',
    sessionId: 'session-1',
    courseId: 'course-1',
    problemId: null,
    conceptId: null,
    title: 'Topic',
    topicType: TopicType.UNCLASSIFIED,
    status: TopicStatus.ACTIVE,
    solutionProtectionStatus: SolutionProtectionStatus.UNKNOWN,
    solutionProtectionSource: null,
    solutionProtectionPolicyVersion: null,
    solutionProtectionEstablishedAt: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
    ...patch,
  }
}
