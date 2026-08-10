import { describe, expect, it, vi } from 'vitest'

import { studentChatIds } from '@/features/student/testing/student-chat.fixtures'

import {
  getStudentReviewDetail,
  requestStudentReview,
} from './student-reviews.api'

describe('Student review API', () => {
  it('loads and validates the Student-safe review detail', async () => {
    const response = {
      reviewCaseId: studentChatIds.primarySession,
      status: 'RESOLVED',
      outcome: 'EDITED',
      publishedContent: 'Reviewed guidance',
      rejectionReason: null,
      requestedAt: '2026-07-28T12:00:00.000Z',
      resolvedAt: '2026-07-28T13:00:00.000Z',
      messageId: studentChatIds.assistantMessage,
      sessionId: studentChatIds.primarySession,
    }
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/student/reviews/${studentChatIds.primarySession}`,
        )
        expect(init?.method).toBe('GET')
        return Response.json(response)
      },
    )

    await expect(
      getStudentReviewDetail({
        reviewCaseId: studentChatIds.primarySession,
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toEqual(response)
  })

  it('sends the category, normalized note, and required idempotency key', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/messages/${studentChatIds.assistantMessage}/review-requests`,
        )
        expect(init?.method).toBe('POST')
        expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(
          'review-key',
        )
        expect(JSON.parse(String(init?.body))).toEqual({
          flagReason: 'CONFUSING',
          note: 'Please clarify',
        })
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
      flagReason: 'CONFUSING',
      note: '  Please clarify  ',
      idempotencyKey: 'review-key',
      options: { fetchImpl: fetchMock },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
