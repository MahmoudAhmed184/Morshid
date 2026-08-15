import { Injectable } from '@nestjs/common'

import type { PersistedEducationalAnalysisRecord } from '../analysis/educational-analysis.repository'
import type {
  TopicRecord,
  TopicResolutionOutcome,
} from '../topic/topic.types'
import { proposeTopicSolutionProtection } from './solution-protection.policy'
import { SolutionProtectionRepository } from './solution-protection.repository'
import type { PersistedOutputProtectionDecision } from './solution-protection.types'

@Injectable()
export class SolutionProtectionService {
  constructor(private readonly repository: SolutionProtectionRepository) {}

  resolve(input: {
    readonly attemptId: string
    readonly topic: TopicRecord
    readonly topicResolutionOutcome: TopicResolutionOutcome
    readonly explicitProtectedSolutionSignal: boolean
    readonly analysis?: Pick<
      PersistedEducationalAnalysisRecord,
      'analysisSource' | 'result'
    >
  }): Promise<PersistedOutputProtectionDecision> {
    return this.repository.resolveAttemptDecision({
      attemptId: input.attemptId,
      topicId: input.topic.id,
      explicitProtectedSolutionSignal:
        input.explicitProtectedSolutionSignal,
      proposal: proposeTopicSolutionProtection(input),
    })
  }
}
