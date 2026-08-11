import { Injectable } from '@nestjs/common'

import type { PersistedEducationalAnalysisRecord } from './educational-analysis.repository'
import {
  selectTeachingDecisionDraft,
  type SelectTeachingDecisionInput,
} from './teaching-policy.selector'
import {
  TeachingDecisionRepository,
  type PersistedTeachingDecisionRecord,
} from './teaching-decision.repository'
import type { CourseTutorConfiguration } from './teaching-policy.types'
import type { TopicStateSnapshot } from './topic-state.types'
import type { TopicResolutionOutcome } from './topic.types'

export const TEACHING_POLICY_FAILURE_CATEGORY = {
  INVALID_CONTEXT: 'invalid_context',
  PERSISTENCE_FAILURE: 'persistence_failure',
} as const

export type TeachingPolicyEngineResult =
  | {
      readonly success: true
      readonly decision: PersistedTeachingDecisionRecord
      readonly reused: boolean
    }
  | {
      readonly success: false
      readonly category: typeof TEACHING_POLICY_FAILURE_CATEGORY.INVALID_CONTEXT
      readonly errorCode:
        | 'TEACHING_DECISION_ANALYSIS_NOT_ACCEPTED'
        | 'TEACHING_DECISION_RELATIONSHIP_MISMATCH'
    }
  | {
      readonly success: false
      readonly category: typeof TEACHING_POLICY_FAILURE_CATEGORY.PERSISTENCE_FAILURE
      readonly errorCode: 'TEACHING_DECISION_PERSISTENCE_FAILED'
    }

export interface TeachingPolicyEngineInput {
  analysis: PersistedEducationalAnalysisRecord
  topicState: TopicStateSnapshot | null
  topicResolutionOutcome?: TopicResolutionOutcome
  previousTopicId?: string | null
  previousTeachingDecision?: PersistedTeachingDecisionRecord | null
  courseTutorConfiguration?: CourseTutorConfiguration | null
}

@Injectable()
export class TeachingPolicyEngine {
  constructor(
    private readonly teachingDecisionRepository: TeachingDecisionRepository,
  ) {}

  findPreviousDecision(input: {
    attemptId: string
    topicId: string
  }): Promise<PersistedTeachingDecisionRecord | null> {
    return this.teachingDecisionRepository.findLatestCompletedForSameTopicBeforeTurn(
      input,
    )
  }

  async selectDecision(
    input: TeachingPolicyEngineInput,
  ): Promise<TeachingPolicyEngineResult> {
    const draft = selectTeachingDecisionDraft(policyInput(input))

    try {
      const stored = await this.teachingDecisionRepository.storeDecision(draft)

      if (stored.kind === 'analysis_not_found') {
        return {
          success: false,
          category: TEACHING_POLICY_FAILURE_CATEGORY.INVALID_CONTEXT,
          errorCode: 'TEACHING_DECISION_ANALYSIS_NOT_ACCEPTED',
        }
      }
      if (stored.kind === 'relationship_mismatch') {
        return {
          success: false,
          category: TEACHING_POLICY_FAILURE_CATEGORY.INVALID_CONTEXT,
          errorCode: 'TEACHING_DECISION_RELATIONSHIP_MISMATCH',
        }
      }

      return {
        success: true,
        decision: stored.decision,
        reused: stored.kind === 'reused',
      }
    } catch {
      return {
        success: false,
        category: TEACHING_POLICY_FAILURE_CATEGORY.PERSISTENCE_FAILURE,
        errorCode: 'TEACHING_DECISION_PERSISTENCE_FAILED',
      }
    }
  }
}

function policyInput(
  input: TeachingPolicyEngineInput,
): SelectTeachingDecisionInput {
  return {
    analysis: input.analysis,
    topicState: input.topicState,
    previousTeachingDecision: input.previousTeachingDecision ?? null,
    topicResolutionOutcome:
      input.topicResolutionOutcome ?? input.analysis.result.topicRelation,
    previousTopicId: input.previousTopicId ?? null,
    courseTutorConfiguration: input.courseTutorConfiguration ?? null,
  }
}
