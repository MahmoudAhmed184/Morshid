import { randomUUID } from 'node:crypto'

import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../../src/app.setup'
import { AppModule } from '../../src/app.module'
import type { IdentitySessionResponse } from '../../src/modules/identity/identity.types'
import { MaterialProcessingScheduler } from '../../src/modules/materials/processing/material-processing.scheduler'
import { PrismaService } from '../../src/platform/database/prisma.service'
import { RedisService } from '../../src/platform/cache/redis.service'
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
import type { InstructorWorkloadSummaryDto } from '../../src/modules/reviews/instructor-queue/instructor-workload-summary.dto'
import {
  ReviewOutcome,
  ReviewStatus,
  ReviewTriggerType,
  StudentFlagReason,
} from '../../src/modules/reviews/interface/review-values'

const INSTRUCTOR_EMAIL = 'instructor@morshid.demo'
const STUDENT_EMAIL = 'student1@morshid.demo'

const COMPLETED_AT = new Date('2026-08-01T08:00:00.000Z')

describe('Instructor review workload summary (e2e)', () => {
  let app: INestApplication<App> | undefined
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let seed: P0DemoSeedResult
  let instructorId: string
  let studentId: string
  let instructorToken: string
  let studentToken: string
  let pythonCourseId: string
  let hiddenCourseId: string

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_f17_workload_summary')
    prisma = database.prisma
    seed = await seedP0DemoData(prisma)
    instructorId = seededUserId(INSTRUCTOR_EMAIL)
    studentId = seededUserId(STUDENT_EMAIL)
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

    instructorToken = await signInAs(INSTRUCTOR_EMAIL)
    studentToken = await signInAs(STUDENT_EMAIL)
  })

  beforeEach(async () => {
    await prisma.reviewInboxItem.deleteMany()
    await prisma.reviewAction.deleteMany()
    await prisma.reviewEvidenceSnapshot.deleteMany()
    await prisma.reviewTrigger.deleteMany()
    await prisma.reviewCase.deleteMany()
    await prisma.message.deleteMany()
    await prisma.chatSession.deleteMany()
    await prisma.courseMembership.deleteMany({
      where: { courseId: hiddenCourseId, userId: instructorId },
    })
  })

  afterAll(async () => {
    try {
      await app?.close()
    } finally {
      await database?.dispose()
    }
  })

  it('returns a zero-state summary when no review cases exist', async () => {
    const response = await request(requireApp().getHttpServer())
      .get('/api/v1/instructor/reviews/workload-summary')
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(200)

    const body = response.body as InstructorWorkloadSummaryDto
    expect(body).toMatchObject({
      pendingCount: 0,
      inReviewCount: 0,
      claimedByMeCount: 0,
      totalActiveCount: 0,
      oldestPendingCreatedAt: null,
      oldestPendingAge: null,
    })
    expect(body.byStudentFlagReason).toEqual(
      expect.arrayContaining([
        { reason: StudentFlagReason.INCORRECT, count: 0 },
        { reason: StudentFlagReason.CONFUSING, count: 0 },
        { reason: StudentFlagReason.UNHELPFUL, count: 0 },
        { reason: StudentFlagReason.COURSE_MISMATCH, count: 0 },
        { reason: StudentFlagReason.TOO_MUCH_ANSWER, count: 0 },
        { reason: StudentFlagReason.OTHER, count: 0 },
      ]),
    )
    expect(body.byTriggerType).toEqual(
      expect.arrayContaining([
        { trigger: ReviewTriggerType.STUDENT_REQUEST, count: 0 },
        { trigger: ReviewTriggerType.CITATION_MISSING, count: 0 },
        { trigger: ReviewTriggerType.GENERAL_NOT_FOUND, count: 0 },
        { trigger: ReviewTriggerType.SOURCE_CONFLICT, count: 0 },
        { trigger: ReviewTriggerType.POLICY_CHECK_FAILED, count: 0 },
        { trigger: ReviewTriggerType.FINAL_ANSWER_RISK, count: 0 },
      ]),
    )
  })

  it('aggregates workload metrics, claimed counts, and oldest pending age across assigned courses', async () => {
    const oldestPendingDate = new Date(Date.now() - 300_000)
    const newerPendingDate = new Date(Date.now() - 60_000)
    const inReviewDate = new Date(Date.now() - 120_000)
    const resolvedDate = new Date(Date.now() - 600_000)

    // Case 1: Pending, Incorrect student flag
    await createReviewCaseFixture({
      id: '17000000-0000-4000-8000-000000000001',
      courseId: pythonCourseId,
      status: ReviewStatus.PENDING,
      createdAt: oldestPendingDate,
      triggers: [
        {
          type: ReviewTriggerType.STUDENT_REQUEST,
          studentFlagReason: StudentFlagReason.INCORRECT,
        },
      ],
    })

    // Case 2: Pending, Confusing student flag + Citation missing automatic trigger
    await createReviewCaseFixture({
      id: '17000000-0000-4000-8000-000000000002',
      courseId: pythonCourseId,
      status: ReviewStatus.PENDING,
      createdAt: newerPendingDate,
      triggers: [
        {
          type: ReviewTriggerType.STUDENT_REQUEST,
          studentFlagReason: StudentFlagReason.CONFUSING,
        },
        {
          type: ReviewTriggerType.CITATION_MISSING,
          studentFlagReason: null,
        },
      ],
    })

    // Case 3: In Review, claimed by instructor
    await createReviewCaseFixture({
      id: '17000000-0000-4000-8000-000000000003',
      courseId: pythonCourseId,
      status: ReviewStatus.IN_REVIEW,
      assignedInstructorId: instructorId,
      createdAt: inReviewDate,
      triggers: [
        {
          type: ReviewTriggerType.SOURCE_CONFLICT,
          studentFlagReason: null,
        },
      ],
    })

    // Case 4: Resolved (completed - should not be in active workload)
    await createReviewCaseFixture({
      id: '17000000-0000-4000-8000-000000000004',
      courseId: pythonCourseId,
      status: ReviewStatus.RESOLVED,
      outcome: ReviewOutcome.APPROVED,
      publishedContent: 'Original approved answer',
      resolvedAt: new Date(),
      assignedInstructorId: instructorId,
      resolvedByUserId: instructorId,
      createdAt: resolvedDate,
      triggers: [
        {
          type: ReviewTriggerType.STUDENT_REQUEST,
          studentFlagReason: StudentFlagReason.INCORRECT,
        },
      ],
    })

    const response = await request(requireApp().getHttpServer())
      .get('/api/v1/instructor/reviews/workload-summary')
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(200)

    const body = response.body as InstructorWorkloadSummaryDto
    expect(body.pendingCount).toBe(2)
    expect(body.inReviewCount).toBe(1)
    expect(body.claimedByMeCount).toBe(1)
    expect(body.totalActiveCount).toBe(3)
    expect(body.oldestPendingCreatedAt).toBe(oldestPendingDate.toISOString())
    expect(body.oldestPendingAge).toBeGreaterThanOrEqual(290)

    const incorrect = body.byStudentFlagReason.find(
      (r) => r.reason === StudentFlagReason.INCORRECT,
    )
    const confusing = body.byStudentFlagReason.find(
      (r) => r.reason === StudentFlagReason.CONFUSING,
    )
    expect(incorrect?.count).toBe(1)
    expect(confusing?.count).toBe(1)

    const studentRequest = body.byTriggerType.find(
      (t) => t.trigger === ReviewTriggerType.STUDENT_REQUEST,
    )
    const citationMissing = body.byTriggerType.find(
      (t) => t.trigger === ReviewTriggerType.CITATION_MISSING,
    )
    const sourceConflict = body.byTriggerType.find(
      (t) => t.trigger === ReviewTriggerType.SOURCE_CONFLICT,
    )
    expect(studentRequest?.count).toBe(2)
    expect(citationMissing?.count).toBe(1)
    expect(sourceConflict?.count).toBe(1)
  })

  it('filters summary by specific courseId and denies unassigned courses', async () => {
    // Add pending case in python course
    await createReviewCaseFixture({
      id: '17000000-0000-4000-8000-000000000010',
      courseId: pythonCourseId,
      status: ReviewStatus.PENDING,
      createdAt: new Date(),
      triggers: [
        {
          type: ReviewTriggerType.STUDENT_REQUEST,
          studentFlagReason: StudentFlagReason.OTHER,
        },
      ],
    })

    const scopedResponse = await request(requireApp().getHttpServer())
      .get(
        `/api/v1/instructor/reviews/workload-summary?courseId=${pythonCourseId}`,
      )
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(200)

    const scopedBody = scopedResponse.body as InstructorWorkloadSummaryDto
    expect(scopedBody.pendingCount).toBe(1)

    // Unassigned course (hidden course)
    await request(requireApp().getHttpServer())
      .get(
        `/api/v1/instructor/reviews/workload-summary?courseId=${hiddenCourseId}`,
      )
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(404)
      .expect((res) => {
        const errorBody = res.body as { code: string }
        expect(errorBody.code).toBe(REVIEW_ERROR_CODES.NOT_FOUND)
      })
  })

  it('immediately excludes cases when instructor course membership is removed', async () => {
    await prisma.courseMembership.create({
      data: {
        courseId: hiddenCourseId,
        userId: instructorId,
        role: 'INSTRUCTOR',
      },
    })

    await createReviewCaseFixture({
      id: '17000000-0000-4000-8000-000000000020',
      courseId: hiddenCourseId,
      status: ReviewStatus.PENDING,
      createdAt: new Date(),
      triggers: [
        {
          type: ReviewTriggerType.STUDENT_REQUEST,
          studentFlagReason: StudentFlagReason.UNHELPFUL,
        },
      ],
    })

    // Accessible while active
    const activeRes = await request(requireApp().getHttpServer())
      .get(
        `/api/v1/instructor/reviews/workload-summary?courseId=${hiddenCourseId}`,
      )
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(200)
    const activeBody = activeRes.body as InstructorWorkloadSummaryDto
    expect(activeBody.pendingCount).toBe(1)

    // Remove membership
    await prisma.courseMembership.update({
      where: {
        courseId_userId: {
          courseId: hiddenCourseId,
          userId: instructorId,
        },
      },
      data: { removedAt: new Date() },
    })

    // Immediately denied and not inferrable
    await request(requireApp().getHttpServer())
      .get(
        `/api/v1/instructor/reviews/workload-summary?courseId=${hiddenCourseId}`,
      )
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(404)
  })

  it('denies student role access to instructor workload summary', async () => {
    await request(requireApp().getHttpServer())
      .get('/api/v1/instructor/reviews/workload-summary')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403)
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

    return (response.body as IdentitySessionResponse).accessToken
  }

  async function createReviewCaseFixture(input: {
    id: string
    courseId: string
    status: ReviewStatus
    outcome?: ReviewOutcome | null
    publishedContent?: string | null
    resolutionReason?: string | null
    resolvedAt?: Date | null
    assignedInstructorId?: string
    resolvedByUserId?: string
    createdAt: Date
    triggers: {
      type: ReviewTriggerType
      studentFlagReason: StudentFlagReason | null
    }[]
  }): Promise<void> {
    const sessionId = `17000000-0000-4000-8000-${input.id.slice(-12)}`
    const studentMsgId = `17000000-0001-4000-8000-${input.id.slice(-12)}`
    const assistantMsgId = `17000000-0002-4000-8000-${input.id.slice(-12)}`

    await prisma.courseMembership.upsert({
      where: {
        courseId_userId: {
          courseId: input.courseId,
          userId: studentId,
        },
      },
      create: {
        courseId: input.courseId,
        userId: studentId,
        role: 'STUDENT',
      },
      update: {},
    })

    await prisma.chatSession.create({
      data: {
        id: sessionId,
        courseId: input.courseId,
        studentId,
        title: 'Workload summary test session',
        lastSequence: 2,
      },
    })

    await prisma.message.createMany({
      data: [
        {
          id: studentMsgId,
          sessionId,
          sequence: 1,
          role: 'STUDENT',
          authorUserId: studentId,
          content: 'Student question for summary test',
          status: 'COMPLETED',
          completedAt: COMPLETED_AT,
        },
        {
          id: assistantMsgId,
          sessionId,
          sequence: 2,
          role: 'ASSISTANT',
          responseToMessageId: studentMsgId,
          content: 'Assistant answer for summary test',
          status: 'COMPLETED',
          completedAt: COMPLETED_AT,
        },
      ],
    })

    await prisma.reviewCase.create({
      data: {
        id: input.id,
        targetMessageId: assistantMsgId,
        courseId: input.courseId,
        requestedByUserId: studentId,
        assignedInstructorId: input.assignedInstructorId,
        resolvedByUserId: input.resolvedByUserId,
        status: input.status,
        outcome: input.outcome,
        publishedContent: input.publishedContent,
        resolutionReason: input.resolutionReason,
        resolvedAt: input.resolvedAt,
        createdAt: input.createdAt,
        triggers: {
          create: input.triggers.map((t) => ({
            type: t.type,
            studentFlagReason: t.studentFlagReason,
            actorUserId:
              t.type === ReviewTriggerType.STUDENT_REQUEST ? studentId : null,
            sourceEventKey:
              t.type === ReviewTriggerType.STUDENT_REQUEST
                ? null
                : `event-${randomUUID()}`,
          })),
        },
      },
    })
  }
})
