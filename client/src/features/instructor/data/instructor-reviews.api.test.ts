import { describe, expect, it, vi } from 'vitest'

import type { ApiError } from '@/features/auth/api/authenticated-api-client'

import { rejectReviewCase, resolveReviewCase } from './instructor-reviews.api'

const reviewCaseId = '10000000-0000-4000-8000-000000000001'
const actionResponse = {
  reviewCaseId,
  status: 'RESOLVED',
  outcome: 'EDITED',
  publishedContent: 'Reviewed guidance',
  resolutionReason: 'Clarified the explanation',
  version: 3,
  resolvedAt: '2026-07-31T10:00:00.000Z',
  replayed: false,
} as const

describe('Instructor review action API', () => {
  it('resolves a review with version and idempotency headers', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/instructor/reviews/${reviewCaseId}/resolve`,
        )
        expect(init?.method).toBe('POST')
        expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(
          'resolve-key',
        )
        expect(new Headers(init?.headers).get('Content-Type')).toBe(
          'application/json',
        )
        expect(JSON.parse(String(init?.body))).toEqual({
          expectedVersion: 2,
          outcome: 'EDITED',
          content: 'Reviewed guidance',
          reason: 'Clarified the explanation',
        })
        return Response.json(actionResponse)
      },
    )

    await expect(
      resolveReviewCase(
        reviewCaseId,
        {
          expectedVersion: 2,
          outcome: 'EDITED',
          content: 'Reviewed guidance',
          reason: 'Clarified the explanation',
        },
        'resolve-key',
        { fetchImpl: fetchMock },
      ),
    ).resolves.toEqual(actionResponse)
  })

  it('rejects a review with the required reason and expected version', async () => {
    const response = {
      ...actionResponse,
      status: 'REJECTED',
      outcome: 'REQUEST_REJECTED',
      publishedContent: null,
      resolutionReason: 'The request is not applicable',
    } as const
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        expect(JSON.parse(String(init?.body))).toEqual({
          expectedVersion: 4,
          reason: 'The request is not applicable',
        })
        expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(
          'reject-key',
        )
        return Response.json(response)
      },
    )

    await expect(
      rejectReviewCase(
        reviewCaseId,
        { expectedVersion: 4, reason: 'The request is not applicable' },
        'reject-key',
        { fetchImpl: fetchMock },
      ),
    ).resolves.toEqual(response)
  })

  it('propagates validation and optimistic concurrency API errors', async () => {
    for (const [status, code] of [
      [400, 'REVIEW_INVALID_REQUEST'],
      [409, 'STALE_REVIEW_VERSION'],
    ] as const) {
      const fetchMock = vi.fn(async () =>
        Response.json({ code, message: 'Review action failed' }, { status }),
      )

      await expect(
        resolveReviewCase(
          reviewCaseId,
          { expectedVersion: 2, outcome: 'APPROVED', content: null },
          `error-key-${String(status)}`,
          { fetchImpl: fetchMock },
        ),
      ).rejects.toEqual(
        expect.objectContaining<Partial<ApiError>>({ status, code }),
      )
    }
  })
})
