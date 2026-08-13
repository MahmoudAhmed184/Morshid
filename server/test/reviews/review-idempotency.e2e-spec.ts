import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../../src/app.setup'
import { AppModule } from '../../src/app.module'
import type { IdentitySessionResponse } from '../../src/modules/identity/identity.types'
import { MaterialProcessingScheduler } from '../../src/modules/materials/material-processing.scheduler'
import { PrismaService } from '../../src/platform/database/prisma.service'
import { DatabaseTransactionRunner } from '../../src/platform/database/database-transaction'
import { RedisService } from '../../src/platform/cache/redis.service'
import type { CreateReviewRequestResponseDto } from '../../src/modules/reviews/intake/review-case.dto'
import {
  ReviewCaseIntake,
  type AutomaticReviewIntakeInput,
} from '../../src/modules/reviews/interface/review-case-intake'
import { REVIEW_ERROR_CODES } from '../../src/modules/reviews/review-case.errors'
import {
  P0_DEMO_PASSWORD,
  seedP0DemoData,
  type P0DemoSeedResult,
} from '../../src/seeds/p0-demo.seed'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from '../support/disposable-database'
import { NoopMaterialProcessingScheduler } from '../support/noop-material-processing-scheduler'

const STUDENT_EMAIL = 'student1@morshid.demo'
const SESSION_ID = '14000000-0000-4000-8000-000000000101'
const STUDENT_MESSAGE_IDS = [
  '14000000-0000-4000-8000-000000000111',
  '14000000-0000-4000-8000-000000000112',
  '14000000-0000-4000-8000-000000000113',
  '14000000-0000-4000-8000-000000000114',
] as const
const ASSISTANT_MESSAGE_IDS = [
  '14000000-0000-4000-8000-000000000121',
  '14000000-0000-4000-8000-000000000122',
  '14000000-0000-4000-8000-000000000123',
  '14000000-0000-4000-8000-000000000124',
] as const
const COMPLETED_AT = new Date('2026-08-01T08:00:00.000Z')
const NORMALIZED_NOTE = 'Please check this explanation'

const IDEMPOTENCY_CONFLICT_ERROR = {
  code: REVIEW_ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
  message: 'Idempotency key was already used for a different request',
} as const

const QUOTA_ERROR = {
  code: REVIEW_ERROR_CODES.QUOTA_EXCEEDED,
  message: 'Daily manual review request limit reached',
} as const

describe('Manual review request idempotency (e2e)', () => {
  let app: INestApplication<App> | undefined
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let seed: P0DemoSeedResult
  let studentId: string
  let courseId: string
  let studentToken: string
  let reviewCaseIntake: ReviewCaseIntake
  let transactionRunner: DatabaseTransactionRunner

  beforeAll(async () => {
    database = await setUpDisposableDatabase(
      'morshid_issue140_review_idempotency',
    )
    prisma = database.prisma
    seed = await seedP0DemoData(prisma)
    studentId = seededUserId(STUDENT_EMAIL)
    courseId = seed.courses.pythonProgramming.id

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
    reviewCaseIntake = moduleFixture.get(ReviewCaseIntake)
    transactionRunner = moduleFixture.get(DatabaseTransactionRunner)
    studentToken = await signInAs(STUDENT_EMAIL)
  })

  beforeEach(async () => {
    await prisma.auditLog.deleteMany()
    await prisma.reviewCase.deleteMany()
    await prisma.idempotencyRecord.deleteMany()
    await prisma.message.deleteMany()
    await prisma.chatSession.deleteMany()
    await createReviewableMessagesFixture()
  })

  afterAll(async () => {
    try {
      await app?.close()
    } finally {
      await database?.dispose()
    }
  })

  it('replays the same request without consuming quota or duplicating side effects', async () => {
    const first = await requestReview({
      messageId: ASSISTANT_MESSAGE_IDS[0],
      idempotencyKey: 'same-request',
      flagReason: 'INCORRECT',
      note: NORMALIZED_NOTE,
    }).expect(201)
    const replay = await requestReview({
      messageId: ASSISTANT_MESSAGE_IDS[0],
      idempotencyKey: 'same-request',
      flagReason: 'INCORRECT',
      note: NORMALIZED_NOTE,
    }).expect(200)

    const firstBody = reviewResponse(first)
    const replayBody = reviewResponse(replay)
    expectSameEffectiveReview(firstBody, replayBody)
    expect(replayBody.replayed).toBe(true)
    expect(firstBody.replayed).toBe(false)
    await expectSinglePersistedRequest(ASSISTANT_MESSAGE_IDS[0], 'same-request')

    for (const [index, messageId] of ASSISTANT_MESSAGE_IDS.slice(
      1,
      3,
    ).entries()) {
      await requestReview({
        messageId,
        idempotencyKey: `same-request-distinct-${String(index + 1)}`,
        flagReason: 'CONFUSING',
        note: null,
      }).expect(201)
    }
    await requestReview({
      messageId: ASSISTANT_MESSAGE_IDS[3],
      idempotencyKey: 'same-request-over-quota',
      flagReason: 'CONFUSING',
      note: null,
    })
      .expect(429)
      .expect(QUOTA_ERROR)

    await expect(
      prisma.reviewCase.count({ where: { requestedByUserId: studentId } }),
    ).resolves.toBe(3)
  })

  it('treats whitespace-equivalent normalized notes as the same request', async () => {
    const first = await requestReview({
      messageId: ASSISTANT_MESSAGE_IDS[0],
      idempotencyKey: 'normalized-note',
      flagReason: 'INCORRECT',
      note: '  Please check this explanation  ',
    }).expect(201)
    const replay = await requestReview({
      messageId: ASSISTANT_MESSAGE_IDS[0],
      idempotencyKey: 'normalized-note',
      flagReason: 'INCORRECT',
      note: NORMALIZED_NOTE,
    }).expect(200)

    const firstBody = reviewResponse(first)
    const replayBody = reviewResponse(replay)
    expectSameEffectiveReview(firstBody, replayBody)
    expect(replayBody.replayed).toBe(true)
    await expectSinglePersistedRequest(
      ASSISTANT_MESSAGE_IDS[0],
      'normalized-note',
    )
    await expect(
      prisma.reviewTrigger.findFirstOrThrow({
        where: { reviewCase: { targetMessageId: ASSISTANT_MESSAGE_IDS[0] } },
        select: { reason: true },
      }),
    ).resolves.toEqual({ reason: NORMALIZED_NOTE })
  })

  it('rejects a changed payload under the same idempotency key and preserves the case', async () => {
    await requestReview({
      messageId: ASSISTANT_MESSAGE_IDS[0],
      idempotencyKey: 'changed-payload',
      flagReason: 'INCORRECT',
      note: NORMALIZED_NOTE,
    }).expect(201)
    const before = await persistedCase(ASSISTANT_MESSAGE_IDS[0])

    const conflict = await requestReview({
      messageId: ASSISTANT_MESSAGE_IDS[0],
      idempotencyKey: 'changed-payload',
      flagReason: 'CONFUSING',
      note: NORMALIZED_NOTE,
    }).expect(409)

    expect(conflict.body).toEqual(IDEMPOTENCY_CONFLICT_ERROR)
    await expect(persistedCase(ASSISTANT_MESSAGE_IDS[0])).resolves.toEqual(
      before,
    )
    await expectSinglePersistedRequest(
      ASSISTANT_MESSAGE_IDS[0],
      'changed-payload',
    )
  })

  it('creates one case per different valid message and counts quota deterministically', async () => {
    const responses: CreateReviewRequestResponseDto[] = []
    for (const [index, messageId] of ASSISTANT_MESSAGE_IDS.entries()) {
      const response = await requestReview({
        messageId,
        idempotencyKey: `distinct-message-${String(index + 1)}`,
        flagReason: 'UNHELPFUL',
        note: null,
      })

      if (index < 3) {
        expect(response.status).toBe(201)
        responses.push(reviewResponse(response))
      } else {
        expect(response.status).toBe(429)
        expect(response.body).toEqual(QUOTA_ERROR)
      }
    }

    expect(new Set(responses.map(({ caseId }) => caseId)).size).toBe(3)
    expect(responses.map(({ messageId }) => messageId)).toEqual(
      ASSISTANT_MESSAGE_IDS.slice(0, 3),
    )
    await expect(
      prisma.reviewCase.count({ where: { requestedByUserId: studentId } }),
    ).resolves.toBe(3)
    await expect(
      prisma.reviewCase.count({
        where: { targetMessageId: ASSISTANT_MESSAGE_IDS[3] },
      }),
    ).resolves.toBe(0)
  })

  it('allows an expired idempotency key to identify a new request', async () => {
    await requestReview({
      messageId: ASSISTANT_MESSAGE_IDS[0],
      idempotencyKey: 'expired-key',
      flagReason: 'INCORRECT',
      note: null,
    }).expect(201)
    await prisma.idempotencyRecord.updateMany({
      where: { actorUserId: studentId, key: 'expired-key' },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    })

    await requestReview({
      messageId: ASSISTANT_MESSAGE_IDS[1],
      idempotencyKey: 'expired-key',
      flagReason: 'CONFUSING',
      note: null,
    }).expect(201)

    await expect(
      prisma.idempotencyRecord.findUniqueOrThrow({
        where: {
          actorUserId_operationScope_key: {
            actorUserId: studentId,
            operationScope: 'review.create.manual',
            key: 'expired-key',
          },
        },
        select: { resourceId: true },
      }),
    ).resolves.toEqual({
      resourceId: (await persistedCase(ASSISTANT_MESSAGE_IDS[1])).id,
    })
  })

  it('counts manual triggers attached to automatic cases against quota', async () => {
    for (const [index, messageId] of ASSISTANT_MESSAGE_IDS.entries()) {
      await openAutomatic({
        messageId,
        triggers: [
          {
            trigger: 'POLICY_CHECK_FAILED',
            sourceEventKey: `automatic-case-${String(index)}`,
          },
        ],
        evidence: { summary: 'Automatic review fixture' },
      })
    }

    for (const [index, messageId] of ASSISTANT_MESSAGE_IDS.entries()) {
      const response = await requestReview({
        messageId,
        idempotencyKey: `automatic-manual-${String(index)}`,
        flagReason: 'INCORRECT',
        note: null,
      })
      expect(response.status).toBe(index < 3 ? 200 : 429)
    }

    await expect(
      prisma.reviewTrigger.count({
        where: { type: 'STUDENT_REQUEST', actorUserId: studentId },
      }),
    ).resolves.toBe(3)
  })

  function requireApp(): INestApplication<App> {
    if (app === undefined) {
      throw new Error('Expected the test application to be initialized')
    }
    return app
  }

  function openAutomatic(input: AutomaticReviewIntakeInput) {
    return transactionRunner.run((transaction) =>
      reviewCaseIntake.openAutomatic(input, transaction),
    )
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
    return (response.body as IdentitySessionResponse).accessToken
  }

  function requestReview(input: {
    messageId: string
    idempotencyKey: string
    flagReason: 'INCORRECT' | 'CONFUSING' | 'UNHELPFUL'
    note: string | null
  }) {
    return request(requireApp().getHttpServer())
      .post(`/api/v1/messages/${input.messageId}/review-requests`)
      .set('Authorization', `Bearer ${studentToken}`)
      .set('Idempotency-Key', input.idempotencyKey)
      .send({ flagReason: input.flagReason, note: input.note })
  }

  function reviewResponse(response: {
    body: unknown
  }): CreateReviewRequestResponseDto {
    return response.body as CreateReviewRequestResponseDto
  }

  function expectSameEffectiveReview(
    first: CreateReviewRequestResponseDto,
    replay: CreateReviewRequestResponseDto,
  ): void {
    expect(replay.caseId).toBe(first.caseId)
    expect(replay.messageId).toBe(first.messageId)
    expect(replay.status).toBe(first.status)
    expect(replay.trigger).toBe(first.trigger)
    expect(replay.requestedAt).toBe(first.requestedAt)
    expect(replay.reviewSummary).toEqual(first.reviewSummary)
  }

  async function persistedCase(messageId: string) {
    return prisma.reviewCase.findUniqueOrThrow({
      where: { targetMessageId: messageId },
      select: {
        id: true,
        targetMessageId: true,
        courseId: true,
        requestedByUserId: true,
        status: true,
        version: true,
        triggers: {
          select: {
            type: true,
            actorUserId: true,
            studentFlagReason: true,
            reason: true,
          },
        },
        actions: { select: { actionType: true, caseVersion: true } },
        evidence: { select: { contentHash: true } },
      },
    })
  }

  async function expectSinglePersistedRequest(
    messageId: string,
    idempotencyKey: string,
  ): Promise<void> {
    const reviewCase = await persistedCase(messageId)
    await expect(
      prisma.reviewCase.count({ where: { targetMessageId: messageId } }),
    ).resolves.toBe(1)
    expect(reviewCase.triggers).toHaveLength(1)
    expect(reviewCase.actions).toHaveLength(1)
    expect(reviewCase.evidence).not.toBeNull()
    await expect(
      prisma.idempotencyRecord.count({
        where: {
          actorUserId: studentId,
          operationScope: 'review.create.manual',
          key: idempotencyKey,
        },
      }),
    ).resolves.toBe(1)
    await expect(
      prisma.auditLog.count({
        where: {
          action: 'review.case_created',
          targetId: reviewCase.id,
        },
      }),
    ).resolves.toBe(1)
  }

  async function createReviewableMessagesFixture(): Promise<void> {
    await prisma.chatSession.create({
      data: {
        id: SESSION_ID,
        courseId,
        studentId,
        title: 'Issue 140 idempotency fixture',
        lastSequence: ASSISTANT_MESSAGE_IDS.length * 2,
      },
    })
    await prisma.message.createMany({
      data: ASSISTANT_MESSAGE_IDS.flatMap((assistantMessageId, index) => [
        {
          id: STUDENT_MESSAGE_IDS[index],
          sessionId: SESSION_ID,
          sequence: index * 2 + 1,
          role: 'STUDENT' as const,
          authorUserId: studentId,
          content: `Deterministic question ${String(index + 1)}`,
          status: 'COMPLETED' as const,
          completedAt: COMPLETED_AT,
        },
        {
          id: assistantMessageId,
          sessionId: SESSION_ID,
          sequence: index * 2 + 2,
          role: 'ASSISTANT' as const,
          responseToMessageId: STUDENT_MESSAGE_IDS[index],
          content: `Deterministic answer ${String(index + 1)}`,
          status: 'COMPLETED' as const,
          completedAt: COMPLETED_AT,
        },
      ]),
    })
  }
})
