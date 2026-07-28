import { describe, expect, it, vi } from 'vitest'

import { studentChatIds } from '@/features/student/testing/student-chat.fixtures'

import { requestStudentReview } from './student-reviews.api'

describe('Student review API', () => {
  it('sends only the note and required idempotency key', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/messages/${studentChatIds.assistantMessage}/review-requests`,
        )
        expect(init?.method).toBe('POST')
        expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(
          'review-key',
        )
        expect(JSON.parse(String(init?.body))).toEqual({ note: null })
        return Response.json(
          {
            caseId: studentChatIds.primarySession,
            messageId: studentChatIds.assistantMessage,
            status: 'PENDING',
            trigger: 'STUDENT_REQUEST',
            requestedAt: '2026-07-28T12:00:00.000Z',
            replayed: false,
            reviewSummary: {
              status: 'PENDING',
              outcome: null,
              resolvedAt: null,
              hasNotification: false,
              reviewCaseId: studentChatIds.primarySession,
            },
          },
          { status: 201 },
        )
      },
    )

    await requestStudentReview({
      messageId: studentChatIds.assistantMessage,
      note: null,
      idempotencyKey: 'review-key',
      options: { fetchImpl: fetchMock },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
