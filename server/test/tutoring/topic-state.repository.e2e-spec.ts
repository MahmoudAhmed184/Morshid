import { randomUUID } from 'node:crypto'

import type { PrismaService } from '../../src/platform/database/prisma.service'
import {
  PrismaTopicStateRepository,
  type TopicStateRepository,
} from '../../src/modules/tutoring/socratic-workflow/topic/topic-state.repository'
import { TopicStateService } from '../../src/modules/tutoring/socratic-workflow/topic/topic-state.service'
import type { TopicStateSnapshot } from '../../src/modules/tutoring/socratic-workflow/topic/topic-state.types'
import { TOPIC_STATE_ERROR_CODES } from '../../src/modules/tutoring/socratic-workflow/topic/topic-state.errors'
import {
  LearningStatus,
  MessageRequestKind,
  ResolutionEvidenceStrength,
  StudentState,
} from '../../src/generated/prisma/client'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from '../support/disposable-database'

interface ChatFixture {
  courseId: string
  studentId: string
  sessionId: string
}

describe('TopicStateService persistence (e2e)', () => {
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let repository: TopicStateRepository
  let service: TopicStateService

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue163')
    prisma = database.prisma
    repository = new PrismaTopicStateRepository(prisma)
    service = new TopicStateService(repository)
  })

  afterAll(async () => {
    await database?.dispose()
  })

  it('recovers a concurrent getOrCreate race with one persisted row', async () => {
    const fixture = await createChatFixture(prisma)
    const topic = await createTopic(prisma, fixture)
    const racingService = new TopicStateService(
      new FirstMissingReadBarrierTopicStateRepository(prisma, topic.id, 2),
    )

    const [first, second] = await Promise.all([
      racingService.getOrCreate(topic.id),
      racingService.getOrCreate(topic.id),
    ])

    expect(first).toEqual(second)
    expect(first).toMatchObject({
      topicId: topic.id,
      version: 1,
      guidanceLevel: 1,
      attemptCount: 0,
      meaningfulAttemptCount: 0,
      studentState: StudentState.UNKNOWN,
      learningStatus: LearningStatus.UNKNOWN,
      resolutionEvidenceStrength: ResolutionEvidenceStrength.NONE,
    })
    await expect(
      prisma.topicState.count({ where: { topicId: topic.id } }),
    ).resolves.toBe(1)
  })

  it('allows one concurrent applyTransition winner and rejects the stale loser', async () => {
    const fixture = await createChatFixture(prisma)
    const topic = await createTopic(prisma, fixture)
    await service.getOrCreate(topic.id)

    const firstPatch = {
      guidanceLevel: 2,
      requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
      summary: 'first update won',
    }
    const secondPatch = {
      attemptCount: 4,
      studentState: StudentState.PARTIAL_UNDERSTANDING,
      summary: 'second update won',
    }

    const results = await Promise.allSettled([
      service.applyTransition(topic.id, 1, firstPatch),
      service.applyTransition(topic.id, 1, secondPatch),
    ])
    const fulfilled = results.filter(isFulfilled)
    const rejected = results.filter(isRejected)

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0].reason).toHaveProperty(
      'response.code',
      TOPIC_STATE_ERROR_CODES.STALE_VERSION,
    )
    expect(fulfilled[0].value.version).toBe(2)

    const persisted = await prisma.topicState.findUniqueOrThrow({
      where: { topicId: topic.id },
      select: {
        version: true,
        guidanceLevel: true,
        requestKind: true,
        attemptCount: true,
        studentState: true,
        summary: true,
      },
    })

    expect(persisted.version).toBe(2)
    expect(persisted.summary).toBe(fulfilled[0].value.summary)

    if (persisted.summary === firstPatch.summary) {
      expect(persisted).toMatchObject({
        guidanceLevel: firstPatch.guidanceLevel,
        requestKind: firstPatch.requestKind,
        attemptCount: 0,
        studentState: StudentState.UNKNOWN,
      })
    } else {
      expect(persisted).toMatchObject({
        guidanceLevel: 1,
        requestKind: null,
        attemptCount: secondPatch.attemptCount,
        studentState: secondPatch.studentState,
      })
    }
  })

  it('updates updatedAt on success and preserves it on stale rejection', async () => {
    const fixture = await createChatFixture(prisma)
    const topic = await createTopic(prisma, fixture)
    const initial = await service.getOrCreate(topic.id)
    await delay(10)

    const updated = await service.applyTransition(topic.id, initial.version, {
      guidanceLevel: 2,
    })

    const persistedAfterSuccess = await prisma.topicState.findUniqueOrThrow({
      where: { topicId: topic.id },
      select: {
        version: true,
        guidanceLevel: true,
        updatedAt: true,
      },
    })

    expect(updated.version).toBe(initial.version + 1)
    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      initial.updatedAt.getTime(),
    )
    expect(persistedAfterSuccess).toEqual({
      version: updated.version,
      guidanceLevel: 2,
      updatedAt: updated.updatedAt,
    })

    await expect(
      service.applyTransition(topic.id, initial.version, {
        guidanceLevel: 3,
      }),
    ).rejects.toHaveProperty(
      'response.code',
      TOPIC_STATE_ERROR_CODES.STALE_VERSION,
    )

    const persistedAfterStale = await prisma.topicState.findUniqueOrThrow({
      where: { topicId: topic.id },
      select: {
        version: true,
        guidanceLevel: true,
        updatedAt: true,
      },
    })

    expect(persistedAfterStale).toEqual(persistedAfterSuccess)
  })

  it('rejects an empty patch without incrementing version or updatedAt', async () => {
    const fixture = await createChatFixture(prisma)
    const topic = await createTopic(prisma, fixture)
    const initial = await service.getOrCreate(topic.id)

    await expect(
      service.applyTransition(topic.id, initial.version, {}),
    ).rejects.toHaveProperty(
      'response.code',
      TOPIC_STATE_ERROR_CODES.INVALID_REQUEST,
    )

    const persisted = await prisma.topicState.findUniqueOrThrow({
      where: { topicId: topic.id },
      select: {
        version: true,
        guidanceLevel: true,
        updatedAt: true,
      },
    })

    expect(persisted).toEqual({
      version: initial.version,
      guidanceLevel: initial.guidanceLevel,
      updatedAt: initial.updatedAt,
    })
  })

  it('keeps TopicState defaults and database constraints effective', async () => {
    const fixture = await createChatFixture(prisma)
    const topic = await createTopic(prisma, fixture)

    await expect(service.getOrCreate(topic.id)).resolves.toMatchObject({
      version: 1,
      guidanceLevel: 1,
      attemptCount: 0,
      meaningfulAttemptCount: 0,
      studentState: StudentState.UNKNOWN,
      learningStatus: LearningStatus.UNKNOWN,
      resolutionEvidenceStrength: ResolutionEvidenceStrength.NONE,
    })

    const lowGuidanceTopic = await createTopic(prisma, fixture)
    await expect(
      prisma.topicState.create({
        data: {
          topicId: lowGuidanceTopic.id,
          guidanceLevel: 0,
        },
      }),
    ).rejects.toThrow()

    const lowVersionTopic = await createTopic(prisma, fixture)
    await expect(
      prisma.topicState.create({
        data: {
          topicId: lowVersionTopic.id,
          version: 0,
        },
      }),
    ).rejects.toThrow()
  })
})

class FirstMissingReadBarrierTopicStateRepository extends PrismaTopicStateRepository {
  private readonly barrier: Promise<void>
  private releaseBarrier: (() => void) | undefined
  private missingReadCount = 0

  constructor(
    prisma: PrismaService,
    private readonly targetTopicId: string,
    private readonly expectedMissingReads: number,
  ) {
    super(prisma)
    this.barrier = new Promise((resolve) => {
      this.releaseBarrier = resolve
    })
  }

  override async findByTopicId(
    topicId: string,
  ): Promise<TopicStateSnapshot | null> {
    const state = await super.findByTopicId(topicId)

    if (
      topicId !== this.targetTopicId ||
      state !== null ||
      this.missingReadCount >= this.expectedMissingReads
    ) {
      return state
    }

    this.missingReadCount += 1
    if (this.missingReadCount === this.expectedMissingReads) {
      this.releaseBarrier?.()
    }
    await this.barrier

    return state
  }
}

async function createChatFixture(prisma: PrismaService): Promise<ChatFixture> {
  const university = await prisma.university.upsert({
    where: { code: 'TEST-TOPIC-STATE-UNIV' },
    update: {},
    create: {
      name: 'Test Topic State University',
      code: 'TEST-TOPIC-STATE-UNIV',
      status: 'ACTIVE',
    },
  })
  const student = await prisma.user.create({
    data: {
      email: `issue163-${randomUUID()}@morshid.test`,
      displayName: 'Issue 163 student',
      role: 'STUDENT',
      universityId: university.id,
      passwordHash: 'test-password-hash',
    },
  })
  const course = await prisma.course.create({
    data: {
      code: `I163-${randomUUID().slice(0, 24)}`,
      title: 'Issue 163 test course',
      universityId: university.id,
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
      title: 'Topic state persistence',
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

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}
