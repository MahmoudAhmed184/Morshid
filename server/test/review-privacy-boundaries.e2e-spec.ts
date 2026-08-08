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
import { REVIEW_ERROR_CODES } from '../src/modules/reviews/review-case.errors'
import {
  P0_DEMO_PASSWORD,
  seedP0DemoData,
  type P0DemoSeedResult,
} from '../src/seeds/p0-demo.seed'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'
import { NoopMaterialProcessingScheduler } from './support/noop-material-processing-scheduler'

const STUDENT_1_EMAIL = 'student1@morshid.demo'
const STUDENT_2_EMAIL = 'student2@morshid.demo'
const SESSION_ID = '14000000-0000-4000-8000-000000000001'
const STUDENT_MESSAGE_ID = '14000000-0000-4000-8000-000000000002'
const ASSISTANT_MESSAGE_ID = '14000000-0000-4000-8000-000000000003'
const UNENROLLED_SESSION_ID = '14000000-0000-4000-8000-000000000004'
const UNENROLLED_STUDENT_MESSAGE_ID = '14000000-0000-4000-8000-000000000005'
const UNENROLLED_ASSISTANT_MESSAGE_ID = '14000000-0000-4000-8000-000000000006'
const GUESSED_MESSAGE_ID = '14000000-0000-4000-8000-000000000099'
const COMPLETED_AT = new Date('2026-08-01T08:00:00.000Z')

const NOT_FOUND_ERROR = {
  code: REVIEW_ERROR_CODES.NOT_FOUND,
  message: 'Review target was not found',
} as const

const NOT_REVIEWABLE_ERROR = {
  code: REVIEW_ERROR_CODES.TARGET_NOT_REVIEWABLE,
  message: 'Only completed assistant responses can be reviewed',
} as const

describe('Manual review privacy boundaries (e2e)', () => {
  let app: INestApplication<App> | undefined
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let seed: P0DemoSeedResult
  let student1Id: string
  let pythonCourseId: string
  let hiddenCourseId: string
  let student1Token: string
  let student2Token: string

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue140_review_privacy')
    prisma = database.prisma
    seed = await seedP0DemoData(prisma)
    student1Id = seededUserId(STUDENT_1_EMAIL)
    pythonCourseId = seed.courses.pythonProgramming.id
    hiddenCourseId = seed.courses.hiddenIsolation.id

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

    student1Token = await signInAs(STUDENT_1_EMAIL)
    student2Token = await signInAs(STUDENT_2_EMAIL)
  })

  beforeEach(async () => {
    await prisma.reviewCase.deleteMany()
    await prisma.message.deleteMany()
    await prisma.chatSession.deleteMany()
    await prisma.courseMembership.deleteMany({
      where: { courseId: hiddenCourseId, userId: student1Id },
    })
    await createOwnedConversationFixture()
  })

  afterAll(async () => {
    try {
      await app?.close()
    } finally {
      await database?.dispose()
    }
  })

  it("conceals another Student's assistant message", async () => {
    const response = await requestReview(
      student2Token,
      ASSISTANT_MESSAGE_ID,
      'privacy-foreign-owner',
    ).expect(404)

    expect(response.body).toEqual(NOT_FOUND_ERROR)
    await expectNoReviewCase(ASSISTANT_MESSAGE_ID)
  })

  it('denies a target in a course where the Student is no longer enrolled', async () => {
    await createUnenrolledCourseFixture()

    const response = await requestReview(
      student1Token,
      UNENROLLED_ASSISTANT_MESSAGE_ID,
      'privacy-unenrolled-course',
    ).expect(404)

    expect(response.body).toEqual(NOT_FOUND_ERROR)
    await expectNoReviewCase(UNENROLLED_ASSISTANT_MESSAGE_ID)
  })

  it('conceals a guessed non-owned message id', async () => {
    const countBefore = await prisma.reviewCase.count()

    const response = await requestReview(
      student1Token,
      GUESSED_MESSAGE_ID,
      'privacy-guessed-message',
    ).expect(404)

    expect(response.body).toEqual(NOT_FOUND_ERROR)
    await expect(prisma.reviewCase.count()).resolves.toBe(countBefore)
  })

  it('rejects an unflagged non-assistant message in an owned conversation', async () => {
    const response = await requestReview(
      student1Token,
      STUDENT_MESSAGE_ID,
      'privacy-unflagged-message',
    ).expect(400)

    expect(response.body).toEqual(NOT_REVIEWABLE_ERROR)
    await expectNoReviewCase(STUDENT_MESSAGE_ID)
  })

  function requireApp(): INestApplication<App> {
    if (app === undefined) {
      throw new Error('Expected the test application to be initialized')
    }
    return app
  }

  function seededUserId(email: string): string {
    const user = seed.users.find((candidate) => candidate.email === email)
    if (user === undefined) {
      throw new Error(`Expected the P0 seed to contain ${email}`)
    }
    return user.id
  }

  async function signInAs(email: string): Promise<string> {
    const response = await request(requireApp().getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)

    return (response.body as AuthSessionResponse).accessToken
  }

  function requestReview(token: string, messageId: string, key: string) {
    return request(requireApp().getHttpServer())
      .post(`/api/v1/messages/${messageId}/review-requests`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({ flagReason: 'INCORRECT', note: null })
  }

  async function expectNoReviewCase(messageId: string): Promise<void> {
    await expect(
      prisma.reviewCase.count({ where: { targetMessageId: messageId } }),
    ).resolves.toBe(0)
  }

  async function createOwnedConversationFixture(): Promise<void> {
    await prisma.chatSession.create({
      data: {
        id: SESSION_ID,
        courseId: pythonCourseId,
        studentId: student1Id,
        title: 'Issue 140 owned review privacy fixture',
        lastSequence: 2,
      },
    })
    await createMessagePair(
      SESSION_ID,
      STUDENT_MESSAGE_ID,
      ASSISTANT_MESSAGE_ID,
    )
  }

  async function createUnenrolledCourseFixture(): Promise<void> {
    await prisma.courseMembership.create({
      data: {
        courseId: hiddenCourseId,
        userId: student1Id,
        role: 'STUDENT',
      },
    })
    await prisma.chatSession.create({
      data: {
        id: UNENROLLED_SESSION_ID,
        courseId: hiddenCourseId,
        studentId: student1Id,
        title: 'Issue 140 removed enrollment fixture',
        lastSequence: 2,
      },
    })
    await createMessagePair(
      UNENROLLED_SESSION_ID,
      UNENROLLED_STUDENT_MESSAGE_ID,
      UNENROLLED_ASSISTANT_MESSAGE_ID,
    )
    await prisma.courseMembership.update({
      where: {
        courseId_userId: { courseId: hiddenCourseId, userId: student1Id },
      },
      data: { removedAt: COMPLETED_AT },
    })
  }

  async function createMessagePair(
    sessionId: string,
    studentMessageId: string,
    assistantMessageId: string,
  ): Promise<void> {
    await prisma.message.createMany({
      data: [
        {
          id: studentMessageId,
          sessionId,
          sequence: 1,
          role: 'STUDENT',
          authorUserId: student1Id,
          content: 'Deterministic review privacy question',
          status: 'COMPLETED',
          completedAt: COMPLETED_AT,
        },
        {
          id: assistantMessageId,
          sessionId,
          sequence: 2,
          role: 'ASSISTANT',
          responseToMessageId: studentMessageId,
          content: 'Deterministic review privacy answer',
          status: 'COMPLETED',
          completedAt: COMPLETED_AT,
        },
      ],
    })
  }
})
