import { randomUUID } from 'node:crypto'

import type { PrismaService } from '../src/modules/prisma/prisma.service'
import { TOPIC_STATE_ERROR_CODES } from '../src/modules/socratic-tutor/topic-state.errors'
import {
  PrismaTopicStateRepository,
  type TopicStateRepository,
} from '../src/modules/socratic-tutor/topic-state.repository'
import { TopicStateService } from '../src/modules/socratic-tutor/topic-state.service'
import { TURN_ERROR_CODES } from '../src/modules/socratic-tutor/turn.errors'
import {
  PrismaTurnRepository,
  type TurnRepository,
} from '../src/modules/socratic-tutor/turn.repository'
import { TurnService } from '../src/modules/socratic-tutor/turn.service'
import { TURN_ACQUISITION_OUTCOME } from '../src/modules/socratic-tutor/turn.types'
import {
  TutorTurnFailureCode,
  TutorTurnStatus,
} from '../src/generated/prisma/client'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

interface ChatFixture {
  courseId: string
  studentId: string
  sessionId: string
}

describe('TurnService persistence (e2e)', () => {
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let repository: TurnRepository
  let service: TurnService

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue165')
    prisma = database.prisma
    repository = new PrismaTurnRepository(prisma)
    service = new TurnService(repository)
  })

  afterAll(async () => {
    await database?.dispose()
  })

  it('recovers concurrent acquisition with one created row and one processing result', async () => {
    const fixture = await createChatFixture(prisma)
    const idempotencyKey = `same-${randomUUID()}`

    const [first, second] = await Promise.all([
      service.getOrCreate(fixture.sessionId, idempotencyKey),
      service.getOrCreate(fixture.sessionId, idempotencyKey),
    ])

    expect([first.outcome, second.outcome].sort()).toEqual([
      TURN_ACQUISITION_OUTCOME.ALREADY_PROCESSING,
      TURN_ACQUISITION_OUTCOME.CREATED,
    ])
    expect(
      [first, second].find(
        (result) =>
          result.outcome === TURN_ACQUISITION_OUTCOME.ALREADY_PROCESSING,
      ),
    ).toMatchObject({
      code: TURN_ERROR_CODES.ALREADY_PROCESSING,
    })
    expect(first.turn.id).toBe(second.turn.id)
    await expect(
      prisma.tutorTurn.count({
        where: {
          sessionId: fixture.sessionId,
          idempotencyKey,
        },
      }),
    ).resolves.toBe(1)
  })

  it('creates separate turns for distinct idempotency scopes', async () => {
    const fixture = await createChatFixture(prisma)
    const otherFixture = await createChatFixture(prisma)
    const sharedKey = `shared-${randomUUID()}`

    const first = await service.getOrCreate(fixture.sessionId, sharedKey)
    const second = await service.getOrCreate(
      fixture.sessionId,
      `other-${randomUUID()}`,
    )
    const third = await service.getOrCreate(otherFixture.sessionId, sharedKey)

    expect(new Set([first.turn.id, second.turn.id, third.turn.id]).size).toBe(3)
    await expect(
      prisma.tutorTurn.count({
        where: {
          id: {
            in: [first.turn.id, second.turn.id, third.turn.id],
          },
        },
      }),
    ).resolves.toBe(3)
  })

  it('allows one concurrent transition winner and reports the stale loser', async () => {
    const fixture = await createChatFixture(prisma)
    const turn = await createTurn(prisma, fixture, {
      status: TutorTurnStatus.ANALYZING,
    })

    const results = await Promise.allSettled([
      service.transitionStatus(
        turn.id,
        TutorTurnStatus.ANALYZING,
        TutorTurnStatus.RETRIEVING,
      ),
      service.transitionStatus(
        turn.id,
        TutorTurnStatus.ANALYZING,
        TutorTurnStatus.DECIDING,
      ),
    ])
    const fulfilled = results.filter(isFulfilled)
    const rejected = results.filter(isRejected)

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0].reason).toHaveProperty(
      'response.code',
      TURN_ERROR_CODES.STALE_STATUS,
    )

    const persisted = await prisma.tutorTurn.findUniqueOrThrow({
      where: { id: turn.id },
      select: { status: true, failureCode: true, completedAt: true },
    })

    expect(persisted).toEqual({
      status: fulfilled[0].value.status,
      failureCode: null,
      completedAt: null,
    })
  })

  it('prevents two expected-state lifecycle operations from both mutating', async () => {
    const fixture = await createChatFixture(prisma)
    const turn = await createTurn(prisma, fixture, {
      status: TutorTurnStatus.GENERATING,
    })

    const results = await Promise.allSettled([
      service.markFailed(
        turn.id,
        TutorTurnStatus.GENERATING,
        TutorTurnFailureCode.GENERATION_FAILED,
      ),
      service.transitionStatus(
        turn.id,
        TutorTurnStatus.GENERATING,
        TutorTurnStatus.VALIDATING,
      ),
    ])
    const fulfilled = results.filter(isFulfilled)
    const rejected = results.filter(isRejected)

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)

    const persisted = await prisma.tutorTurn.findUniqueOrThrow({
      where: { id: turn.id },
      select: { status: true, failureCode: true, completedAt: true },
    })

    expect(persisted.status).toBe(fulfilled[0].value.status)
    if (persisted.status === TutorTurnStatus.FAILED) {
      expect(persisted.failureCode).toBe(TutorTurnFailureCode.GENERATION_FAILED)
      expect(persisted.completedAt).not.toBeNull()
    } else {
      expect(persisted).toEqual({
        status: TutorTurnStatus.VALIDATING,
        failureCode: null,
        completedAt: null,
      })
    }
  })

  it('enforces terminal guardrails', async () => {
    const fixture = await createChatFixture(prisma)
    const completed = await createTurn(prisma, fixture, {
      status: TutorTurnStatus.COMPLETED,
      completedAt: new Date(),
    })
    const failed = await createTurn(prisma, fixture, {
      status: TutorTurnStatus.FAILED,
      failureCode: TutorTurnFailureCode.RETRIEVAL_FAILED,
      completedAt: new Date(),
    })

    await expect(
      service.transitionStatus(
        completed.id,
        TutorTurnStatus.COMPLETED,
        TutorTurnStatus.ANALYZING,
      ),
    ).rejects.toHaveProperty(
      'response.code',
      TURN_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION,
    )
    await expect(
      service.markFailed(
        failed.id,
        TutorTurnStatus.FAILED,
        TutorTurnFailureCode.PERSISTENCE_FAILED,
      ),
    ).rejects.toHaveProperty(
      'response.code',
      TURN_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION,
    )
  })

  it('keeps existing Task 1.1 and TopicState constraints effective', async () => {
    const fixture = await createChatFixture(prisma)
    const idempotencyKey = `constraint-${randomUUID()}`
    await createTurn(prisma, fixture, { idempotencyKey })

    await expect(
      prisma.tutorTurn.create({
        data: {
          sessionId: fixture.sessionId,
          idempotencyKey,
        },
      }),
    ).rejects.toThrow()

    const { approvedTutorMessageId } = await createStudentAndAssistantMessages(
      prisma,
      fixture,
    )
    await createTurn(prisma, fixture, {
      idempotencyKey: `approved-${randomUUID()}`,
      approvedTutorMessageId,
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

    const topic = await createTopic(prisma, fixture)
    const topicStateRepository: TopicStateRepository =
      new PrismaTopicStateRepository(prisma)
    const topicStateService = new TopicStateService(topicStateRepository)
    await topicStateService.getOrCreate(topic.id)

    await expect(
      topicStateService.applyTransition(topic.id, 1, {
        guidanceLevel: 2,
      }),
    ).resolves.toMatchObject({ version: 2, guidanceLevel: 2 })
    await expect(
      topicStateService.applyTransition(topic.id, 1, {
        guidanceLevel: 3,
      }),
    ).rejects.toHaveProperty(
      'response.code',
      TOPIC_STATE_ERROR_CODES.STALE_VERSION,
    )
  })
})

async function createChatFixture(prisma: PrismaService): Promise<ChatFixture> {
  const student = await prisma.user.create({
    data: {
      email: `issue165-${randomUUID()}@morshid.test`,
      displayName: 'Issue 165 student',
      role: 'STUDENT',
      passwordHash: 'test-password-hash',
    },
  })
  const course = await prisma.course.create({
    data: {
      code: `I165-${randomUUID().slice(0, 24)}`,
      title: 'Issue 165 test course',
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
      title: 'Turn service persistence',
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

async function createTurn(
  prisma: PrismaService,
  fixture: ChatFixture,
  input: {
    idempotencyKey?: string
    status?: TutorTurnStatus
    failureCode?: TutorTurnFailureCode | null
    approvedTutorMessageId?: string
    completedAt?: Date | null
  } = {},
): Promise<{ id: string }> {
  return prisma.tutorTurn.create({
    data: {
      sessionId: fixture.sessionId,
      idempotencyKey: input.idempotencyKey ?? `turn-${randomUUID()}`,
      status: input.status,
      failureCode: input.failureCode,
      approvedTutorMessageId: input.approvedTutorMessageId,
      completedAt: input.completedAt,
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
  const sequenceBase = Math.floor(Math.random() * 100_000) + 1
  const studentMessage = await prisma.message.create({
    data: {
      sessionId: fixture.sessionId,
      sequence: sequenceBase,
      role: 'STUDENT',
      authorUserId: fixture.studentId,
      content: 'How should I reason about this loop?',
      status: 'COMPLETED',
    },
  })
  const assistantMessage = await prisma.message.create({
    data: {
      sessionId: fixture.sessionId,
      sequence: sequenceBase + 1,
      role: 'ASSISTANT',
      responseToMessageId: studentMessage.id,
      content: 'What changes after one iteration?',
      status: 'COMPLETED',
    },
  })

  return {
    approvedTutorMessageId: assistantMessage.id,
  }
}

function isFulfilled<T>(
  result: PromiseSettledResult<T>,
): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled'
}

function isRejected(
  result: PromiseSettledResult<unknown>,
): result is PromiseRejectedResult {
  return result.status === 'rejected'
}
