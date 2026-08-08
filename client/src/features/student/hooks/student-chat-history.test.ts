import { describe, expect, it } from 'vitest'

import { chatMessageHistoryResponseSchema } from '@/features/student/schemas/student-chat.schema'
import {
  chatMessageHistoryResponseFixture,
  studentChatIds,
} from '@/features/student/testing/student-chat.fixtures'

import { markMessageReviewPending } from './student-chat-history'

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
      hasNotification: false,
    })
    expect(() =>
      chatMessageHistoryResponseSchema.parse(updated.pages[0]),
    ).not.toThrow()
  })
})
