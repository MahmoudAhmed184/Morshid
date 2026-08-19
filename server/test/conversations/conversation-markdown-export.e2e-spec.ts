import { type INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../../src/app.setup'
import { AppModule } from '../../src/app.module'
import {
  CourseMembershipRole,
  MessageGuidanceLabel,
  MessageRole,
  MessageStatus,
  ReviewOutcome,
  ReviewStatus,
  ReviewTriggerType,
} from '../../src/generated/prisma/client'
import type { IdentitySessionResponse } from '../../src/modules/identity/identity.types'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../../src/modules/audit/audit.constants'
import { MaterialProcessingScheduler } from '../../src/modules/materials/processing/material-processing.scheduler'
import { PrismaService } from '../../src/platform/database/prisma.service'
import { RedisService } from '../../src/platform/cache/redis.service'
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

const STUDENT_1_EMAIL = 'student1@morshid.demo'
const STUDENT_2_EMAIL = 'student2@morshid.demo'
const UNASSIGNED_STUDENT_EMAIL = 'student3@morshid.demo'
const INSTRUCTOR_EMAIL = 'instructor@morshid.demo'

interface SeededActor {
  id: string
  email: string
}

describe('Conversation Markdown Export (e2e)', () => {
  let app: INestApplication<App> | undefined
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let seed: P0DemoSeedResult
  let pythonCourseId: string
  let student1: SeededActor
  let student2: SeededActor
  let unassignedStudent: SeededActor
  let instructor: SeededActor
  let student1Token: string
  let student2Token: string
  let unassignedStudentToken: string
  let instructorToken: string

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_export_e2e')
    prisma = database.prisma
    seed = await seedP0DemoData(prisma)
    pythonCourseId = seed.courses.pythonProgramming.id
    student1 = requireSeededActor(STUDENT_1_EMAIL)
    student2 = requireSeededActor(STUDENT_2_EMAIL)
    unassignedStudent = requireSeededActor(UNASSIGNED_STUDENT_EMAIL)
    instructor = requireSeededActor(INSTRUCTOR_EMAIL)

    await prisma.courseMembership.update({
      where: {
        courseId_userId: {
          courseId: pythonCourseId,
          userId: unassignedStudent.id,
        },
      },
      data: { removedAt: new Date() },
    })

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
    unassignedStudentToken = await signInAs(UNASSIGNED_STUDENT_EMAIL)
    instructorToken = await signInAs(INSTRUCTOR_EMAIL)
  })

  beforeEach(async () => {
    await prisma.auditLog.deleteMany()
    await prisma.messageCitation.deleteMany()
    await prisma.messageRetrieval.deleteMany()
    await prisma.reviewTrigger.deleteMany()
    await prisma.reviewCase.deleteMany()
    await prisma.message.deleteMany()
    await prisma.chatSession.deleteMany()
  })

  afterAll(async () => {
    try {
      await app?.close()
    } finally {
      await database?.dispose()
    }
  })

  function requireApp(): INestApplication<App> {
    if (app === undefined) {
      throw new Error('Expected the test application to be initialized')
    }

    return app
  }

  function requireSeededActor(email: string): SeededActor {
    const actor = seed.users.find((user) => user.email === email)

    if (actor === undefined) {
      throw new Error(`Expected the P0 seed to contain ${email}`)
    }

    return { id: actor.id, email: actor.email }
  }

  async function signInAs(email: string): Promise<string> {
    const response = await request(requireApp().getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)

    const session = response.body as IdentitySessionResponse
    return session.accessToken
  }

  it('exports complete authorized student conversation as markdown with citations and published guidance', async () => {
    // Create session for student1
    const session = await prisma.chatSession.create({
      data: {
        courseId: pythonCourseId,
        studentId: student1.id,
        title: 'Export Testing & Recursion',
      },
    })

    // Create material for citation
    const material = await prisma.material.create({
      data: {
        courseId: pythonCourseId,
        uploadedById: instructor.id,
        title: 'Recursion Basics Lecture',
        originalFilename: 'test-recursion.pdf',
        storagePath: 'materials/test-recursion.pdf',
        status: 'READY',
      },
    })

    // Create student message
    await prisma.message.create({
      data: {
        sessionId: session.id,
        sequence: 1,
        role: MessageRole.STUDENT,
        content: 'Why is a base case necessary in recursion?',
        status: MessageStatus.COMPLETED,
        authorUserId: student1.id,
        createdAt: new Date('2026-08-16T10:00:00.000Z'),
        completedAt: new Date('2026-08-16T10:00:00.000Z'),
      },
    })

    // Create assistant message with citation
    const msg2 = await prisma.message.create({
      data: {
        sessionId: session.id,
        sequence: 2,
        role: MessageRole.ASSISTANT,
        content: 'A base case ensures that the recursion eventually halts.',
        guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
        status: MessageStatus.COMPLETED,
        promptVersion: 'v1.0.0-secret-prompt',
        createdAt: new Date('2026-08-16T10:00:02.000Z'),
        completedAt: new Date('2026-08-16T10:00:05.000Z'),
        citations: {
          create: [
            {
              citationOrder: 1,
              materialId: material.id,
            },
          ],
        },
      },
    })

    // Create resolved review case with published instructor guidance
    await prisma.reviewCase.create({
      data: {
        courseId: pythonCourseId,
        targetMessageId: msg2.id,
        status: ReviewStatus.RESOLVED,
        outcome: ReviewOutcome.APPROVED,
        publishedContent: 'Instructor approved: clear and precise explanation.',
        resolvedAt: new Date('2026-08-16T11:00:00.000Z'),
        resolvedByUserId: instructor.id,
        triggers: {
          create: [
            {
              type: ReviewTriggerType.STUDENT_REQUEST,
              actorUserId: student1.id,
              studentFlagReason: 'INCORRECT',
            },
          ],
        },
      },
    })

    const response = await request(requireApp().getHttpServer())
      .get(
        `/api/v1/courses/${pythonCourseId}/chat-sessions/${session.id}/export`,
      )
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(200)

    const contentType = response.headers['content-type']
    const contentDisposition = response.headers['content-disposition']
    expect(
      typeof contentType === 'string' && contentType.includes('text/markdown'),
    ).toBe(true)
    expect(
      typeof contentDisposition === 'string' &&
        contentDisposition.includes('attachment;') &&
        contentDisposition.includes(
          'morshid-PYTHON-PROG-P0-Export-Testing-Recursion.md',
        ),
    ).toBe(true)

    const text = response.text
    expect(text).toContain('# Morshid Conversation Export')
    expect(text).toContain('- **Course:** PYTHON-PROG-P0 — Python Programming')
    expect(text).toContain('- **Conversation:** Export Testing &amp; Recursion')
    expect(text).toContain('## Message 1 — Student')
    expect(text).toContain('Why is a base case necessary in recursion?')
    expect(text).toContain('## Message 2 — Assistant')
    expect(text).toContain('*Guidance: Course Grounded*')
    expect(text).toContain(
      'A base case ensures that the recursion eventually halts.',
    )
    expect(text).toContain('### Citations')
    expect(text).toContain('1. [1] **Recursion Basics Lecture**')
    expect(text).toContain('### Published Instructor Guidance')
    expect(text).toContain('*Outcome: Approved (2026-08-16T11:00:00.000Z)*')
    expect(text).toContain(
      'Instructor approved: clear and precise explanation.',
    )

    // Verify exclusions
    expect(text).not.toContain('v1.0.0-secret-prompt')
    expect(text).not.toContain('STUDENT_REQUEST')

    // Verify audit log
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_EXPORTED,
        targetType: AUDIT_TARGET_TYPES.CHAT_SESSION,
        targetId: session.id,
      },
    })
    expect(auditLog).not.toBeNull()
    expect(auditLog?.actorUserId).toBe(student1.id)
    expect(auditLog?.courseId).toBe(pythonCourseId)
  })

  it('rejects export with 403 when unassigned student attempts to export', async () => {
    const session = await prisma.chatSession.create({
      data: {
        courseId: pythonCourseId,
        studentId: student1.id,
        title: 'Unassigned Denied Session',
      },
    })

    await request(requireApp().getHttpServer())
      .get(
        `/api/v1/courses/${pythonCourseId}/chat-sessions/${session.id}/export`,
      )
      .set('Authorization', `Bearer ${unassignedStudentToken}`)
      .expect(403)
  })

  it('rejects export with 403 when instructor attempts to access student export', async () => {
    const session = await prisma.chatSession.create({
      data: {
        courseId: pythonCourseId,
        studentId: student1.id,
        title: 'Instructor Denied Session',
      },
    })

    await request(requireApp().getHttpServer())
      .get(
        `/api/v1/courses/${pythonCourseId}/chat-sessions/${session.id}/export`,
      )
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(403)
  })

  it('rejects export with 404 when student attempts to export another student session', async () => {
    const session = await prisma.chatSession.create({
      data: {
        courseId: pythonCourseId,
        studentId: student1.id,
        title: `Student 1 Session for ${student2.email}`,
      },
    })

    await request(requireApp().getHttpServer())
      .get(
        `/api/v1/courses/${pythonCourseId}/chat-sessions/${session.id}/export`,
      )
      .set('Authorization', `Bearer ${student2Token}`)
      .expect(404)
  })

  it('rejects export with 404 when session is soft deleted', async () => {
    const session = await prisma.chatSession.create({
      data: {
        courseId: pythonCourseId,
        studentId: student1.id,
        title: 'Deleted Session',
        deletedAt: new Date(),
      },
    })

    await request(requireApp().getHttpServer())
      .get(
        `/api/v1/courses/${pythonCourseId}/chat-sessions/${session.id}/export`,
      )
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(404)
  })

  it('allows export for student in archived course', async () => {
    const archiveTime = new Date('2026-08-16T12:00:00.000Z')
    const archivedCourse = await prisma.course.create({
      data: {
        code: 'CS999',
        title: 'Archived Python Course',
        universityId: seed.university.id,
        archivedAt: archiveTime,
      },
    })

    await prisma.courseMembership.create({
      data: {
        courseId: archivedCourse.id,
        userId: student1.id,
        role: CourseMembershipRole.STUDENT,
        removedAt: archiveTime,
      },
    })

    const session = await prisma.chatSession.create({
      data: {
        courseId: archivedCourse.id,
        studentId: student1.id,
        title: 'Archived Session History',
      },
    })

    await prisma.message.create({
      data: {
        sessionId: session.id,
        sequence: 1,
        role: MessageRole.STUDENT,
        content: 'Historical question',
        status: MessageStatus.COMPLETED,
        authorUserId: student1.id,
      },
    })

    const response = await request(requireApp().getHttpServer())
      .get(
        `/api/v1/courses/${archivedCourse.id}/chat-sessions/${session.id}/export`,
      )
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(200)

    expect(response.text).toContain('# Morshid Conversation Export')
    expect(response.text).toContain(
      '- **Course:** CS999 — Archived Python Course',
    )
    expect(response.text).toContain('Historical question')
  })
})
