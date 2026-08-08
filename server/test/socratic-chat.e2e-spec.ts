import { randomUUID } from 'node:crypto'

import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import {
  MaterialStatus,
  MessageGuidanceLabel,
  Prisma,
  TutorTurnStatus,
} from '../src/generated/prisma/client'
import type { AuthSessionResponse } from '../src/modules/auth/auth.dto'
import {
  COMPLETION_PROVIDER_TOKEN,
  type CompletionProvider,
} from '../src/modules/completion/completion-provider'
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_PROVIDER_TOKEN,
  type EmbeddingProvider,
} from '../src/modules/embedding/embedding-provider'
import { MaterialProcessingScheduler } from '../src/modules/materials/material-processing.scheduler'
import {
  PDF_STORAGE,
  type PdfStorage,
} from '../src/modules/pdf-storage/pdf-storage'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import {
  GROUNDING_BLOCKED_CONTENT,
  GROUNDING_FAILED_CONTENT,
} from '../src/modules/student-chat/grounded-chat.service'
import type {
  GroundedChatTurnResponseDto,
  ChatSessionResponseDto,
} from '../src/modules/student-chat/student-chat.dto'
import { STUDENT_CHAT_ERROR_CODES } from '../src/modules/student-chat/student-chat.errors'
import {
  P0_DEMO_PASSWORD,
  seedP0DemoData,
  type P0DemoSeedResult,
} from '../src/seeds/p0-demo.seed'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'
import { NoopMaterialProcessingScheduler } from './support/noop-material-processing-scheduler'

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const STUDENT_EMAIL = 'student1@morshid.demo'
const INSTRUCTOR_EMAIL = 'instructor@morshid.demo'
const QUESTION = 'Please explain how Python list comprehensions work'
const QUERY_VECTOR = Object.freeze([
  1,
  ...Array<number>(EMBEDDING_DIMENSIONS - 1).fill(0),
])

// ────────────────────────────────────────────────────────────────────────────
// Test suite
// ────────────────────────────────────────────────────────────────────────────

describe('Socratic chat HTTP vertical-slice (e2e)', () => {
  let app: INestApplication<App> | undefined
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let seed: P0DemoSeedResult
  let pythonCourseId: string
  let studentId: string
  let instructorId: string
  let studentToken: string
  let embeddingFailure: boolean

  const embedQuery = jest.fn() as jest.MockedFunction<
    EmbeddingProvider['embedQuery']
  >
  const complete = jest.fn() as jest.MockedFunction<
    CompletionProvider['complete']
  >
  const storageExists = jest.fn() as jest.MockedFunction<PdfStorage['exists']>
  const availableStoragePaths = new Set<string>()

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_socratic_e2e')
    prisma = database.prisma
    seed = await seedP0DemoData(prisma)
    pythonCourseId = seed.courses.pythonProgramming.id

    const student = seed.users.find((user) => user.email === STUDENT_EMAIL)
    if (student === undefined) {
      throw new Error(`Seed missing ${STUDENT_EMAIL}`)
    }
    studentId = student.id

    const instructor = seed.users.find(
      (user) => user.email === INSTRUCTOR_EMAIL,
    )
    if (instructor === undefined) {
      throw new Error(`Seed missing ${INSTRUCTOR_EMAIL}`)
    }
    instructorId = instructor.id

    embedQuery.mockImplementation(() => {
      if (embeddingFailure) {
        return Promise.reject(new Error('forced embedding failure'))
      }
      return Promise.resolve(QUERY_VECTOR)
    })
    complete.mockImplementation(() =>
      Promise.reject(
        new Error(
          'CompletionProvider.complete must NOT be called in the Socratic path',
        ),
      ),
    )
    storageExists.mockImplementation((storagePath) =>
      Promise.resolve(availableStoragePaths.has(storagePath)),
    )

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn().mockResolvedValue('PONG') })
      .overrideProvider(MaterialProcessingScheduler)
      .useClass(NoopMaterialProcessingScheduler)
      .overrideProvider(EMBEDDING_PROVIDER_TOKEN)
      .useValue({
        model: 'socratic-e2e-test-embedding',
        queryProtocol: 'socratic-e2e-test-embedding',
        embedQuery,
        embedDocuments: () =>
          Promise.reject(
            new Error('documents are not embedded in this spec'),
          ),
      })
      .overrideProvider(COMPLETION_PROVIDER_TOKEN)
      .useValue({ complete })
      .overrideProvider(PDF_STORAGE)
      .useValue({
        create: jest.fn(),
        read: jest.fn(),
        exists: storageExists,
        delete: jest.fn(),
      } satisfies PdfStorage)
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()

    studentToken = await signInAs(STUDENT_EMAIL)
  })

  beforeEach(async () => {
    await prisma.auditLog.deleteMany()
    await prisma.educationalAnalysisMisconception.deleteMany()
    await prisma.educationalAnalysisEvidenceLink.deleteMany()
    await prisma.teachingDecision.deleteMany()
    await prisma.educationalAnalysis.deleteMany()
    await prisma.tutorTurn.deleteMany()
    await prisma.topicState.deleteMany()
    await prisma.topic.deleteMany()
    await prisma.messageRetrieval.deleteMany()
    await prisma.messageCitation.deleteMany()
    await prisma.message.deleteMany()
    await prisma.chatSession.deleteMany()
    await prisma.materialChunk.deleteMany()
    await prisma.material.deleteMany()
    availableStoragePaths.clear()
    embedQuery.mockClear()
    complete.mockClear()
    storageExists.mockClear()
    embeddingFailure = false
  })

  afterAll(async () => {
    try {
      await app?.close()
    } finally {
      await database?.dispose()
    }
  })

  // ── Helpers ──────────────────────────────────────────────────────────────

  function requireApp(): INestApplication<App> {
    if (app === undefined) {
      throw new Error('Expected the test application to be initialized')
    }
    return app
  }

  async function signInAs(email: string): Promise<string> {
    const response = await request(requireApp().getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)
    return (response.body as AuthSessionResponse).accessToken
  }

  function sessionsPath(): string {
    return `/api/v1/courses/${pythonCourseId}/chat-sessions`
  }

  function messagesPath(sessionId: string): string {
    return `${sessionsPath()}/${sessionId}/messages`
  }

  async function createSession(): Promise<
    ChatSessionResponseDto['session']
  > {
    const response = await request(requireApp().getHttpServer())
      .post(sessionsPath())
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'Socratic E2E chat' })
      .expect(201)
    return (response.body as ChatSessionResponseDto).session
  }

  async function createEvidenceMaterial(input: {
    title: string
    content: string
    status?: MaterialStatus
    deleted?: boolean
    available?: boolean
  }): Promise<{ chunkId: string; id: string; storagePath: string }> {
    const id = randomUUID()
    const chunkId = randomUUID()
    const storagePath = `socratic-e2e/${id}.pdf`
    const status = input.status ?? MaterialStatus.READY
    const material = await prisma.material.create({
      data: {
        id,
        courseId: pythonCourseId,
        uploadedById: instructorId,
        title: input.title,
        originalFilename: `${id}.pdf`,
        storagePath,
        status,
        extractedTextLength: input.content.length,
        chunkCount: 1,
        ...(input.deleted === true ? { deletedAt: new Date() } : {}),
      },
    })
    const vector = `[${QUERY_VECTOR.join(',')}]`
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO material_chunks (
        id,
        material_id,
        chunk_index,
        content,
        embedding,
        embedding_model
      ) VALUES (
        ${chunkId}::uuid,
        ${material.id}::uuid,
        0,
        ${input.content},
        ${vector}::vector(1536),
        'socratic-e2e-test-embedding'
      )
    `)
    if (input.available !== false) {
      availableStoragePaths.add(storagePath)
    }
    return { chunkId, id: material.id, storagePath }
  }

  // ── 1. Happy path: full Socratic vertical slice ──────────────────────

  it('executes the full Socratic pipeline from HTTP to approved response', async () => {
    await createEvidenceMaterial({
      title: 'Python comprehension tutorial',
      content: 'List comprehensions provide a concise way to create lists.',
    })
    const session = await createSession()

    const response = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: QUESTION })
      .expect(201)
    const turn = response.body as GroundedChatTurnResponseDto

    // Student message is trimmed and persisted
    expect(turn.studentMessage).toMatchObject({
      sequence: 1,
      content: QUESTION,
      status: 'COMPLETED',
    })

    // Assistant response from the Socratic pipeline (deterministic safe
    // fallback or validated candidate) must be COMPLETED and COURSE_GROUNDED
    expect(turn.assistantMessage).toMatchObject({
      sequence: 2,
      responseToMessageId: turn.studentMessage.id,
      status: 'COMPLETED',
      guidanceLabel: 'COURSE_GROUNDED',
    })
    expect(turn.assistantMessage.content.length).toBeGreaterThan(0)

    // CompletionProvider must NOT be called — Socratic replaces it
    expect(complete).not.toHaveBeenCalled()

    // TutorTurn was created and completed
    const tutorTurns = await prisma.tutorTurn.findMany({
      where: { sessionId: session.id },
    })
    expect(tutorTurns).toHaveLength(1)
    expect(tutorTurns[0].status).toBe(TutorTurnStatus.COMPLETED)

    // A Topic was created for the session
    const topics = await prisma.topic.findMany({
      where: { sessionId: session.id },
    })
    expect(topics).toHaveLength(1)

    // An educational analysis was persisted
    const analyses = await prisma.educationalAnalysis.findMany({
      where: { turnId: tutorTurns[0].id },
    })
    expect(analyses.length).toBeGreaterThanOrEqual(1)

    // A teaching decision was persisted
    const decisions = await prisma.teachingDecision.findMany({
      where: { turnId: tutorTurns[0].id },
    })
    expect(decisions).toHaveLength(1)

    // The assistant message is persisted with retrieval evidence
    const stored = await prisma.message.findUniqueOrThrow({
      where: { id: turn.assistantMessage.id },
      include: {
        retrievals: { orderBy: { rank: 'asc' } },
      },
    })
    expect(stored.status).toBe('COMPLETED')
    expect(stored.guidanceLabel).toBe(MessageGuidanceLabel.COURSE_GROUNDED)
    expect(stored.retrievals.length).toBeGreaterThanOrEqual(1)
    expect(stored.completedAt).not.toBeNull()
  })

  // ── 2. Insufficient evidence → BLOCKED ──────────────────────────────

  it('blocks with insufficient evidence when no material chunks exist', async () => {
    const session = await createSession()

    const response = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: 'No course material covers this topic' })
      .expect(201)
    const turn = response.body as GroundedChatTurnResponseDto

    expect(turn.assistantMessage).toMatchObject({
      status: 'BLOCKED',
      guidanceLabel: 'GENERAL_NOT_FOUND',
      content: GROUNDING_BLOCKED_CONTENT,
      errorCode: 'GROUNDING_INSUFFICIENT_EVIDENCE',
      citations: [],
    })

    // No retrieval evidence persisted
    await expect(
      prisma.messageRetrieval.count({
        where: { messageId: turn.assistantMessage.id },
      }),
    ).resolves.toBe(0)

    // CompletionProvider must NOT be called
    expect(complete).not.toHaveBeenCalled()
  })

  // ── 3. Embedding failure → FAILED with safe terminal state ──────────

  it('maps embedding failure to a safe FAILED turn', async () => {
    await createEvidenceMaterial({
      title: 'Failure test source',
      content: 'Failure test evidence',
    })
    const session = await createSession()
    embeddingFailure = true

    const response = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: 'Question with embedding failure' })
      .expect(201)
    const turn = response.body as GroundedChatTurnResponseDto

    expect(turn.assistantMessage).toMatchObject({
      status: 'FAILED',
      content: GROUNDING_FAILED_CONTENT,
      errorCode: 'GROUNDING_RESPONSE_FAILED',
      citations: [],
    })

    // The TutorTurn should be marked as FAILED
    const tutorTurns = await prisma.tutorTurn.findMany({
      where: { sessionId: session.id },
    })
    expect(tutorTurns).toHaveLength(1)
    expect(tutorTurns[0].status).toBe(TutorTurnStatus.FAILED)
  })

  // ── 4. Idempotent replay: no duplicate TutorTurn or assistant message ─

  it('replays a completed turn idempotently when the same clientMessageId is sent twice', async () => {
    await createEvidenceMaterial({
      title: 'Replay test source',
      content: 'Replay test evidence',
    })
    const session = await createSession()
    const clientMessageId = randomUUID()

    // First send with a stable clientMessageId
    const first = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: QUESTION, clientMessageId })
      .expect(201)
    const firstTurn = first.body as GroundedChatTurnResponseDto
    expect(firstTurn.assistantMessage.status).toBe('COMPLETED')

    // Same clientMessageId should replay, not create duplicates
    const second = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: QUESTION, clientMessageId })
      .expect(201)
    const secondTurn = second.body as GroundedChatTurnResponseDto

    // Same student message and assistant message returned
    expect(secondTurn.studentMessage.id).toBe(firstTurn.studentMessage.id)
    expect(secondTurn.assistantMessage.id).toBe(firstTurn.assistantMessage.id)
    expect(secondTurn.assistantMessage.status).toBe('COMPLETED')

    // Only 2 messages total (1 student + 1 assistant), not 4
    await expect(
      prisma.message.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(2)

    // Only 1 TutorTurn
    await expect(
      prisma.tutorTurn.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(1)
  })

  // ── 5. Retry: failed response can be retried with Socratic pipeline ──

  it('retries a failed turn through the Socratic pipeline', async () => {
    await createEvidenceMaterial({
      title: 'Retry test source',
      content: 'Retry test evidence',
    })
    const session = await createSession()

    // Force failure via embedding
    embeddingFailure = true
    const failedResponse = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: 'Retry this question' })
      .expect(201)
    const failedTurn = failedResponse.body as GroundedChatTurnResponseDto
    expect(failedTurn.assistantMessage.status).toBe('FAILED')

    // Retry with embedding fixed
    embeddingFailure = false
    const retryPath = `${messagesPath(session.id)}/${failedTurn.studentMessage.id}/retry`
    const retryResponse = await request(requireApp().getHttpServer())
      .post(retryPath)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
    const retriedTurn = retryResponse.body as GroundedChatTurnResponseDto

    // Same message IDs, successful status
    expect(retriedTurn.studentMessage.id).toBe(failedTurn.studentMessage.id)
    expect(retriedTurn.assistantMessage.id).toBe(
      failedTurn.assistantMessage.id,
    )
    expect(retriedTurn.assistantMessage.status).toBe('COMPLETED')
    expect(retriedTurn.assistantMessage.guidanceLabel).toBe('COURSE_GROUNDED')

    // Only 2 messages (no duplicates)
    await expect(
      prisma.message.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(2)

    // Cannot retry an already-completed turn
    const disallowedRetry = await request(requireApp().getHttpServer())
      .post(retryPath)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(409)
    expect(disallowedRetry.body).toEqual({
      code: STUDENT_CHAT_ERROR_CODES.RETRY_NOT_ALLOWED,
      message: 'Only a failed or expired assistant response can be retried',
    })
  })

  // ── 6. Concurrent sends → one conflict ────────────────────────────

  it('returns one conflict for concurrent sends without creating orphan messages', async () => {
    await createEvidenceMaterial({
      title: 'Concurrent source',
      content: 'Concurrent evidence',
    })
    const session = await createSession()

    // Send two requests concurrently
    const [firstResponse, secondResponse] = await Promise.all([
      request(requireApp().getHttpServer())
        .post(messagesPath(session.id))
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ content: 'First concurrent question' })
        .then((response) => response),
      request(requireApp().getHttpServer())
        .post(messagesPath(session.id))
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ content: 'Second concurrent question' })
        .then((response) => response),
    ])

    // One should succeed (201) and one should conflict (409)
    const statuses = [firstResponse.status, secondResponse.status].sort()
    expect(statuses).toEqual([201, 409])

    // Only 2 messages (1 student + 1 assistant from the winner)
    await expect(
      prisma.message.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(2)
  })

  // ── 7. Privacy: cross-session retry concealment ────────────────────

  it('conceals cross-session retry targets', async () => {
    await createEvidenceMaterial({
      title: 'Privacy test source',
      content: 'Privacy test evidence',
    })
    const session1 = await createSession()
    const session2 = await createSession()

    // Fail in session1
    embeddingFailure = true
    const failedResponse = await request(requireApp().getHttpServer())
      .post(messagesPath(session1.id))
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: 'Private question' })
      .expect(201)
    const failedTurn = failedResponse.body as GroundedChatTurnResponseDto

    // Try to retry using session2 — should be 404
    const crossRetry = await request(requireApp().getHttpServer())
      .post(
        `${messagesPath(session2.id)}/${failedTurn.studentMessage.id}/retry`,
      )
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(404)
    expect(crossRetry.body).toEqual({
      code: STUDENT_CHAT_ERROR_CODES.RETRY_TARGET_NOT_FOUND,
      message: 'Chat message was not found',
    })
  })
})
