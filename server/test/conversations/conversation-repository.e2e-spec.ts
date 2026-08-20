import { randomUUID } from 'node:crypto'

import { AuditService } from '../../src/modules/audit/audit.service'
import type { PrismaService } from '../../src/platform/database/prisma.service'
import { ConversationAuditService } from '../../src/modules/conversations/conversation-audit.service'
import {
  PrismaConversationSessionRepository,
  type ConversationSessionRepository,
} from '../../src/modules/conversations/conversation-session.repository'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from '../support/disposable-database'

interface EnrolledStudent {
  courseId: string
  studentId: string
}

describe('Student chat repositories (e2e)', () => {
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let sessionRepository: ConversationSessionRepository
  let testUniversityId: string

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue84')
    prisma = database.prisma

    const university = await prisma.university.create({
      data: {
        name: 'Issue 84 Test University',
        code: `I84-${randomUUID().slice(0, 8)}`,
        status: 'ACTIVE',
      },
    })
    testUniversityId = university.id

    const conversationAuditService = new ConversationAuditService(
      new AuditService(prisma),
    )
    sessionRepository = new PrismaConversationSessionRepository(
      prisma,
      conversationAuditService,
    )
  })

  afterAll(async () => {
    await database?.dispose()
  })

  async function createEnrolledStudent(): Promise<EnrolledStudent> {
    const student = await prisma.user.create({
      data: {
        email: `issue84-${randomUUID()}@morshid.test`,
        displayName: 'Issue 84 student',
        role: 'STUDENT',
        universityId: testUniversityId,
        passwordHash: 'test-password-hash',
      },
    })
    const course = await prisma.course.create({
      data: {
        code: `I84-${randomUUID().slice(0, 24)}`,
        title: 'Issue 84 test course',
        universityId: testUniversityId,
        createdById: student.id,
      },
    })
    await prisma.courseMembership.create({
      data: {
        courseId: course.id,
        userId: student.id,
        role: 'STUDENT',
        createdById: student.id,
      },
    })

    return { courseId: course.id, studentId: student.id }
  }

  it('enforces one assistant response per student message', async () => {
    const { courseId, studentId } = await createEnrolledStudent()
    const session = await sessionRepository.createSession(
      courseId,
      studentId,
      'Response identity',
    )
    if (session === null) {
      throw new Error('Expected the session to be created')
    }

    const studentMessage = await prisma.message.create({
      data: {
        sessionId: session.id,
        sequence: 1,
        role: 'STUDENT',
        authorUserId: studentId,
        content: 'What is a Python list?',
        status: 'COMPLETED',
      },
    })
    await prisma.message.create({
      data: {
        sessionId: session.id,
        sequence: 2,
        role: 'ASSISTANT',
        responseToMessageId: studentMessage.id,
        content: '',
        status: 'PENDING',
      },
    })

    await expect(
      prisma.message.create({
        data: {
          sessionId: session.id,
          sequence: 3,
          role: 'ASSISTANT',
          responseToMessageId: studentMessage.id,
          content: '',
          status: 'PENDING',
        },
      }),
    ).rejects.toThrow()
  })

  it('keeps the chat-session FK satisfied when a membership is soft-removed and reactivated (H1)', async () => {
    const { courseId, studentId } = await createEnrolledStudent()
    const session = await sessionRepository.createSession(
      courseId,
      studentId,
      'Soft removal',
    )
    if (session === null) {
      throw new Error('Expected the session to be created')
    }
    const sessionId = session.id

    await expect(
      sessionRepository.hasActiveStudentMembership(courseId, studentId),
    ).resolves.toBe(true)

    // Soft-remove the membership (what admin removal now does): the row stays,
    // so the composite chat_sessions(course_id, student_id) FK is still valid.
    await prisma.courseMembership.update({
      where: { courseId_userId: { courseId, userId: studentId } },
      data: { removedAt: new Date() },
    })

    await expect(
      sessionRepository.hasActiveStudentMembership(courseId, studentId),
    ).resolves.toBe(false)
    // The session is not orphaned and writes are denied while removed.
    await expect(
      prisma.chatSession.findUnique({ where: { id: sessionId } }),
    ).resolves.not.toBeNull()
    await expect(
      sessionRepository.findOwnedActiveSession(courseId, sessionId, studentId),
    ).resolves.toBeNull()

    // A hard delete, by contrast, is blocked by the FK while a session exists —
    // which is why removal must be soft.
    await expect(
      prisma.courseMembership.delete({
        where: { courseId_userId: { courseId, userId: studentId } },
      }),
    ).rejects.toThrow()

    // Re-adding the member reactivates access (removedAt cleared).
    await prisma.courseMembership.update({
      where: { courseId_userId: { courseId, userId: studentId } },
      data: { removedAt: null },
    })
    await expect(
      sessionRepository.hasActiveStudentMembership(courseId, studentId),
    ).resolves.toBe(true)
    await expect(
      sessionRepository.findOwnedActiveSession(courseId, sessionId, studentId),
    ).resolves.not.toBeNull()
  })

  it('records a deny-path audit for an unknown course without violating the course FK (H2)', async () => {
    const { studentId } = await createEnrolledStudent()
    const conversationAuditService = new ConversationAuditService(
      new AuditService(prisma),
    )
    const unknownCourseId = randomUUID()

    // A raw course id that does not exist must never reach the audit_logs
    // course_id FK column directly.
    await expect(
      prisma.auditLog.create({
        data: {
          actorUserId: studentId,
          action: 'chat.session_access_denied',
          targetType: 'chat_session',
          courseId: unknownCourseId,
          metadata: {},
        },
      }),
    ).rejects.toThrow()

    // The FK-safe path keeps the unverified id in JSONB metadata and leaves the
    // FK column null, so the audit event is preserved and no 500 is produced.
    await expect(
      conversationAuditService.recordAccessDenied({
        actorUserId: studentId,
        courseId: null,
        unverifiedCourseId: unknownCourseId,
        reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
      }),
    ).resolves.toBeUndefined()

    const denials = await prisma.auditLog.findMany({
      where: {
        actorUserId: studentId,
        action: 'chat.session_access_denied',
        courseId: null,
      },
    })
    expect(denials).toHaveLength(1)
    expect(denials[0].courseId).toBeNull()
    expect(denials[0].metadata).toMatchObject({
      reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
      unverifiedCourseId: unknownCourseId,
    })
  })
})
