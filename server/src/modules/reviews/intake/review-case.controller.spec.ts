import { UserRole, UserStatus } from '../../identity/identity.roles'
import type { Response } from 'express'

import { StudentFlagReason } from '../interface/review-values'
import type { AuthenticatedHttpRequest } from '../../identity/identity.guard'
import { ReviewCaseController } from './review-case.controller'
import type { ReviewCaseCreator } from './review-case.creator'

describe('ReviewCaseController', () => {
  const user = {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'student@example.test',
    displayName: 'Student',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  }
  const messageId = '20000000-0000-4000-8000-000000000001'
  const caseId = '30000000-0000-4000-8000-000000000001'
  const createManual = jest.fn()
  const controller = new ReviewCaseController({
    createManual,
  } as unknown as ReviewCaseCreator)

  beforeEach(() => {
    createManual.mockReset()
  })

  it.each([
    { replayed: false, expectedStatus: 201 },
    { replayed: true, expectedStatus: 200 },
  ])(
    'returns $expectedStatus when replayed is $replayed',
    async ({ replayed, expectedStatus }) => {
      const result = response(replayed)
      createManual.mockResolvedValue(result)
      const status = jest.fn()

      await expect(
        controller.create(
          messageId,
          '  client-request-1  ',
          {
            flagReason: StudentFlagReason.INCORRECT,
            note: 'Please check this answer',
          },
          request(),
          { status } as unknown as Response,
        ),
      ).resolves.toBe(result)

      expect(status).toHaveBeenCalledWith(expectedStatus)
      expect(createManual).toHaveBeenCalledWith(
        messageId,
        {
          flagReason: StudentFlagReason.INCORRECT,
          note: 'Please check this answer',
        },
        'client-request-1',
        user,
        { ip: '127.0.0.1', userAgent: 'review-api-test' },
      )
    },
  )

  it('rejects a missing idempotency key before creating a case', async () => {
    await expect(
      controller.create(
        messageId,
        undefined,
        { flagReason: StudentFlagReason.CONFUSING, note: null },
        request(),
        { status: jest.fn() } as unknown as Response,
      ),
    ).rejects.toMatchObject({
      response: { code: 'REVIEW_INVALID_REQUEST' },
      status: 400,
    })
    expect(createManual).not.toHaveBeenCalled()
  })

  function request(): AuthenticatedHttpRequest {
    return {
      user,
      ip: '127.0.0.1',
      get: (name: string) =>
        name.toLowerCase() === 'user-agent' ? 'review-api-test' : undefined,
    } as AuthenticatedHttpRequest
  }

  function response(replayed: boolean) {
    return {
      caseId,
      messageId,
      status: 'PENDING' as const,
      trigger: 'STUDENT_REQUEST' as const,
      requestedAt: '2026-07-28T12:00:00.000Z',
      replayed,
      reviewSummary: {
        status: 'PENDING' as const,
        outcome: null,
        resolvedAt: null,
        reviewCaseId: caseId,
      },
    }
  }
})
