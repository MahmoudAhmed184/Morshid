import { Injectable } from '@nestjs/common'

import { ConversationMessagePresenter } from '../modules/conversations/interface/conversation-message-presenter'
import type { ChatMessageDto } from '../modules/conversations/interface/conversation-dto'
import type { ChatMessageRecord } from '../modules/conversations/interface/conversation-records'
import { StudentCitationSources } from '../modules/materials/interface/student-citation-sources'
import { StudentReviewSummaries } from '../modules/reviews/interface/student-review-summaries'

@Injectable()
export class ApplicationConversationMessagePresenter extends ConversationMessagePresenter {
  constructor(
    private readonly citationSources: StudentCitationSources,
    private readonly reviewSummaries: StudentReviewSummaries,
  ) {
    super()
  }

  present(
    record: ChatMessageRecord,
    studentId: string,
  ): Promise<ChatMessageDto> {
    return this.presentMany([record], studentId).then((messages) => messages[0])
  }

  async presentMany(
    records: readonly ChatMessageRecord[],
    studentId: string,
  ): Promise<ChatMessageDto[]> {
    const messageIds = records.map(({ id }) => id)
    const [citations, reviews] = await Promise.all([
      this.citationSources.loadForMessages(messageIds),
      this.reviewSummaries.loadForMessages(messageIds, studentId),
    ])

    return records.map((record) => {
      const review = reviews.find(({ messageId }) => messageId === record.id)
      return {
        id: record.id,
        sequence: record.sequence,
        role: record.role,
        attemptId: record.attemptId,
        topicId: record.topicId,
        responseToMessageId: record.responseToMessageId,
        content: record.content,
        status: record.status,
        requestKind: record.requestKind,
        guidanceLabel: record.guidanceLabel,
        hintLevel: record.hintLevel,
        promptVersion: record.promptVersion,
        errorCode: record.errorCode,
        createdAt: record.createdAt.toISOString(),
        completedAt: record.completedAt?.toISOString() ?? null,
        citations: citations
          .filter(({ messageId }) => messageId === record.id)
          .map(({ messageId: _messageId, evidence, ...citation }) => ({
            ...citation,
            evidence: [...evidence],
          })),
        reviewSummary:
          review === undefined
            ? null
            : {
                reviewCaseId: review.reviewCaseId,
                status: review.status,
                outcome: review.outcome,
                resolvedAt: review.resolvedAt?.toISOString() ?? null,
              },
      }
    })
  }
}
