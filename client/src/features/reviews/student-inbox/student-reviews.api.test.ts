import { describe, expect, it, vi } from 'vitest'

import { chatIds } from '@/features/chat/testing/chat.fixtures'

import {
  getStudentReviewDetail,
  requestStudentReview,
} from './student-reviews.api'

describe('Student review API', () => {
  it('loads and validates the Student-safe review detail', async () => {
    const response = {
      reviewCaseId: chatIds.primarySession,
      status: 'RESOLVED',
      outcome: 'EDITED',
      publishedContent: 'Reviewed guidance',
      rejectionReason: null,
      requestedAt: '2026-07-28T12:00:00.000Z',
      resolvedAt: '2026-07-28T13:00:00.000Z',
      messageId: chatIds.assistantMessage,
      sessionId: chatIds.primarySession,
    }
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/student/reviews/${chatIds.primarySession}`,
        )
        expect(init?.method).toBe('GET')
        return Response.json(response)
      },
    )

    await expect(
      getStudentReviewDetail({
        reviewCaseId: chatIds.primarySession,
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toEqual(response)
  })

  it('sends the category, normalized note, and required idempotency key', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/messages/${chatIds.assistantMessage}/review-requests`,
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
            caseId: chatIds.primarySession,
            messageId: chatIds.assistantMessage,
            status: 'PENDING',
            trigger: 'STUDENT_REQUEST',
            requestedAt: '2026-07-28T12:00:00.000Z',
            replayed: false,
            reviewSummary: {
              status: 'PENDING',
              outcome: null,
              resolvedAt: null,
              reviewCaseId: chatIds.primarySession,
            },
          },
          { status: 201 },
        )
      },
    )

    await requestStudentReview({
      messageId: chatIds.assistantMessage,
      flagReason: 'CONFUSING',
      note: '  Please clarify  ',
      idempotencyKey: 'review-key',
      options: { fetchImpl: fetchMock },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
