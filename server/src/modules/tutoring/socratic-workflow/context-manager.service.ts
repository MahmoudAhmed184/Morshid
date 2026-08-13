import { Inject, Injectable } from '@nestjs/common'

import {
  previousTeachingDecisionFromTopicState,
  selectAnalysisHistory,
  textReferencesFromTopicState,
} from './analysis-context-selector'
import {
  type AnalysisContextPackage,
  type BuildAnalysisContextInput,
} from './analysis-context.types'
import { ConversationTurns } from '../../conversations/interface/conversation-turns'
import { TopicStateRepository } from './topic-state.repository'
import { TopicRepository } from './topic.repository'

@Injectable()
export class ContextManager {
  constructor(
    @Inject(ConversationTurns)
    private readonly conversationTurns: ConversationTurns,
    private readonly topicRepository: TopicRepository,
    private readonly topicStateRepository: TopicStateRepository,
  ) {}

  async buildAnalysisContext(
    input: BuildAnalysisContextInput,
  ): Promise<AnalysisContextPackage | null> {
    const base = await this.conversationTurns.loadAnalysisContext(input)
    if (base === null) {
      return null
    }

    const activeTopic = await this.topicRepository.findTopicById(
      { sessionId: input.sessionId, courseId: input.courseId },
      input.activeTopicId,
    )
    if (activeTopic === null) {
      return null
    }

    if (
      base.studentMessage.topicId !== null &&
      base.studentMessage.topicId !== activeTopic.id
    ) {
      return null
    }

    const [topicState, candidates] = await Promise.all([
      this.topicStateRepository.findByTopicId(activeTopic.id),
      this.conversationTurns.listAnalysisHistoryCandidates({
        courseId: input.courseId,
        sessionId: input.sessionId,
        studentId: input.studentId,
        topicId: activeTopic.id,
        beforeSequence: base.studentMessage.sequence,
      }),
    ])
    const selected = selectAnalysisHistory({
      activeTopicId: activeTopic.id,
      studentMessageId: base.studentMessage.id,
      candidates,
      historyTokenBudget: input.historyTokenBudget,
      historyMessageLimit: input.historyMessageLimit,
    })
    const references = textReferencesFromTopicState({
      topicState,
      previousTutorQuestion: selected.previousTutorQuestion,
      previousStudentAttempt: selected.previousStudentAttempt,
    })

    return {
      studentMessage: base.studentMessage,
      activeTopic,
      topicState,
      selectedHistory: selected.selectedHistory,
      previousTutorQuestion: references.previousTutorQuestion,
      previousStudentAttempt: references.previousStudentAttempt,
      previousTeachingDecision:
        previousTeachingDecisionFromTopicState(topicState),
      problemMetadata:
        activeTopic.problemId === null ? null : { id: activeTopic.problemId },
      conceptMetadata:
        activeTopic.conceptId === null ? null : { id: activeTopic.conceptId },
      courseMetadata: base.courseMetadata,
      conversationLanguage: input.conversationLanguage ?? null,
      tokenBudget: selected.tokenBudget,
    }
  }
}
