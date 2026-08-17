import { randomUUID } from 'node:crypto'

import { Client } from 'pg'

import { Prisma } from '../../src/generated/prisma/client'
import { PrismaConversationTurns } from '../../src/modules/conversations/prisma-conversation-turns'
import { AuditService } from '../../src/modules/audit/audit.service'
import { PrismaReviewCaseIntake } from '../../src/modules/reviews/intake/prisma-review-case-intake'
import { PrismaReviewCaseRepository } from '../../src/modules/reviews/intake/review-case.repository'
import { PrismaActiveCourseMembership } from '../../src/modules/courses/active-course-membership'
import type { PrismaService } from '../../src/platform/database/prisma.service'
import { PrismaConversationMessageRepository } from '../../src/modules/conversations/conversation-message.repository'
import { ApplicationConversationMessagePresenter } from '../../src/application/conversation-message.presenter'
import { PrismaStudentCitationSources } from '../../src/modules/materials/evidence/student-citation-sources'
import { PrismaStudentReviewSummaries } from '../../src/modules/reviews/student-detail/prisma-student-review-summaries'
import {
  TutoringEvidenceUnavailableError,
  PrismaTutoringTurnRepository,
} from '../../src/modules/tutoring/attempt/tutoring-turn.repository'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from '../support/disposable-database'

interface TutoringFixture {
  courseId: string
  sessionId: string
  studentId: string
}

interface EvidenceFixture {
  chunkId: string
  materialId: string
}

describe('Tutoring turn repository (e2e)', () => {
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let repository: PrismaTutoringTurnRepository
  let conversationTurns: PrismaConversationTurns
  let reviewCaseIntake: PrismaReviewCaseIntake

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue88_turns')
    prisma = database.prisma
    conversationTurns = new PrismaConversationTurns(prisma)
    reviewCaseIntake = new PrismaReviewCaseIntake(
      new PrismaReviewCaseRepository(
        prisma,
        new AuditService(prisma),
        new PrismaActiveCourseMembership(),
      ),
    )
    repository = new PrismaTutoringTurnRepository(
      prisma,
      conversationTurns,
      conversationTurns,
      conversationTurns,
      reviewCaseIntake,
      new AuditService(prisma),
    )
  })

  afterAll(async () => {
    await database?.dispose()
  })

  it('creates one completed Student and one linked pending assistant atomically with consecutive sequences', async () => {
    const fixture = await createFixture(prisma)

    const result = await repository.beginTurn({
      ...fixture,
      clientMessageId: randomUUID(),
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
      requestKind: null,
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
      repository.beginTurn({
        ...fixture,
        clientMessageId: randomUUID(),
        content: 'First question',
      }),
      repository.beginTurn({
        ...fixture,
        clientMessageId: randomUUID(),
        content: 'Second question',
      }),
    ])

    expect(results.map((result) => result.kind).sort()).toEqual([
      'ok',
      'turn_in_progress',
    ])
    await expect(
      prisma.message.count({ where: { sessionId: fixture.sessionId } }),
    ).resolves.toBe(2)
  })

  it('replays a terminal turn for the same client message id without duplicating messages', async () => {
    const fixture = await createFixture(prisma)
    const clientMessageId = randomUUID()
    const turn = await repository.beginTurn({
      ...fixture,
      clientMessageId,
      content: 'Idempotent question',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }
    await repository.failTurn({
      ...fixture,
      attemptId: turn.attemptId,
      studentMessageId: turn.studentMessage.id,
      assistantMessageId: turn.assistantMessage.id,
      content: 'Safe failure',
      errorCode: 'GROUNDING_RESPONSE_FAILED',
    })

    const replay = await repository.beginTurn({
      ...fixture,
      clientMessageId,
      content: 'Idempotent question',
    })

    expect(replay.kind).toBe('replayed')
    if (replay.kind !== 'replayed') {
      return
    }
    expect(replay.studentMessage.id).toBe(clientMessageId)
    expect(replay.assistantMessage.id).toBe(turn.assistantMessage.id)
    await expect(
      prisma.message.count({ where: { sessionId: fixture.sessionId } }),
    ).resolves.toBe(2)
  })

  it('rejects a client message id reused with different content', async () => {
    const fixture = await createFixture(prisma)
    const clientMessageId = randomUUID()
    const turn = await repository.beginTurn({
      ...fixture,
      clientMessageId,
      content: 'Original question',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }
    await repository.failTurn({
      ...fixture,
      attemptId: turn.attemptId,
      studentMessageId: turn.studentMessage.id,
      assistantMessageId: turn.assistantMessage.id,
      content: 'Safe failure',
      errorCode: 'GROUNDING_RESPONSE_FAILED',
    })

    await expect(
      repository.beginTurn({
        ...fixture,
        clientMessageId,
        content: 'Different question',
      }),
    ).resolves.toEqual({ kind: 'idempotency_conflict' })
    await expect(
      prisma.tutoringAttempt.count({ where: { sessionId: fixture.sessionId } }),
    ).resolves.toBe(1)
  })

  it('commits completion metadata, exact retrieval ranks, and deduplicated citation order together', async () => {
    const fixture = await createFixture(prisma)
    const topic = await prisma.topic.create({
      data: {
        sessionId: fixture.sessionId,
        courseId: fixture.courseId,
        title: 'List iteration',
        topicType: 'CONCEPT',
        status: 'ACTIVE',
      },
    })
    const first = await createEvidence(prisma, fixture, 'Lists', 0)
    const second = await createEvidence(prisma, fixture, 'Loops', 3)
    const third = await createChunk(prisma, first.materialId, 1)
    const turn = await repository.beginTurn({
      ...fixture,
      clientMessageId: randomUUID(),
      content: 'Explain list iteration',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }

    const completed = await repository.completeTurn({
      ...fixture,
      attemptId: turn.attemptId,
      studentMessageId: turn.studentMessage.id,
      assistantMessageId: turn.assistantMessage.id,
      content: 'Grounded answer',
      provider: 'deterministic',
      model: 'deterministic-tutor-model-v1',
      promptVersion: 'grounded-explanation-v1',
      inputTokens: 12,
      outputTokens: 8,
      topicId: topic.id,
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
      model: 'deterministic-tutor-model-v1',
      promptVersion: 'grounded-explanation-v1',
      inputTokens: 12,
      outputTokens: 8,
      topicId: topic.id,
    })
    await expect(
      prisma.message.findMany({
        where: {
          id: { in: [turn.studentMessage.id, turn.assistantMessage.id] },
        },
        select: { topicId: true },
        orderBy: { sequence: 'asc' },
      }),
    ).resolves.toEqual([{ topicId: topic.id }, { topicId: topic.id }])
    await expect(
      prisma.tutoringAttempt.findUniqueOrThrow({
        where: { id: turn.attemptId },
        select: { topicId: true },
      }),
    ).resolves.toEqual({ topicId: topic.id })
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

  it('preserves cited context positions instead of citing every retrieved material', async () => {
    const fixture = await createFixture(prisma)
    const first = await createEvidence(prisma, fixture, 'Lists', 0)
    const second = await createEvidence(prisma, fixture, 'Loops', 3)
    const turn = await repository.beginTurn({
      ...fixture,
      clientMessageId: randomUUID(),
      content: 'Diagnose list iteration',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }

    const completed = await repository.completeTurn({
      ...fixture,
      attemptId: turn.attemptId,
      studentMessageId: turn.studentMessage.id,
      assistantMessageId: turn.assistantMessage.id,
      content: 'The concept is supported by the second context entry. [2]',
      provider: 'deterministic',
      model: 'deterministic-tutor-model-v1',
      promptVersion: 'debugging-guidance-prompt-v1',
      evidence: [
        evidence(first, 1, 0.95, 'Lists', 0, 'first excerpt'),
        evidence(second, 2, 0.9, 'Loops', 3, 'second excerpt'),
      ],
      citationContextIndexes: [2],
    })

    expect(completed.kind).toBe('ok')
    const citations = await prisma.messageCitation.findMany({
      where: { messageId: turn.assistantMessage.id },
      orderBy: { citationOrder: 'asc' },
    })
    expect(citations).toEqual([
      expect.objectContaining({
        materialId: second.materialId,
        citationOrder: 2,
      }),
    ])
  })

  it('deduplicates citations when multiple cited evidence chunks belong to the same material', async () => {
    const fixture = await createFixture(prisma)
    const material = await createEvidence(prisma, fixture, 'Collections', 0)
    const turn = await repository.beginTurn({
      ...fixture,
      clientMessageId: randomUUID(),
      content: 'What is the difference between a list and a tuple?',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }

    const completed = await repository.completeTurn({
      ...fixture,
      attemptId: turn.attemptId,
      studentMessageId: turn.studentMessage.id,
      assistantMessageId: turn.assistantMessage.id,
      content: 'Lists and tuples are sequences. [1] [2]',
      provider: 'deterministic',
      model: 'deterministic-tutor-model-v1',
      promptVersion: 'socratic-prompt-v1',
      evidence: [
        evidence(material, 1, 0.95, 'Lists', 0, 'first chunk'),
        evidence(material, 2, 0.9, 'Tuples', 1, 'second chunk'),
      ],
      citationContextIndexes: [1, 2],
    })

    expect(completed.kind).toBe('ok')
    const citations = await prisma.messageCitation.findMany({
      where: { messageId: turn.assistantMessage.id },
      orderBy: { citationOrder: 'asc' },
    })
    expect(citations).toHaveLength(1)
    expect(citations[0]).toMatchObject({
      materialId: material.materialId,
      citationOrder: 1,
    })
  })

  it('rolls back completed status and partial evidence when final evidence is no longer eligible', async () => {
    const fixture = await createFixture(prisma)
    const source = await createEvidence(prisma, fixture, 'Transient source', 0)
    const turn = await repository.beginTurn({
      ...fixture,
      clientMessageId: randomUUID(),
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
        attemptId: turn.attemptId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: 'Must roll back',
        provider: 'deterministic',
        model: 'deterministic-tutor-model-v1',
        promptVersion: 'grounded-explanation-v1',
        evidence: [evidence(source, 1, 0.9, 'Transient source', 0, 'text')],
      }),
    ).rejects.toBeInstanceOf(TutoringEvidenceUnavailableError)

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
      clientMessageId: randomUUID(),
      content: 'Trigger a ranked-write conflict',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }

    await expect(
      repository.completeTurn({
        ...fixture,
        attemptId: turn.attemptId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: 'Must roll back',
        provider: 'deterministic',
        model: 'deterministic-tutor-model-v1',
        promptVersion: 'grounded-explanation-v1',
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
      clientMessageId: randomUUID(),
      content: 'Please retry this',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }
    const failed = await repository.failTurn({
      ...fixture,
      attemptId: turn.attemptId,
      studentMessageId: turn.studentMessage.id,
      assistantMessageId: turn.assistantMessage.id,
      content: 'Safe failure',
      errorCode: 'GROUNDING_RESPONSE_FAILED',
    })
    expect(failed.kind).toBe('ok')

    const retried = await repository.retryTurn({
      ...fixture,
      attemptId: turn.attemptId,
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
        attemptId: turn.attemptId,
      }),
    ).resolves.toEqual({
      kind: 'retry_not_allowed',
      attemptId: turn.attemptId,
    })
    await expect(
      prisma.message.count({ where: { sessionId: fixture.sessionId } }),
    ).resolves.toBe(2)
  })

  it('admits only one simultaneous retry of an exact attempt', async () => {
    const fixture = await createFixture(prisma)
    const turn = await repository.beginTurn({
      ...fixture,
      clientMessageId: randomUUID(),
      content: 'Retry exactly this attempt',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }
    await repository.failTurn({
      ...fixture,
      attemptId: turn.attemptId,
      studentMessageId: turn.studentMessage.id,
      assistantMessageId: turn.assistantMessage.id,
      content: 'Safe failure',
      errorCode: 'GROUNDING_RESPONSE_FAILED',
    })

    const retries = await Promise.all([
      repository.retryTurn({ ...fixture, attemptId: turn.attemptId }),
      repository.retryTurn({ ...fixture, attemptId: turn.attemptId }),
    ])
    expect(retries.map(({ kind }) => kind).sort()).toEqual([
      'ok',
      'retry_not_allowed',
    ])
    const admitted = retries.find((result) => result.kind === 'ok')
    if (admitted?.kind !== 'ok') {
      throw new Error('Expected exactly one retry admission')
    }
    await expect(
      prisma.tutoringAttempt.count({ where: { sessionId: fixture.sessionId } }),
    ).resolves.toBe(2)

    await repository.failTurn({
      ...fixture,
      attemptId: admitted.attemptId,
      studentMessageId: admitted.studentMessage.id,
      assistantMessageId: admitted.assistantMessage.id,
      content: 'Second safe failure',
      errorCode: 'GROUNDING_RESPONSE_FAILED',
    })
    await expect(
      repository.retryTurn({ ...fixture, attemptId: turn.attemptId }),
    ).resolves.toEqual({
      kind: 'retry_not_allowed',
      attemptId: turn.attemptId,
    })
    await expect(
      prisma.tutoringAttempt.count({ where: { sessionId: fixture.sessionId } }),
    ).resolves.toBe(2)
  })

  it('reclaims an expired exact attempt without duplicating messages and rejects its late worker', async () => {
    const fixture = await createFixture(prisma)
    const source = await createEvidence(prisma, fixture, 'Lease source', 0)
    const turn = await repository.beginTurn({
      ...fixture,
      clientMessageId: randomUUID(),
      content: 'Recover this abandoned attempt',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }
    await prisma.tutoringAttempt.update({
      where: { id: turn.attemptId },
      data: { leaseExpiresAt: new Date(0) },
    })

    const retried = await repository.retryTurn({
      ...fixture,
      attemptId: turn.attemptId,
    })
    expect(retried.kind).toBe('ok')
    if (retried.kind !== 'ok') {
      return
    }
    expect(retried.attemptId).not.toBe(turn.attemptId)
    expect(retried.studentMessage.id).toBe(turn.studentMessage.id)
    expect(retried.assistantMessage.id).toBe(turn.assistantMessage.id)

    await expect(
      repository.completeTurn({
        ...fixture,
        attemptId: turn.attemptId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: 'Late answer must not win',
        provider: 'late-provider',
        model: 'late-model',
        promptVersion: 'late-prompt',
        evidence: [evidence(source, 1, 0.9, 'Lease source', 0, 'lease')],
      }),
    ).resolves.toEqual({
      kind: 'message_not_pending',
      messageId: turn.assistantMessage.id,
    })

    const completed = await repository.completeTurn({
      ...fixture,
      attemptId: retried.attemptId,
      studentMessageId: retried.studentMessage.id,
      assistantMessageId: retried.assistantMessage.id,
      content: 'Recovered answer',
      provider: 'current-provider',
      model: 'current-model',
      promptVersion: 'current-prompt',
      evidence: [evidence(source, 1, 0.9, 'Lease source', 0, 'lease')],
    })
    expect(completed.kind).toBe('ok')
    await expect(
      prisma.message.count({ where: { sessionId: fixture.sessionId } }),
    ).resolves.toBe(2)
  })

  it('resolves student explanation detail preference and preserves it across retries even if preference changes', async () => {
    const fixture = await createFixture(prisma)

    // 1. Set initial student preference to DETAILED
    await prisma.studentTutoringPreference.upsert({
      where: { studentId: fixture.studentId },
      create: {
        studentId: fixture.studentId,
        explanationDetailLevel: 'DETAILED',
      },
      update: {
        explanationDetailLevel: 'DETAILED',
      },
    })

    // 2. Begin turn - should resolve to DETAILED
    const turn = await repository.beginTurn({
      ...fixture,
      clientMessageId: randomUUID(),
      content: 'Can you explain closures in detail?',
    })

    expect(turn.kind).toBe('ok')
    if (turn.kind !== 'ok') {
      return
    }
    expect(turn.explanationDetailLevel).toBe('DETAILED')

    const initialAttempt = await prisma.tutoringAttempt.findUniqueOrThrow({
      where: { id: turn.attemptId },
      select: { explanationDetailLevel: true },
    })
    expect(initialAttempt.explanationDetailLevel).toBe('DETAILED')

    // 3. Student changes settings preference to CONCISE in the background
    await prisma.studentTutoringPreference.update({
      where: { studentId: fixture.studentId },
      data: { explanationDetailLevel: 'CONCISE' },
    })

    // Expire the lease so the attempt is retryable
    await prisma.tutoringAttempt.update({
      where: { id: turn.attemptId },
      data: { leaseExpiresAt: new Date(0) },
    })

    // 4. Retry the first turn - must preserve the original DETAILED preference for pedagogical reproducibility
    const retried = await repository.retryTurn({
      ...fixture,
      attemptId: turn.attemptId,
    })

    expect(retried.kind).toBe('ok')
    if (retried.kind !== 'ok') {
      return
    }
    expect(retried.explanationDetailLevel).toBe('DETAILED')

    const retryAttempt = await prisma.tutoringAttempt.findUniqueOrThrow({
      where: { id: retried.attemptId },
      select: { explanationDetailLevel: true, retryOfAttemptId: true },
    })
    expect(retryAttempt.explanationDetailLevel).toBe('DETAILED')
    expect(retryAttempt.retryOfAttemptId).toBe(turn.attemptId)
  })

  it('expires abandoned work before accepting a later send', async () => {
    const fixture = await createFixture(prisma)
    const abandoned = await repository.beginTurn({
      ...fixture,
      clientMessageId: randomUUID(),
      content: 'Abandoned question',
    })
    if (abandoned.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }
    await prisma.tutoringAttempt.update({
      where: { id: abandoned.attemptId },
      data: { leaseExpiresAt: new Date(0) },
    })
    const source = await createEvidence(prisma, fixture, 'Expired evidence', 0)
    await prisma.messageRetrieval.create({
      data: {
        messageId: abandoned.assistantMessage.id,
        chunkId: source.chunkId,
        rank: 1,
        similarityScore: 0.9,
      },
    })
    await prisma.messageCitation.create({
      data: {
        messageId: abandoned.assistantMessage.id,
        materialId: source.materialId,
        citationOrder: 1,
      },
    })

    const next = await repository.beginTurn({
      ...fixture,
      clientMessageId: randomUUID(),
      content: 'Question after restart',
    })
    expect(next.kind).toBe('ok')
    await expect(
      prisma.message.findUniqueOrThrow({
        where: { id: abandoned.assistantMessage.id },
        select: { status: true, errorCode: true },
      }),
    ).resolves.toEqual({
      status: 'FAILED',
      errorCode: 'GROUNDING_ATTEMPT_EXPIRED',
    })
    await expect(
      prisma.messageRetrieval.count({
        where: { messageId: abandoned.assistantMessage.id },
      }),
    ).resolves.toBe(0)
    await expect(
      prisma.messageCitation.count({
        where: { messageId: abandoned.assistantMessage.id },
      }),
    ).resolves.toBe(0)
    await expect(
      prisma.message.count({ where: { sessionId: fixture.sessionId } }),
    ).resolves.toBe(4)
  })

  it('locks active membership after the session and rejects removal that races begin', async () => {
    const fixture = await createFixture(prisma)
    const admin = await openDatabaseClient(database)
    await admin.query('BEGIN')
    await admin.query(
      `
        UPDATE course_memberships
        SET removed_at = now()
        WHERE course_id = $1::uuid
          AND user_id = $2::uuid
      `,
      [fixture.courseId, fixture.studentId],
    )

    try {
      const beginning = repository.beginTurn({
        ...fixture,
        clientMessageId: randomUUID(),
        content: 'Must not pass a revocation race',
      })
      await expectPending(beginning)
      await admin.query('COMMIT')

      await expect(beginning).resolves.toEqual({
        kind: 'membership_missing',
      })
      await expect(
        prisma.message.count({ where: { sessionId: fixture.sessionId } }),
      ).resolves.toBe(0)
    } finally {
      await admin.query('ROLLBACK')
      await admin.end()
    }
  })

  it('refuses completion after membership revocation but safely fails the exact persisted attempt', async () => {
    const fixture = await createFixture(prisma)
    const source = await createEvidence(prisma, fixture, 'Revoked source', 0)
    const turn = await repository.beginTurn({
      ...fixture,
      clientMessageId: randomUUID(),
      content: 'Question before revocation',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }
    const admin = await openDatabaseClient(database)
    await admin.query('BEGIN')
    await admin.query(
      `
        UPDATE course_memberships
        SET removed_at = now()
        WHERE course_id = $1::uuid
          AND user_id = $2::uuid
      `,
      [fixture.courseId, fixture.studentId],
    )

    try {
      const completing = repository.completeTurn({
        ...fixture,
        attemptId: turn.attemptId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: 'Must not persist after revocation',
        provider: 'provider',
        model: 'model',
        promptVersion: 'prompt',
        evidence: [evidence(source, 1, 0.9, 'Revoked source', 0, 'source')],
      })
      await expectPending(completing)
      await admin.query('COMMIT')

      await expect(completing).resolves.toEqual({
        kind: 'membership_missing',
      })
      const failed = await repository.failTurn({
        ...fixture,
        attemptId: turn.attemptId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: 'Safe failure',
        errorCode: 'GROUNDING_RESPONSE_FAILED',
      })
      expect(failed.kind).toBe('ok')
      await expect(
        prisma.message.findUniqueOrThrow({
          where: { id: turn.assistantMessage.id },
          select: { status: true, content: true },
        }),
      ).resolves.toEqual({ status: 'FAILED', content: 'Safe failure' })
    } finally {
      await admin.query('ROLLBACK')
      await admin.end()
    }
  })

  it('refuses completion after session deletion but safely fails the exact hidden attempt', async () => {
    const fixture = await createFixture(prisma)
    const source = await createEvidence(prisma, fixture, 'Deleted source', 0)
    const turn = await repository.beginTurn({
      ...fixture,
      clientMessageId: randomUUID(),
      content: 'Question before deletion',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }
    await prisma.chatSession.update({
      where: { id: fixture.sessionId },
      data: { deletedAt: new Date() },
    })

    await expect(
      repository.completeTurn({
        ...fixture,
        attemptId: turn.attemptId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: 'Must not persist after deletion',
        provider: 'provider',
        model: 'model',
        promptVersion: 'prompt',
        evidence: [evidence(source, 1, 0.9, 'Deleted source', 0, 'source')],
      }),
    ).resolves.toEqual({ kind: 'session_not_found' })

    const failed = await repository.failTurn({
      ...fixture,
      attemptId: turn.attemptId,
      studentMessageId: turn.studentMessage.id,
      assistantMessageId: turn.assistantMessage.id,
      content: 'Safe failure',
      errorCode: 'GROUNDING_RESPONSE_FAILED',
    })
    expect(failed.kind).toBe('ok')
  })

  it('reconciles lost acknowledgements for begin, retry, and completion by exact identity', async () => {
    const beginFixture = await createFixture(prisma)
    const ambiguousBegin = new PrismaTutoringTurnRepository(
      loseNextTransactionAcknowledgement(prisma),
      conversationTurns,
      conversationTurns,
      conversationTurns,
      reviewCaseIntake,
      new AuditService(prisma),
    )
    const begun = await ambiguousBegin.beginTurn({
      ...beginFixture,
      clientMessageId: randomUUID(),
      content: 'Committed begin with lost acknowledgement',
    })
    expect(begun.kind).toBe('ok')
    if (begun.kind !== 'ok') {
      return
    }
    await expect(
      prisma.message.count({ where: { sessionId: beginFixture.sessionId } }),
    ).resolves.toBe(2)

    await repository.failTurn({
      ...beginFixture,
      attemptId: begun.attemptId,
      studentMessageId: begun.studentMessage.id,
      assistantMessageId: begun.assistantMessage.id,
      content: 'Safe failure',
      errorCode: 'GROUNDING_RESPONSE_FAILED',
    })
    const ambiguousRetry = new PrismaTutoringTurnRepository(
      loseNextTransactionAcknowledgement(prisma),
      conversationTurns,
      conversationTurns,
      conversationTurns,
      reviewCaseIntake,
      new AuditService(prisma),
    )
    const retried = await ambiguousRetry.retryTurn({
      ...beginFixture,
      attemptId: begun.attemptId,
    })
    expect(retried.kind).toBe('ok')
    if (retried.kind !== 'ok') {
      return
    }

    const source = await createEvidence(
      prisma,
      beginFixture,
      'Ambiguous completion source',
      0,
    )
    const ambiguousComplete = new PrismaTutoringTurnRepository(
      loseNextTransactionAcknowledgement(prisma),
      conversationTurns,
      conversationTurns,
      conversationTurns,
      reviewCaseIntake,
      new AuditService(prisma),
    )
    const completed = await ambiguousComplete.completeTurn({
      ...beginFixture,
      attemptId: retried.attemptId,
      studentMessageId: retried.studentMessage.id,
      assistantMessageId: retried.assistantMessage.id,
      content: 'Committed answer',
      provider: 'provider',
      model: 'model',
      promptVersion: 'prompt',
      evidence: [
        evidence(source, 1, 0.9, 'Ambiguous completion source', 0, 'source'),
      ],
    })
    expect(completed.kind).toBe('ok')
    if (completed.kind === 'ok') {
      expect(completed.message.content).toBe('Committed answer')
    }
  })

  it('returns an exact committed terminal result when acknowledgement and the first reconciliation read both fail', async () => {
    const fixture = await createFixture(prisma)
    const source = await createEvidence(
      prisma,
      fixture,
      'Delayed reconciliation source',
      0,
    )
    const turn = await repository.beginTurn({
      ...fixture,
      clientMessageId: randomUUID(),
      content: 'Reconcile this committed terminal state',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }
    const intermittentlyUnavailable = new PrismaTutoringTurnRepository(
      loseAcknowledgementAndFirstReconciliation(prisma),
      conversationTurns,
      conversationTurns,
      conversationTurns,
      reviewCaseIntake,
      new AuditService(prisma),
    )

    await expect(
      intermittentlyUnavailable.completeTurn({
        ...fixture,
        attemptId: turn.attemptId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: 'Committed before the connection failed',
        provider: 'provider',
        model: 'model',
        promptVersion: 'prompt',
        evidence: [
          evidence(
            source,
            1,
            0.9,
            'Delayed reconciliation source',
            0,
            'source',
          ),
        ],
      }),
    ).rejects.toThrow('simulated lost transaction acknowledgement')

    const terminal = await intermittentlyUnavailable.failTurn({
      ...fixture,
      attemptId: turn.attemptId,
      studentMessageId: turn.studentMessage.id,
      assistantMessageId: turn.assistantMessage.id,
      content: 'Must not replace the committed answer',
      errorCode: 'GROUNDING_RESPONSE_FAILED',
    })
    expect(terminal.kind).toBe('ok')
    if (terminal.kind === 'ok') {
      expect(terminal.message).toMatchObject({
        status: 'COMPLETED',
        content: 'Committed before the connection failed',
      })
    }
  })

  it('reloads ordered evidence and exposes the unavailable form after chunk reprocessing', async () => {
    const fixture = await createFixture(prisma)
    const source = await createEvidence(prisma, fixture, 'Durable title', 0)
    const turn = await repository.beginTurn({
      ...fixture,
      clientMessageId: randomUUID(),
      content: 'Show durable provenance',
    })
    if (turn.kind !== 'ok') {
      throw new Error('Expected the turn to begin')
    }
    const completed = await repository.completeTurn({
      ...fixture,
      attemptId: turn.attemptId,
      studentMessageId: turn.studentMessage.id,
      assistantMessageId: turn.assistantMessage.id,
      content: 'Grounded response',
      provider: 'deterministic',
      model: 'deterministic-tutor-model-v1',
      promptVersion: 'grounded-explanation-v1',
      evidence: [
        evidence(source, 1, 0.9, 'Durable title', 0, 'durable excerpt'),
      ],
    })
    expect(completed.kind).toBe('ok')

    const messageRepository = new PrismaConversationMessageRepository(prisma)
    const presenter = new ApplicationConversationMessagePresenter(
      new PrismaStudentCitationSources(prisma, {
        exists: jest.fn().mockResolvedValue(true),
      } as never),
      new PrismaStudentReviewSummaries(prisma),
    )
    const before = await messageRepository.listMessages(
      fixture.courseId,
      fixture.sessionId,
      fixture.studentId,
      { limit: 10 },
    )
    if (before === null) {
      throw new Error('Expected history to be readable')
    }
    const presentedBefore = await presenter.presentMany(
      before,
      fixture.studentId,
    )
    expect(presentedBefore[1].citations).toEqual([
      expect.objectContaining({
        materialTitle: 'Durable title',
        sourceAvailable: true,
        sourceStatus: 'AVAILABLE',
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
    const presentedAfter = await presenter.presentMany(after, fixture.studentId)
    expect(presentedAfter[1].citations).toEqual([
      {
        order: 1,
        materialId: source.materialId,
        materialTitle: 'Durable title',
        sourceAvailable: false,
        sourceStatus: 'UNAVAILABLE',
        evidence: [],
      },
    ])
  })
})

async function createFixture(prisma: PrismaService): Promise<TutoringFixture> {
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
      title: 'Tutoring',
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
  fixture: TutoringFixture,
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

async function openDatabaseClient(
  database: DisposableDatabase | undefined,
): Promise<Client> {
  if (database === undefined) {
    throw new Error('Expected the disposable database to be initialized')
  }

  const client = new Client({ connectionString: database.databaseUrl })
  await client.connect()
  return client
}

async function expectPending<T>(promise: Promise<T>): Promise<void> {
  const state = await Promise.race([
    promise.then(() => 'settled' as const),
    new Promise<'pending'>((resolve) => {
      setTimeout(() => {
        resolve('pending')
      }, 50)
    }),
  ])
  expect(state).toBe('pending')
}

function loseNextTransactionAcknowledgement(
  prisma: PrismaService,
): PrismaService {
  let loseAcknowledgement = true
  const transaction = async (
    callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ): Promise<unknown> => {
    const result = await prisma.$transaction(callback)
    if (loseAcknowledgement) {
      loseAcknowledgement = false
      throw new Error('simulated lost transaction acknowledgement')
    }
    return result
  }

  return new Proxy(prisma, {
    get(target, property, receiver) {
      if (property === '$transaction') {
        return transaction
      }
      const value: unknown = Reflect.get(target, property, receiver)
      return value
    },
  })
}

function loseAcknowledgementAndFirstReconciliation(
  prisma: PrismaService,
): PrismaService {
  let transactionCall = 0
  const transaction = async (
    callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ): Promise<unknown> => {
    transactionCall += 1
    if (transactionCall === 2) {
      throw new Error('simulated reconciliation read outage')
    }

    const result = await prisma.$transaction(callback)
    if (transactionCall === 1) {
      throw new Error('simulated lost transaction acknowledgement')
    }
    return result
  }

  return new Proxy(prisma, {
    get(target, property, receiver) {
      if (property === '$transaction') {
        return transaction
      }
      const value: unknown = Reflect.get(target, property, receiver)
      return value
    },
  })
}
