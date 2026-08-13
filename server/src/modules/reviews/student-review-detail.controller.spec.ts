import { UserRole, UserStatus } from '../identity/identity.roles'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { NextFunction, Request, Response } from 'express'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../../app.setup'
import { ReviewOutcome, ReviewStatus } from './review-values'
import type { AuthenticatedHttpRequest } from '../identity/identity.guard'
import { reviewNotFoundException } from './review-case.errors'
import { StudentReviewDetailController } from './student-review-detail.controller'
import { StudentReviewDetailService } from './student-review-detail.service'

describe('StudentReviewDetailController', () => {
  const reviewCaseId = '10000000-0000-4000-8000-000000000001'
  const user = {
    id: '20000000-0000-4000-8000-000000000001',
    email: 'student@example.test',
    displayName: 'Student',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  }
  const get = jest.fn()
  let app: INestApplication<App>

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [StudentReviewDetailController],
      providers: [{ provide: StudentReviewDetailService, useValue: { get } }],
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
  beforeEach(() => jest.clearAllMocks())

  it('returns 200 with the Student-safe response allow-list', async () => {
    get.mockResolvedValue({
      reviewCaseId,
      status: ReviewStatus.RESOLVED,
      outcome: ReviewOutcome.EDITED,
      publishedContent: 'Reviewed guidance',
      rejectionReason: null,
      requestedAt: '2026-07-30T10:00:00.000Z',
      resolvedAt: '2026-07-31T10:00:00.000Z',
      messageId: '30000000-0000-4000-8000-000000000001',
      sessionId: '40000000-0000-4000-8000-000000000001',
      instructorIdentity: 'must-not-leak',
      evidence: ['must-not-leak'],
    })

    const response = await request(app.getHttpServer())
      .get(`/api/v1/student/reviews/${reviewCaseId}`)
      .expect(200)

    expect(get).toHaveBeenCalledWith(user, reviewCaseId)
    expect(response.body).toEqual({
      reviewCaseId,
      status: ReviewStatus.RESOLVED,
      outcome: ReviewOutcome.EDITED,
      publishedContent: 'Reviewed guidance',
      rejectionReason: null,
      requestedAt: '2026-07-30T10:00:00.000Z',
      resolvedAt: '2026-07-31T10:00:00.000Z',
      messageId: '30000000-0000-4000-8000-000000000001',
      sessionId: '40000000-0000-4000-8000-000000000001',
    })
  })

  it('returns 400 for an invalid UUID', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/student/reviews/not-a-uuid')
      .expect(400)
    expect(get).not.toHaveBeenCalled()
  })

  it('returns the same concealed 404 for an inaccessible review', async () => {
    get.mockRejectedValue(reviewNotFoundException())
    await request(app.getHttpServer())
      .get(`/api/v1/student/reviews/${reviewCaseId}`)
      .expect(404)
      .expect({
        code: 'REVIEW_NOT_FOUND',
        message: 'Review target was not found',
      })
  })
})
