import { describe, expect, it } from 'vitest'

import { chatMessageHistoryResponseSchema } from '@/features/chat/messages/chat-message.schema'
import {
  chatMessageHistoryResponseFixture,
  studentChatIds,
} from '@/features/chat/testing/chat.fixtures'

import { markMessageReviewPending } from './chat-message-history'

describe('Student chat review summary cache', () => {
  it('writes the complete pending review summary shape', () => {
    const cached = {
      pages: [
        {
          messages: chatMessageHistoryResponseFixture.messages.map(
            (message) => ({
              ...message,
            }),
          ),
          nextCursor: null,
        },
      ],
      pageParams: [undefined],
    }

    const updated = markMessageReviewPending(
      cached,
      studentChatIds.assistantMessage,
      studentChatIds.primarySession,
    )
    const assistantMessage = updated.pages[0].messages.find(
      ({ id }) => id === studentChatIds.assistantMessage,
    )

    expect(assistantMessage?.reviewSummary).toEqual({
      reviewCaseId: studentChatIds.primarySession,
      status: 'PENDING',
      outcome: null,
      resolvedAt: null,
    })
    expect(() =>
      chatMessageHistoryResponseSchema.parse(updated.pages[0]),
    ).not.toThrow()
  })
})
