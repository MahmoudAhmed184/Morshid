import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { NextFunction, Request, Response } from 'express'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../../../app.setup'
import {
  ReviewInboxItemStatus,
  ReviewInboxItemType,
  UserRole,
  UserStatus,
} from '../../../generated/prisma/client'
import type { AuthenticatedHttpRequest } from '../../identity/identity.guard'
import { StudentReviewInboxController } from './student-review-inbox.controller'
import { reviewInboxItemNotFoundException } from './student-review-inbox.errors'
import { StudentReviewInboxService } from './student-review-inbox.service'

describe('StudentReviewInboxController', () => {
  const inboxItemId = '10000000-0000-4000-8000-000000000001'
  const foreignInboxItemId = '10000000-0000-4000-8000-000000000002'
  const user = {
    id: '20000000-0000-4000-8000-000000000001',
    email: 'student@example.test',
    displayName: 'Student',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  }
  const list = jest.fn()
  const unreadCount = jest.fn()
  const markRead = jest.fn()
  let app: INestApplication<App>

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [StudentReviewInboxController],
      providers: [
        {
          provide: StudentReviewInboxService,
          useValue: { list, unreadCount, markRead },
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
    jest.clearAllMocks()
  })

  it('lists direct-navigation identifiers with safe serialization', async () => {
    list.mockResolvedValue({
      items: [{ ...inboxItem(), internalValue: 'must-not-leak' }],
      nextCursor: null,
    })

    const response = await request(app.getHttpServer())
      .get('/api/v1/reviews/inbox?limit=25')
      .expect(200)

    expect(list).toHaveBeenCalledWith(user, { limit: 25 })
    expect(response.body).toEqual({
      items: [inboxItem()],
      nextCursor: null,
    })
  })

  it('returns the authenticated user unread count', async () => {
    unreadCount.mockResolvedValue({ unreadCount: 2 })

    await request(app.getHttpServer())
      .get('/api/v1/reviews/inbox/unread-count')
      .expect(200)
      .expect({ unreadCount: 2 })

    expect(unreadCount).toHaveBeenCalledWith(user)
  })

  it('marks an inbox item read and keeps a second call idempotent', async () => {
    const readItem = {
      ...inboxItem(),
      status: ReviewInboxItemStatus.READ,
      readAt: '2026-07-31T00:05:00.000Z',
    }
    markRead.mockResolvedValue(readItem)

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await request(app.getHttpServer())
        .post(`/api/v1/reviews/inbox/${inboxItemId}/read`)
        .expect(200)
        .expect(readItem)
    }

    expect(markRead).toHaveBeenNthCalledWith(1, user, inboxItemId)
    expect(markRead).toHaveBeenNthCalledWith(2, user, inboxItemId)
  })

  it('returns 400 for an invalid inbox item UUID', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/reviews/inbox/not-a-uuid/read')
      .expect(400)

    expect(markRead).not.toHaveBeenCalled()
  })

  it('returns the concealed 404 for another user inbox item', async () => {
    markRead.mockRejectedValue(reviewInboxItemNotFoundException())

    await request(app.getHttpServer())
      .post(`/api/v1/reviews/inbox/${foreignInboxItemId}/read`)
      .expect(404)
      .expect({
        code: 'REVIEW_INBOX_ITEM_NOT_FOUND',
        message: 'Review Inbox item was not found',
      })

    expect(markRead).toHaveBeenCalledWith(user, foreignInboxItemId)
  })

  function inboxItem() {
    return {
      id: inboxItemId,
      reviewCaseId: '30000000-0000-4000-8000-000000000001',
      courseId: '40000000-0000-4000-8000-000000000001',
      messageId: '50000000-0000-4000-8000-000000000001',
      sessionId: '60000000-0000-4000-8000-000000000001',
      type: ReviewInboxItemType.REVIEW_RESOLVED,
      status: ReviewInboxItemStatus.UNREAD,
      title: 'Instructor review completed',
      body: 'Your review request has been resolved.',
      createdAt: '2026-07-31T00:00:00.000Z',
      readAt: null,
    }
  }
})
