import type { PrismaClient } from '../generated/prisma/client'

export const P0_REVIEW_READINESS_FIXTURE = {
  owned: {
    studentEmail: 'student1@morshid.demo',
    sessionId: '14000000-0000-4000-8000-000000000201',
    studentMessageId: '14000000-0000-4000-8000-000000000211',
    assistantMessageId: '14000000-0000-4000-8000-000000000221',
  },
  foreign: {
    studentEmail: 'student2@morshid.demo',
    sessionId: '14000000-0000-4000-8000-000000000202',
    studentMessageId: '14000000-0000-4000-8000-000000000212',
    assistantMessageId: '14000000-0000-4000-8000-000000000222',
  },
  completedAt: new Date('2026-08-01T08:00:00.000Z'),
} as const

export async function seedP0ReviewReadinessData(
  prisma: PrismaClient,
): Promise<void> {
  const course = await prisma.course.findUniqueOrThrow({
    where: { code: 'PYTHON-PROG-P0' },
    select: { id: true },
  })

  for (const fixture of [
    P0_REVIEW_READINESS_FIXTURE.owned,
    P0_REVIEW_READINESS_FIXTURE.foreign,
  ]) {
    const student = await prisma.user.findUniqueOrThrow({
      where: { email: fixture.studentEmail },
      select: { id: true },
    })
    await prisma.chatSession.upsert({
      where: { id: fixture.sessionId },
      update: {
        courseId: course.id,
        studentId: student.id,
        title: 'P0 manual review readiness',
        deletedAt: null,
        lastSequence: 2,
      },
      create: {
        id: fixture.sessionId,
        courseId: course.id,
        studentId: student.id,
        title: 'P0 manual review readiness',
        lastSequence: 2,
      },
    })
    await prisma.message.upsert({
      where: { id: fixture.studentMessageId },
      update: {
        sessionId: fixture.sessionId,
        sequence: 1,
        role: 'STUDENT',
        authorUserId: student.id,
        content: 'Explain this course concept.',
        status: 'COMPLETED',
        completedAt: P0_REVIEW_READINESS_FIXTURE.completedAt,
      },
      create: {
        id: fixture.studentMessageId,
        sessionId: fixture.sessionId,
        sequence: 1,
        role: 'STUDENT',
        authorUserId: student.id,
        content: 'Explain this course concept.',
        status: 'COMPLETED',
        completedAt: P0_REVIEW_READINESS_FIXTURE.completedAt,
      },
    })
    await prisma.message.upsert({
      where: { id: fixture.assistantMessageId },
      update: {
        sessionId: fixture.sessionId,
        sequence: 2,
        role: 'ASSISTANT',
        responseToMessageId: fixture.studentMessageId,
        content: 'A deterministic course-grounded explanation.',
        status: 'COMPLETED',
        completedAt: P0_REVIEW_READINESS_FIXTURE.completedAt,
      },
      create: {
        id: fixture.assistantMessageId,
        sessionId: fixture.sessionId,
        sequence: 2,
        role: 'ASSISTANT',
        responseToMessageId: fixture.studentMessageId,
        content: 'A deterministic course-grounded explanation.',
        status: 'COMPLETED',
        completedAt: P0_REVIEW_READINESS_FIXTURE.completedAt,
      },
    })
  }
}
