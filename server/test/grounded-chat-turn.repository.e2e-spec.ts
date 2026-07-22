import { randomUUID } from 'node:crypto'

import { Prisma } from '../src/generated/prisma/client'
import type { PrismaService } from '../src/modules/prisma/prisma.service'
import { PrismaStudentChatMessageRepository } from '../src/modules/student-chat/student-chat-message.repository'
import { StudentChatMessagePresenter } from '../src/modules/student-chat/student-chat-message.presenter'
import {
  GroundedChatEvidenceUnavailableError,
  PrismaGroundedChatTurnRepository,
} from '../src/modules/student-chat/grounded-chat-turn.repository'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

interface GroundedChatFixture {
  courseId: string
  sessionId: string
  studentId: string
}

interface EvidenceFixture {
  chunkId: string
  materialId: string
}

describe('Grounded chat turn repository (e2e)', () => {
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let repository: PrismaGroundedChatTurnRepository

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue88_turns')
    prisma = database.prisma
    repository = new PrismaGroundedChatTurnRepository(prisma)
  })

  afterAll(async () => {
    await database?.dispose()
  })

  it('creates one completed Student and one linked pending assistant atomically with consecutive sequences', async () => {
    const fixture = await createFixture(prisma)

    const result = await repository.beginTurn({
      ...fixture,
      content: 'How do Python lists work?',
    })

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') {
      return
    }
    expect(result.courseId).toBe(fixture.courseId)
    expect(result.studentMessage).toMatchObject({
      sequence: 1,
      role: 'STUDENT',
      status: 'COMPLETED',
      content: 'How do Python lists work?',
      requestKind: 'CONCEPTUAL',
      hintLevel: null,
    })
    expect(result.assistantMessage).toMatchObject({
      sequence: 2,
      role: 'ASSISTANT',
      status: 'PENDING',
      responseToMessageId: result.studentMessage.id,
      requestKind: 'CONCEPTUAL',
      hintLevel: null,
    })

    const session = await prisma.chatSession.findUniqueOrThrow({
      where: { id: fixture.sessionId },
      select: { lastSequence: true },
    })
    expect(session.lastSequence).toBe(2)
  })

  it('serializes concurrent sends so one is rejected without an orphan Student message', async () => {
    const fixture = await createFixture(prisma)

    const results = await Promise.all([
      repository.beginTurn({ ...fixture, content: 'First question' }),
      repository.beginTurn({ ...fixture, content: 'Second question' }),
    ])

    expect(results.map((result) => result.kind).sort()).toEqual([
      'ok',
      'turn_in_progress',
    ])
    await expect(
      prisma.message.count({ where: { sessionId: fixture.sessionId } }),
    ).resolves.toBe(2)
  })

  it('commits completion metadata, exact retrieval ranks, and deduplicated citation order together', async () => {
    const fixture = await createFixture(prisma)
    const first = await createEvidence(prisma, fixture, 'Lists', 0)
    const second = await createEvidence(prisma, fixture, 'Loops', 3)
    const third = await createChunk(prisma, first.materialId, 1)
    const turn = await repository.beginTurn({
      ...fixture,
      content: 'Explain list iteration',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }

    const completed = await repository.completeTurn({
      ...fixture,
      studentMessageId: turn.studentMessage.id,
      assistantMessageId: turn.assistantMessage.id,
      content: 'Grounded answer',
      provider: 'deterministic',
      model: 'deterministic-completion-v1',
      promptVersion: 'grounded-completion-v1',
      inputTokens: 12,
      outputTokens: 8,
      evidence: [
        evidence(first, 1, 0.95, 'Lists', 0, 'first excerpt'),
        evidence(second, 2, 0.9, 'Loops', 3, 'second excerpt'),
        evidence(
          { chunkId: third, materialId: first.materialId },
          3,
          0.85,
          'Lists',
          1,
          'third excerpt',
        ),
      ],
    })

    expect(completed.kind).toBe('ok')
    if (completed.kind !== 'ok') {
      return
    }
    expect(completed.message).toMatchObject({
      id: turn.assistantMessage.id,
      status: 'COMPLETED',
      content: 'Grounded answer',
      guidanceLabel: 'COURSE_GROUNDED',
    })

    const stored = await prisma.message.findUniqueOrThrow({
      where: { id: turn.assistantMessage.id },
      include: {
        retrievals: { orderBy: { rank: 'asc' } },
        citations: { orderBy: { citationOrder: 'asc' } },
      },
    })
    expect(stored).toMatchObject({
      provider: 'deterministic',
      model: 'deterministic-completion-v1',
      promptVersion: 'grounded-completion-v1',
      inputTokens: 12,
      outputTokens: 8,
    })
    expect(
      stored.retrievals.map(({ rank, chunkId }) => ({ rank, chunkId })),
    ).toEqual([
      { rank: 1, chunkId: first.chunkId },
      { rank: 2, chunkId: second.chunkId },
      { rank: 3, chunkId: third },
    ])
    expect(
      stored.citations.map(({ materialId, citationOrder }) => ({
        materialId,
        citationOrder,
      })),
    ).toEqual([
      { materialId: first.materialId, citationOrder: 1 },
      { materialId: second.materialId, citationOrder: 2 },
    ])
  })

  it('rolls back completed status and partial evidence when final evidence is no longer eligible', async () => {
    const fixture = await createFixture(prisma)
    const source = await createEvidence(prisma, fixture, 'Transient source', 0)
    const turn = await repository.beginTurn({
      ...fixture,
      content: 'Explain this source',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }
    await prisma.material.update({
      where: { id: source.materialId },
      data: { status: 'PROCESSING' },
    })

    await expect(
      repository.completeTurn({
        ...fixture,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: 'Must roll back',
        provider: 'deterministic',
        model: 'deterministic-completion-v1',
        promptVersion: 'grounded-completion-v1',
        evidence: [evidence(source, 1, 0.9, 'Transient source', 0, 'text')],
      }),
    ).rejects.toBeInstanceOf(GroundedChatEvidenceUnavailableError)

    await expect(
      prisma.message.findUniqueOrThrow({
        where: { id: turn.assistantMessage.id },
        select: { status: true, content: true },
      }),
    ).resolves.toEqual({ status: 'PENDING', content: '' })
    await expect(
      prisma.messageRetrieval.count({
        where: { messageId: turn.assistantMessage.id },
      }),
    ).resolves.toBe(0)
    await expect(
      prisma.messageCitation.count({
        where: { messageId: turn.assistantMessage.id },
      }),
    ).resolves.toBe(0)
  })

  it('rolls back the terminal transition when ranked evidence writes violate their atomic constraints', async () => {
    const fixture = await createFixture(prisma)
    const first = await createEvidence(prisma, fixture, 'First source', 0)
    const second = await createEvidence(prisma, fixture, 'Second source', 0)
    const turn = await repository.beginTurn({
      ...fixture,
      content: 'Trigger a ranked-write conflict',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }

    await expect(
      repository.completeTurn({
        ...fixture,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: 'Must roll back',
        provider: 'deterministic',
        model: 'deterministic-completion-v1',
        promptVersion: 'grounded-completion-v1',
        evidence: [
          evidence(first, 1, 0.95, 'First source', 0, 'first'),
          evidence(second, 1, 0.9, 'Second source', 0, 'second'),
        ],
      }),
    ).rejects.toThrow()

    await expect(
      prisma.message.findUniqueOrThrow({
        where: { id: turn.assistantMessage.id },
        select: { status: true, content: true },
      }),
    ).resolves.toEqual({ status: 'PENDING', content: '' })
    await expect(
      prisma.messageRetrieval.count({
        where: { messageId: turn.assistantMessage.id },
      }),
    ).resolves.toBe(0)
    await expect(
      prisma.messageCitation.count({
        where: { messageId: turn.assistantMessage.id },
      }),
    ).resolves.toBe(0)
  })

  it('retries a failed assistant by reusing both message ids and sequences', async () => {
    const fixture = await createFixture(prisma)
    const turn = await repository.beginTurn({
      ...fixture,
      content: 'Please retry this',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }
    const failed = await repository.failTurn({
      ...fixture,
      studentMessageId: turn.studentMessage.id,
      assistantMessageId: turn.assistantMessage.id,
      content: 'Safe failure',
      errorCode: 'GROUNDING_RESPONSE_FAILED',
    })
    expect(failed.kind).toBe('ok')

    const retried = await repository.retryTurn({
      ...fixture,
      studentMessageId: turn.studentMessage.id,
    })

    expect(retried.kind).toBe('ok')
    if (retried.kind !== 'ok') {
      return
    }
    expect(retried.studentMessage).toMatchObject({
      id: turn.studentMessage.id,
      sequence: 1,
    })
    expect(retried.assistantMessage).toMatchObject({
      id: turn.assistantMessage.id,
      sequence: 2,
      status: 'PENDING',
      content: '',
      completedAt: null,
      errorCode: null,
    })
    await expect(
      repository.retryTurn({
        ...fixture,
        studentMessageId: turn.studentMessage.id,
      }),
    ).resolves.toEqual({
      kind: 'retry_not_allowed',
      messageId: turn.studentMessage.id,
    })
    await expect(
      prisma.message.count({ where: { sessionId: fixture.sessionId } }),
    ).resolves.toBe(2)
  })

  it('reloads ordered evidence and exposes the unavailable form after chunk reprocessing', async () => {
    const fixture = await createFixture(prisma)
    const source = await createEvidence(prisma, fixture, 'Durable title', 0)
    const turn = await repository.beginTurn({
      ...fixture,
      content: 'Show durable provenance',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }
    const completed = await repository.completeTurn({
      ...fixture,
      studentMessageId: turn.studentMessage.id,
      assistantMessageId: turn.assistantMessage.id,
      content: 'Grounded response',
      provider: 'deterministic',
      model: 'deterministic-completion-v1',
      promptVersion: 'grounded-completion-v1',
      evidence: [
        evidence(source, 1, 0.9, 'Durable title', 0, 'durable excerpt'),
      ],
    })
    expect(completed.kind).toBe('ok')

    const messageRepository = new PrismaStudentChatMessageRepository(prisma)
    const presenter = new StudentChatMessagePresenter({
      exists: jest.fn().mockResolvedValue(true),
    } as never)
    const before = await messageRepository.listMessages(
      fixture.courseId,
      fixture.sessionId,
      fixture.studentId,
      { limit: 10 },
    )
    if (before === null) {
      throw new Error('Expected history to be readable')
    }
    const presentedBefore = await presenter.presentMany(before)
    expect(presentedBefore[1].citations).toEqual([
      expect.objectContaining({
        materialTitle: 'Durable title',
        sourceAvailable: true,
        evidence: [
          expect.objectContaining({
            rank: 1,
            chunkId: source.chunkId,
            chunkNumber: 1,
          }),
        ],
      }),
    ])

    await prisma.materialChunk.delete({ where: { id: source.chunkId } })
    const after = await messageRepository.listMessages(
      fixture.courseId,
      fixture.sessionId,
      fixture.studentId,
      { limit: 10 },
    )
    if (after === null) {
      throw new Error('Expected history to remain readable')
    }
    const presentedAfter = await presenter.presentMany(after)
    expect(presentedAfter[1].citations).toEqual([
      {
        order: 1,
        materialId: source.materialId,
        materialTitle: 'Durable title',
        sourceAvailable: false,
        evidence: [],
      },
    ])
  })
})

async function createFixture(
  prisma: PrismaService,
): Promise<GroundedChatFixture> {
  const student = await prisma.user.create({
    data: {
      email: `issue88-${randomUUID()}@morshid.test`,
      displayName: 'Issue 88 student',
      role: 'STUDENT',
      passwordHash: 'test-password-hash',
    },
  })
  const course = await prisma.course.create({
    data: {
      code: `I88-${randomUUID().slice(0, 24)}`,
      title: 'Issue 88 course',
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
      title: 'Grounded chat',
    },
  })

  return {
    courseId: course.id,
    sessionId: session.id,
    studentId: student.id,
  }
}

async function createEvidence(
  prisma: PrismaService,
  fixture: GroundedChatFixture,
  title: string,
  chunkIndex: number,
): Promise<EvidenceFixture> {
  const material = await prisma.material.create({
    data: {
      courseId: fixture.courseId,
      uploadedById: fixture.studentId,
      title,
      originalFilename: `${title}.pdf`,
      storagePath: `${randomUUID()}.pdf`,
      status: 'READY',
      extractedTextLength: 100,
      chunkCount: 2,
    },
  })
  const chunkId = await createChunk(prisma, material.id, chunkIndex)

  return { chunkId, materialId: material.id }
}

async function createChunk(
  prisma: PrismaService,
  materialId: string,
  chunkIndex: number,
): Promise<string> {
  const chunkId = randomUUID()
  const embedding = `[${new Array<number>(1_536).fill(0).join(',')}]`
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO material_chunks (
      id,
      material_id,
      chunk_index,
      content,
      embedding,
      embedding_model
    )
    VALUES (
      ${chunkId}::uuid,
      ${materialId}::uuid,
      ${chunkIndex},
      ${`Chunk ${String(chunkIndex)} content`},
      ${embedding}::vector(1536),
      'issue-88-test-embedding'
    )
  `)

  return chunkId
}

function evidence(
  source: EvidenceFixture,
  rank: number,
  similarityScore: number,
  materialTitle: string,
  chunkIndex: number,
  content: string,
) {
  return {
    ...source,
    rank,
    similarityScore,
    materialTitle,
    chunkIndex,
    content,
  }
}
