import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { NextFunction, Request, Response } from 'express'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../../app.setup'
import {
  NotificationStatus,
  NotificationType,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client'
import type { AuthenticatedHttpRequest } from '../identity/identity.guard'
import { NotificationsController } from './notifications.controller'
import { notificationNotFoundException } from './notifications.errors'
import { NotificationsService } from './notifications.service'

describe('NotificationsController', () => {
  const notificationId = '10000000-0000-4000-8000-000000000001'
  const foreignNotificationId = '10000000-0000-4000-8000-000000000002'
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
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
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

  it('lists only the authenticated user notifications with safe serialization', async () => {
    list.mockResolvedValue({
      items: [{ ...notification(), internalValue: 'must-not-leak' }],
      nextCursor: null,
    })

    const response = await request(app.getHttpServer())
      .get('/api/v1/notifications?limit=25')
      .expect(200)

    expect(list).toHaveBeenCalledWith(user, { limit: 25 })
    expect(response.body).toEqual({
      items: [notification()],
      nextCursor: null,
    })
  })

  it('returns the authenticated user unread count', async () => {
    unreadCount.mockResolvedValue({ unreadCount: 2 })

    await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .expect(200)
      .expect({ unreadCount: 2 })

    expect(unreadCount).toHaveBeenCalledWith(user)
  })

  it('marks a notification read and keeps a second call idempotent', async () => {
    const readNotification = {
      ...notification(),
      status: NotificationStatus.READ,
      readAt: '2026-07-31T00:05:00.000Z',
    }
    markRead.mockResolvedValue(readNotification)

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await request(app.getHttpServer())
        .post(`/api/v1/notifications/${notificationId}/read`)
        .expect(200)
        .expect(readNotification)
    }

    expect(markRead).toHaveBeenNthCalledWith(1, user, notificationId)
    expect(markRead).toHaveBeenNthCalledWith(2, user, notificationId)
  })

  it('returns 400 for an invalid notification UUID', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/notifications/not-a-uuid/read')
      .expect(400)

    expect(markRead).not.toHaveBeenCalled()
  })

  it('returns the concealed 404 for another user notification', async () => {
    markRead.mockRejectedValue(notificationNotFoundException())

    await request(app.getHttpServer())
      .post(`/api/v1/notifications/${foreignNotificationId}/read`)
      .expect(404)
      .expect({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification was not found',
      })

    expect(markRead).toHaveBeenCalledWith(user, foreignNotificationId)
  })

  function notification() {
    return {
      id: notificationId,
      reviewCaseId: '30000000-0000-4000-8000-000000000001',
      messageId: '40000000-0000-4000-8000-000000000001',
      sessionId: '50000000-0000-4000-8000-000000000001',
      type: NotificationType.REVIEW_RESOLVED,
      status: NotificationStatus.UNREAD,
      title: 'Instructor review completed',
      body: 'Your review request has been resolved.',
      createdAt: '2026-07-31T00:00:00.000Z',
      readAt: null,
    }
  }
})
