import { UserRole, UserStatus } from '../../identity/identity.roles'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { NextFunction, Request, Response } from 'express'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../../../app.setup'
import { ReviewOutcome, ReviewStatus } from '../interface/review-values'
import type { AuthenticatedHttpRequest } from '../../identity/identity.guard'
import { InstructorReviewActionService } from './instructor-review-action.service'
import { InstructorReviewResolutionController } from './instructor-review-resolution.controller'

describe('InstructorReviewResolutionController', () => {
  const reviewCaseId = '10000000-0000-4000-8000-000000000001'
  const user = {
    id: '20000000-0000-4000-8000-000000000001',
    email: 'instructor@example.test',
    displayName: 'Instructor',
    role: UserRole.INSTRUCTOR,
    status: UserStatus.ACTIVE,
  }
  const resolve = jest.fn()
  const reject = jest.fn()
  let app: INestApplication<App>

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [InstructorReviewResolutionController],
      providers: [
        {
          provide: InstructorReviewActionService,
          useValue: { resolve, reject },
        },
      ],
    }).compile()
    app = moduleFixture.createNestApplication<INestApplication<App>>()
    app.use((request: Request, _response: Response, next: NextFunction) => {
      const authenticatedRequest = request as AuthenticatedHttpRequest
      authenticatedRequest.user = user
      next()
    })
    configureApp(app)
    await app.init()
  })

  afterAll(async () => app.close())
  beforeEach(() => {
    resolve.mockReset()
    reject.mockReset()
  })

  it.each([
    {
      action: 'resolve',
      body: {
        expectedVersion: 1,
        outcome: ReviewOutcome.APPROVED,
        content: null,
        reason: null,
      },
      handler: resolve,
      result: actionResult(ReviewStatus.RESOLVED, ReviewOutcome.APPROVED),
    },
    {
      action: 'reject',
      body: { expectedVersion: 1, reason: 'Request rejected' },
      handler: reject,
      result: actionResult(
        ReviewStatus.REJECTED,
        ReviewOutcome.REQUEST_REJECTED,
      ),
    },
  ])('registers POST /$action and returns 200', async (example) => {
    example.handler.mockResolvedValue(example.result)

    await request(app.getHttpServer())
      .post(`/api/v1/instructor/reviews/${reviewCaseId}/${example.action}`)
      .set('Idempotency-Key', `${example.action}-key`)
      .send(example.body)
      .expect(200)
      .expect(example.result)

    expect(example.handler).toHaveBeenCalledWith(
      reviewCaseId,
      example.body,
      `${example.action}-key`,
      user,
      { ip: '::ffff:127.0.0.1', userAgent: null },
    )
  })

  it.each([
    ['resolve', { expectedVersion: 1, outcome: 'APPROVED', content: 'edit' }],
    ['reject', { expectedVersion: 1, reason: '   ' }],
  ])('returns 400 for an invalid %s body', async (action, body) => {
    await request(app.getHttpServer())
      .post(`/api/v1/instructor/reviews/${reviewCaseId}/${action}`)
      .set('Idempotency-Key', `${action}-invalid-key`)
      .send(body)
      .expect(400)

    expect(resolve).not.toHaveBeenCalled()
    expect(reject).not.toHaveBeenCalled()
  })

  function actionResult(status: ReviewStatus, outcome: ReviewOutcome) {
    return {
      reviewCaseId,
      status,
      outcome,
      publishedContent:
        outcome === ReviewOutcome.REQUEST_REJECTED ? null : 'Original answer',
      resolutionReason:
        outcome === ReviewOutcome.REQUEST_REJECTED ? 'Request rejected' : null,
      version: 2,
      resolvedAt: '2026-07-30T10:00:00.000Z',
      replayed: false,
    }
  }
})
