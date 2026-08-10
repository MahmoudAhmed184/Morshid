import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import type { AuthSessionResponse } from '../src/modules/auth/auth.dto'
import { MaterialProcessingScheduler } from '../src/modules/materials/material-processing.scheduler'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import { P0_DEMO_PASSWORD, seedP0DemoData } from '../src/seeds/p0-demo.seed'
import {
  P0_REVIEW_READINESS_FIXTURE,
  seedP0ReviewReadinessData,
} from '../src/seeds/p0-review-readiness.seed'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'
import { NoopMaterialProcessingScheduler } from './support/noop-material-processing-scheduler'

const STUDENT_NOTE = 'Please verify this categorized explanation'
const GUESSED_REVIEW_ID = '14000000-0000-4000-8000-000000000299'
const UNRELATED_STUDENT_CONTENT = 'Unrelated private history question'
const UNRELATED_ASSISTANT_CONTENT = 'Unrelated private history answer'

describe('Complete manual review journey (e2e)', () => {
  let app: INestApplication<App> | undefined
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let studentToken: string
  let otherStudentToken: string
  let instructorToken: string
  let reviewCaseId: string
  let notificationId: string

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue140_full_journey')
    prisma = database.prisma
    await seedP0DemoData(prisma)
    await seedP0ReviewReadinessData(prisma)
    await labelUnrelatedForeignHistory()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn().mockResolvedValue('PONG') })
      .overrideProvider(MaterialProcessingScheduler)
      .useClass(NoopMaterialProcessingScheduler)
      .compile()
    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()

    studentToken = await signIn('student1@morshid.demo')
    otherStudentToken = await signIn('student2@morshid.demo')
    instructorToken = await signIn('instructor@morshid.demo')
  })

  afterAll(async () => {
    try {
      await app?.close()
    } finally {
      await database?.dispose()
    }
  })

  it('creates and idempotently replays a categorized Student request', async () => {
    const path = `/api/v1/messages/${P0_REVIEW_READINESS_FIXTURE.owned.assistantMessageId}/review-requests`
    const body = { flagReason: 'CONFUSING', note: STUDENT_NOTE }
    const created = await request(requireApp().getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${studentToken}`)
      .set('Idempotency-Key', 'full-journey-student-request')
      .send(body)
      .expect(201)
    reviewCaseId = (created.body as { caseId: string }).caseId
    expect(created.body).toMatchObject({
      caseId: reviewCaseId,
      messageId: P0_REVIEW_READINESS_FIXTURE.owned.assistantMessageId,
      status: 'PENDING',
      trigger: 'STUDENT_REQUEST',
      replayed: false,
    })

    await request(requireApp().getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${studentToken}`)
      .set('Idempotency-Key', 'full-journey-student-request')
      .send(body)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          caseId: reviewCaseId,
          status: 'PENDING',
          replayed: true,
        })
      })

    await expect(
      prisma.reviewCase.findUniqueOrThrow({
        where: { id: reviewCaseId },
        include: { triggers: true },
      }),
    ).resolves.toMatchObject({
      status: 'PENDING',
      triggers: [
        {
          type: 'STUDENT_REQUEST',
          studentFlagReason: 'CONFUSING',
          reason: STUDENT_NOTE,
        },
      ],
    })
    await expect(prisma.reviewCase.count()).resolves.toBe(1)
    await expect(prisma.reviewTrigger.count()).resolves.toBe(1)
  })

  it('shows the case in the Instructor queue and returns bounded detail only', async () => {
    const queue = await request(requireApp().getHttpServer())
      .get('/api/v1/instructor/reviews')
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(200)
    expect(queue.body).toMatchObject({
      pendingCount: 1,
      items: [
        {
          reviewCaseId,
          status: 'PENDING',
          trigger: 'STUDENT_REQUEST',
          studentFlagReason: 'CONFUSING',
          studentNote: STUDENT_NOTE,
        },
      ],
    })

    const detail = await request(requireApp().getHttpServer())
      .get(`/api/v1/instructor/reviews/${reviewCaseId}`)
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(200)
    expect(detail.body).toMatchObject({
      reviewCaseId,
      status: 'PENDING',
      version: 1,
      trigger: 'STUDENT_REQUEST',
      studentFlagReason: 'CONFUSING',
      studentNote: STUDENT_NOTE,
      flaggedExchange: {
        role: 'STUDENT',
        content: 'Explain this course concept.',
      },
      assistantResponse: {
        role: 'ASSISTANT',
        content: 'A deterministic course-grounded explanation.',
      },
    })
    const serialized = JSON.stringify(detail.body)
    expect(serialized).not.toContain(UNRELATED_STUDENT_CONTENT)
    expect(serialized).not.toContain(UNRELATED_ASSISTANT_CONTENT)
  })

  it('resolves idempotently, preserves the original response, and emits one audit and notification', async () => {
    const original = await prisma.message.findUniqueOrThrow({
      where: { id: P0_REVIEW_READINESS_FIXTURE.owned.assistantMessageId },
    })
    const path = `/api/v1/instructor/reviews/${reviewCaseId}/resolve`
    const body = {
      expectedVersion: 1,
      outcome: 'APPROVED',
      content: null,
      reason: 'Verified against course guidance',
    }
    const resolved = await request(requireApp().getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${instructorToken}`)
      .set('Idempotency-Key', 'full-journey-resolve')
      .send(body)
      .expect(200)
    expect(resolved.body).toMatchObject({
      reviewCaseId,
      status: 'RESOLVED',
      outcome: 'APPROVED',
      publishedContent: original.content,
      version: 2,
      replayed: false,
    })

    await request(requireApp().getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${instructorToken}`)
      .set('Idempotency-Key', 'full-journey-resolve')
      .send(body)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          reviewCaseId,
          status: 'RESOLVED',
          version: 2,
          replayed: true,
        })
      })

    await expect(
      prisma.message.findUniqueOrThrow({ where: { id: original.id } }),
    ).resolves.toEqual(original)
    await expect(
      prisma.reviewCase.findUniqueOrThrow({ where: { id: reviewCaseId } }),
    ).resolves.toMatchObject({
      status: 'RESOLVED',
      outcome: 'APPROVED',
      publishedContent: original.content,
      version: 2,
    })
    await expect(
      prisma.reviewAction.count({ where: { reviewCaseId } }),
    ).resolves.toBe(2)
    await expect(
      prisma.reviewAction.findMany({
        where: { reviewCaseId },
        orderBy: { caseVersion: 'asc' },
        select: { actionType: true, caseVersion: true },
      }),
    ).resolves.toEqual([
      { actionType: 'CREATED', caseVersion: 1 },
      { actionType: 'APPROVED', caseVersion: 2 },
    ])
    await expect(
      prisma.notification.count({ where: { reviewCaseId } }),
    ).resolves.toBe(1)
  })

  it('shows the Student outcome and supports the unread-to-read notification flow', async () => {
    const detail = await request(requireApp().getHttpServer())
      .get(`/api/v1/student/reviews/${reviewCaseId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
    expect(detail.body).toMatchObject({
      reviewCaseId,
      status: 'RESOLVED',
      outcome: 'APPROVED',
      publishedContent: 'A deterministic course-grounded explanation.',
      messageId: P0_REVIEW_READINESS_FIXTURE.owned.assistantMessageId,
    })

    const notifications = await request(requireApp().getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
    expect(notifications.body).toMatchObject({
      items: [
        {
          reviewCaseId,
          status: 'UNREAD',
          type: 'REVIEW_RESOLVED',
        },
      ],
    })
    notificationId = (notifications.body as { items: { id: string }[] })
      .items[0].id
    await request(requireApp().getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
      .expect({ unreadCount: 1 })
    await request(requireApp().getHttpServer())
      .post(`/api/v1/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          id: string
          status: string
          readAt: string | null
        }
        expect(body).toMatchObject({
          id: notificationId,
          status: 'READ',
        })
        expect(body.readAt).not.toBeNull()
      })
    await request(requireApp().getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
      .expect({ unreadCount: 0 })
  })

  it('conceals the review and resolution from another Student and guessed ids', async () => {
    for (const id of [reviewCaseId, GUESSED_REVIEW_ID]) {
      await request(requireApp().getHttpServer())
        .get(`/api/v1/student/reviews/${id}`)
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .expect(404)
        .expect({
          code: 'REVIEW_NOT_FOUND',
          message: 'Review target was not found',
        })
    }
    const otherNotifications = await request(requireApp().getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${otherStudentToken}`)
      .expect(200)
    expect(otherNotifications.body).toEqual({ items: [], nextCursor: null })
  })

  function requireApp(): INestApplication<App> {
    if (app === undefined) throw new Error('Expected the app to be initialized')
    return app
  }

  async function signIn(email: string): Promise<string> {
    const response = await request(requireApp().getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)
    return (response.body as AuthSessionResponse).accessToken
  }

  async function labelUnrelatedForeignHistory(): Promise<void> {
    await prisma.message.update({
      where: { id: P0_REVIEW_READINESS_FIXTURE.foreign.studentMessageId },
      data: { content: UNRELATED_STUDENT_CONTENT },
    })
    await prisma.message.update({
      where: { id: P0_REVIEW_READINESS_FIXTURE.foreign.assistantMessageId },
      data: { content: UNRELATED_ASSISTANT_CONTENT },
    })
  }
})
