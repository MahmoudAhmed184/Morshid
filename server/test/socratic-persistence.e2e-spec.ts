import { randomUUID } from 'node:crypto'

import type { PrismaService } from '../src/modules/prisma/prisma.service'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

interface ChatFixture {
  courseId: string
  studentId: string
  sessionId: string
}

describe('Socratic persistence schema (e2e)', () => {
  let database: DisposableDatabase | undefined
  let prisma: PrismaService

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue159')
    prisma = database.prisma
  })

  afterAll(async () => {
    await database?.dispose()
  })

  it('stores default Topic, TopicState, and nullable received TutorTurn fields', async () => {
    const fixture = await createChatFixture(prisma)
    const topic = await prisma.topic.create({
      data: {
        sessionId: fixture.sessionId,
        courseId: fixture.courseId,
        title: 'Loop invariants',
      },
    })
    const state = await prisma.topicState.create({
      data: {
        topicId: topic.id,
      },
    })
    const firstTurn = await prisma.tutorTurn.create({
      data: {
        sessionId: fixture.sessionId,
        idempotencyKey: `turn-${randomUUID()}`,
      },
    })
    const secondTurn = await prisma.tutorTurn.create({
      data: {
        sessionId: fixture.sessionId,
        idempotencyKey: `turn-${randomUUID()}`,
      },
    })

    expect(topic.status).toBe('ACTIVE')
    expect(topic.topicType).toBe('UNCLASSIFIED')
    expect(state.version).toBe(1)
    expect(state.guidanceLevel).toBe(1)
    expect(state.attemptCount).toBe(0)
    expect(state.meaningfulAttemptCount).toBe(0)
    expect(state.learningStatus).toBe('UNKNOWN')
    expect(state.resolutionEvidenceStrength).toBe('NONE')
    expect(firstTurn.status).toBe('RECEIVED')
    expect(firstTurn.safeFallbackUsed).toBe(false)
    expect(firstTurn.topicId).toBeNull()
    expect(firstTurn.studentMessageId).toBeNull()
    expect(firstTurn.approvedTutorMessageId).toBeNull()
    expect(secondTurn.approvedTutorMessageId).toBeNull()
  })

  it('enforces TopicState uniqueness and bounded numeric state fields', async () => {
    const fixture = await createChatFixture(prisma)
    const firstTopic = await createTopic(prisma, fixture)
    await prisma.topicState.create({ data: { topicId: firstTopic.id } })

    await expect(
      prisma.topicState.create({ data: { topicId: firstTopic.id } }),
    ).rejects.toThrow()

    const secondTopic = await createTopic(prisma, fixture)
    await expect(
      prisma.topicState.create({
        data: {
          topicId: secondTopic.id,
          guidanceLevel: 0,
        },
      }),
    ).rejects.toThrow()

    const thirdTopic = await createTopic(prisma, fixture)
    await expect(
      prisma.topicState.create({
        data: {
          topicId: thirdTopic.id,
          version: 0,
        },
      }),
    ).rejects.toThrow()
  })

  it('enforces TutorTurn idempotency and approved-response identity', async () => {
    const fixture = await createChatFixture(prisma)
    await prisma.tutorTurn.create({
      data: {
        sessionId: fixture.sessionId,
        idempotencyKey: 'same-key',
      },
    })

    await expect(
      prisma.tutorTurn.create({
        data: {
          sessionId: fixture.sessionId,
          idempotencyKey: 'same-key',
        },
      }),
    ).rejects.toThrow()

    const { approvedTutorMessageId } = await createStudentAndAssistantMessages(
      prisma,
      fixture,
    )
    await prisma.tutorTurn.create({
      data: {
        sessionId: fixture.sessionId,
        idempotencyKey: `approved-${randomUUID()}`,
        approvedTutorMessageId,
      },
    })
    await expect(
      prisma.tutorTurn.create({
        data: {
          sessionId: fixture.sessionId,
          idempotencyKey: `approved-${randomUUID()}`,
          approvedTutorMessageId,
        },
      }),
    ).rejects.toThrow()
  })
})

async function createChatFixture(prisma: PrismaService): Promise<ChatFixture> {
  const student = await prisma.user.create({
    data: {
      email: `issue159-${randomUUID()}@morshid.test`,
      displayName: 'Issue 159 student',
      role: 'STUDENT',
      passwordHash: 'test-password-hash',
    },
  })
  const course = await prisma.course.create({
    data: {
      code: `I159-${randomUUID().slice(0, 24)}`,
      title: 'Issue 159 test course',
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
  const session = await prisma.chatSession.create({
    data: {
      courseId: course.id,
      studentId: student.id,
      title: 'Socratic schema',
    },
  })

  return {
    courseId: course.id,
    studentId: student.id,
    sessionId: session.id,
  }
}

async function createTopic(
  prisma: PrismaService,
  fixture: ChatFixture,
): Promise<{ id: string }> {
  return prisma.topic.create({
    data: {
      sessionId: fixture.sessionId,
      courseId: fixture.courseId,
      title: `Topic ${randomUUID()}`,
    },
    select: {
      id: true,
    },
  })
}

async function createStudentAndAssistantMessages(
  prisma: PrismaService,
  fixture: ChatFixture,
): Promise<{ approvedTutorMessageId: string }> {
  const studentMessage = await prisma.message.create({
    data: {
      sessionId: fixture.sessionId,
      sequence: 1,
      role: 'STUDENT',
      authorUserId: fixture.studentId,
      content: 'How do I trace this loop?',
      status: 'COMPLETED',
    },
  })
  const assistantMessage = await prisma.message.create({
    data: {
      sessionId: fixture.sessionId,
      sequence: 2,
      role: 'ASSISTANT',
      responseToMessageId: studentMessage.id,
      content: 'What changes after the first iteration?',
      status: 'COMPLETED',
    },
  })

  return {
    approvedTutorMessageId: assistantMessage.id,
  }
}
