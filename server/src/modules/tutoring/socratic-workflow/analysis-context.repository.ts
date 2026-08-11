import { Injectable } from '@nestjs/common'

import {
  CONVERSATION_ANALYSIS_HISTORY_LIMIT,
  ConversationMessageReader,
  type ConversationAnalysisContextInput,
  type ConversationAnalysisHistoryInput,
} from '../../conversations/conversation-message-reader'
import type {
  AnalysisContextMessage,
  CourseMetadataContext,
} from './analysis-context.types'

export const ANALYSIS_CONTEXT_CANDIDATE_HISTORY_LIMIT =
  CONVERSATION_ANALYSIS_HISTORY_LIMIT

export type AnalysisContextBaseInput = ConversationAnalysisContextInput

export type AnalysisHistoryCandidateInput = ConversationAnalysisHistoryInput

export interface AnalysisContextBaseRecord {
  courseMetadata: CourseMetadataContext
  studentMessage: AnalysisContextMessage
}

export abstract class AnalysisContextRepository {
  abstract loadBaseContext(
    input: AnalysisContextBaseInput,
  ): Promise<AnalysisContextBaseRecord | null>

  abstract listHistoryCandidates(
    input: AnalysisHistoryCandidateInput,
  ): Promise<AnalysisContextMessage[]>
}

@Injectable()
export class PrismaAnalysisContextRepository extends AnalysisContextRepository {
  constructor(
    private readonly conversationMessageReader: ConversationMessageReader,
  ) {
    super()
  }

  async loadBaseContext(
    input: AnalysisContextBaseInput,
  ): Promise<AnalysisContextBaseRecord | null> {
    const context =
      await this.conversationMessageReader.loadAnalysisContext(input)
    return context === null
      ? null
      : {
          courseMetadata: context.courseMetadata,
          studentMessage: context.studentMessage,
        }
  }

  listHistoryCandidates(
    input: AnalysisHistoryCandidateInput,
  ): Promise<AnalysisContextMessage[]> {
    return this.conversationMessageReader.listAnalysisHistoryCandidates(input)
  }
}
