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
import { TUTOR_MODEL_PORT } from '../src/modules/socratic-tutor/tutor-generation.types'
import { SEMANTIC_GUARD_PORT } from '../src/modules/socratic-tutor/semantic-guard.types'
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
import {
  ControllableTutorModelPort,
  ControllableSemanticGuardPort,
  validCandidateRawOutput,
  rejectedCandidateRawOutput,
  failingSemanticGuardBehavior,
  createDeferredPromise,
} from './support/socratic-e2e-providers'

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

const EXPECTED_HAPPY_PATH_MESSAGE =
  'What part of the list comprehension syntax are you most unsure about? Try writing just the expression part first.'

// ────────────────────────────────────────────────────────────────────────────
// Test suite
// ────────────────────────────────────────────────────────────────────────────

describe('Socratic chat HTTP vertical-slice (e2e)', () => {
  let app: INestApplication<App> | undefined
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let seed: P0DemoSeedResult
  let pythonCourseId: string
  let instructorId: string
  let studentToken: string
  let embeddingFailure: boolean

  const tutorModel = new ControllableTutorModelPort()
  const semanticGuard = new ControllableSemanticGuardPort()

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
          Promise.reject(new Error('documents are not embedded in this spec')),
      })
      .overrideProvider(COMPLETION_PROVIDER_TOKEN)
      .useValue({ complete })
      .overrideProvider(TUTOR_MODEL_PORT)
      .useValue(tutorModel)
      .overrideProvider(SEMANTIC_GUARD_PORT)
      .useValue(semanticGuard)
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
    tutorModel.reset()
    semanticGuard.reset()
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

  async function createSession(): Promise<ChatSessionResponseDto['session']> {
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

  // ── 1. Happy path: validated candidate approved ──────────────────────

  it('approves a validated candidate through Structural → Deterministic → Semantic', async () => {
    await createEvidenceMaterial({
      title: 'Python comprehension tutorial',
      content: 'List comprehensions provide a concise way to create lists.',
    })
    const session = await createSession()

    // tutorModel and semanticGuard default to approved behavior

    const response = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: QUESTION })
      .expect(201)
    const turn = response.body as GroundedChatTurnResponseDto

    expect(turn.studentMessage).toMatchObject({
      sequence: 1,
      content: QUESTION,
      status: 'COMPLETED',
    })

    // The approved candidate message — NOT a SafeFallback
    expect(turn.assistantMessage).toMatchObject({
      sequence: 2,
      responseToMessageId: turn.studentMessage.id,
      content: EXPECTED_HAPPY_PATH_MESSAGE,
      status: 'COMPLETED',
      guidanceLabel: 'COURSE_GROUNDED',
    })

    // CompletionProvider must NOT be called
    expect(complete).not.toHaveBeenCalled()

    // Tutor generation was invoked exactly once
    expect(tutorModel.callCount).toBe(1)

    // TutorTurn persisted as COMPLETED
    const tutorTurns = await prisma.tutorTurn.findMany({
      where: { sessionId: session.id },
    })
    expect(tutorTurns).toHaveLength(1)
    expect(tutorTurns[0].status).toBe(TutorTurnStatus.COMPLETED)

    // Persisted message has correct metadata
    const stored = await prisma.message.findUniqueOrThrow({
      where: { id: turn.assistantMessage.id },
      include: { retrievals: { orderBy: { rank: 'asc' } } },
    })
    expect(stored.status).toBe('COMPLETED')
    expect(stored.guidanceLabel).toBe(MessageGuidanceLabel.COURSE_GROUNDED)
    expect(stored.retrievals.length).toBeGreaterThanOrEqual(1)
    expect(stored.completedAt).not.toBeNull()
  })

  // ── 2. Regeneration: candidate #1 rejected, #2 approved ─────────────

  it('regenerates after first candidate rejection and approves the second', async () => {
    await createEvidenceMaterial({
      title: 'Regeneration test source',
      content: 'Content for regeneration scenario.',
    })
    const session = await createSession()

    let callIndex = 0
    tutorModel.behavior = (modelRequest) => {
      callIndex += 1
      if (callIndex === 1) {
        // First attempt: return a candidate that will fail deterministic guard
        return Promise.resolve(
          Object.freeze({
            rawOutput: Object.freeze(rejectedCandidateRawOutput()),
            provider: 'e2e-controllable-tutor',
            model: 'e2e-controllable-tutor-v1',
            promptVersion: modelRequest.promptVersion,
            inputTokens: 100,
            outputTokens: 50,
          }),
        )
      }
      // Second attempt: return a valid candidate
      const citationIds = tutorModel.extractAllowedCitationIds(modelRequest)
      return Promise.resolve(
        Object.freeze({
          rawOutput: Object.freeze(validCandidateRawOutput(citationIds)),
          provider: 'e2e-controllable-tutor',
          model: 'e2e-controllable-tutor-v1',
          promptVersion: modelRequest.promptVersion,
          inputTokens: 110,
          outputTokens: 55,
        }),
      )
    }

    const response = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: QUESTION })
      .expect(201)
    const turn = response.body as GroundedChatTurnResponseDto

    // Tutor generation was invoked exactly twice
    expect(tutorModel.callCount).toBe(2)

    // The approved second candidate is the student-visible message
    expect(turn.assistantMessage).toMatchObject({
      status: 'COMPLETED',
      content: EXPECTED_HAPPY_PATH_MESSAGE,
      guidanceLabel: 'COURSE_GROUNDED',
    })

    // Only 2 messages persisted (1 student + 1 assistant); the rejected
    // candidate must NOT be persisted as conversation history
    await expect(
      prisma.message.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(2)

    // The assistant message content is the approved candidate, not rejected
    const stored = await prisma.message.findUniqueOrThrow({
      where: { id: turn.assistantMessage.id },
    })
    expect(stored.content).toBe(EXPECTED_HAPPY_PATH_MESSAGE)
    expect(stored.status).toBe('COMPLETED')
  })

  // ── 3. Semantic Guard infrastructure failure → SafeFallback ──────────

  it('falls back to SafeFallback when Semantic Guard throws an infrastructure error', async () => {
    await createEvidenceMaterial({
      title: 'Semantic guard failure source',
      content: 'Content for semantic guard failure scenario.',
    })
    const session = await createSession()

    // Structural and Deterministic will pass (default tutor model behavior),
    // but the Semantic Guard will throw a transport failure
    semanticGuard.behavior = failingSemanticGuardBehavior()

    const response = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: QUESTION })
      .expect(201)
    const turn = response.body as GroundedChatTurnResponseDto

    // The response is COMPLETED (safe fallback), not FAILED
    expect(turn.assistantMessage.status).toBe('COMPLETED')
    expect(turn.assistantMessage.guidanceLabel).toBe('COURSE_GROUNDED')

    // The content is a SafeFallback, NOT the approved candidate
    expect(turn.assistantMessage.content).not.toBe(EXPECTED_HAPPY_PATH_MESSAGE)
    expect(turn.assistantMessage.content.length).toBeGreaterThan(0)

    // CompletionProvider must NOT be called
    expect(complete).not.toHaveBeenCalled()

    // Tutor generation was invoked exactly once
    expect(tutorModel.callCount).toBe(1)

    // TutorTurn is COMPLETED (safe fallback is still a completed turn)
    const tutorTurns = await prisma.tutorTurn.findMany({
      where: { sessionId: session.id },
    })
    expect(tutorTurns).toHaveLength(1)
    expect(tutorTurns[0].status).toBe(TutorTurnStatus.COMPLETED)
  })

  // ── 4. Insufficient evidence → BLOCKED ──────────────────────────────

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
    expect(complete).not.toHaveBeenCalled()
  })

  // ── 5. Embedding failure → FAILED ───────────────────────────────────

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

    const tutorTurns = await prisma.tutorTurn.findMany({
      where: { sessionId: session.id },
    })
    expect(tutorTurns).toHaveLength(1)
    expect(tutorTurns[0].status).toBe(TutorTurnStatus.FAILED)
  })

  // ── 6. Idempotent replay ────────────────────────────────────────────

  it('replays a completed turn idempotently when the same clientMessageId is sent twice', async () => {
    await createEvidenceMaterial({
      title: 'Replay test source',
      content: 'Replay test evidence',
    })
    const session = await createSession()
    const clientMessageId = randomUUID()

    const first = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: QUESTION, clientMessageId })
      .expect(201)
    const firstTurn = first.body as GroundedChatTurnResponseDto
    expect(firstTurn.assistantMessage.status).toBe('COMPLETED')

    const second = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: QUESTION, clientMessageId })
      .expect(201)
    const secondTurn = second.body as GroundedChatTurnResponseDto

    expect(secondTurn.studentMessage.id).toBe(firstTurn.studentMessage.id)
    expect(secondTurn.assistantMessage.id).toBe(firstTurn.assistantMessage.id)
    expect(secondTurn.assistantMessage.status).toBe('COMPLETED')

    await expect(
      prisma.message.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(2)
    await expect(
      prisma.tutorTurn.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(1)
  })

  // ── 7. Retry: failed → COMPLETED ──────────────────────────────────

  it('retries a failed turn through the Socratic pipeline', async () => {
    await createEvidenceMaterial({
      title: 'Retry test source',
      content: 'Retry test evidence',
    })
    const session = await createSession()

    embeddingFailure = true
    const failedResponse = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: 'Retry this question' })
      .expect(201)
    const failedTurn = failedResponse.body as GroundedChatTurnResponseDto
    expect(failedTurn.assistantMessage.status).toBe('FAILED')

    embeddingFailure = false
    const retryPath = `${messagesPath(session.id)}/${failedTurn.studentMessage.id}/retry`
    const retryResponse = await request(requireApp().getHttpServer())
      .post(retryPath)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
    const retriedTurn = retryResponse.body as GroundedChatTurnResponseDto

    expect(retriedTurn.studentMessage.id).toBe(failedTurn.studentMessage.id)
    expect(retriedTurn.assistantMessage.id).toBe(failedTurn.assistantMessage.id)
    expect(retriedTurn.assistantMessage.status).toBe('COMPLETED')
    expect(retriedTurn.assistantMessage.guidanceLabel).toBe('COURSE_GROUNDED')

    await expect(
      prisma.message.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(2)

    const disallowedRetry = await request(requireApp().getHttpServer())
      .post(retryPath)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(409)
    expect(disallowedRetry.body).toEqual({
      code: STUDENT_CHAT_ERROR_CODES.RETRY_NOT_ALLOWED,
      message: 'Only a failed or expired assistant response can be retried',
    })
  })

  // ── 8. Concurrent sends → deterministic conflict ──────────────────

  it('returns a conflict for a concurrent send while the first is still in flight', async () => {
    await createEvidenceMaterial({
      title: 'Concurrent source',
      content: 'Concurrent evidence',
    })
    const session = await createSession()

    // Use a deferred promise gate on the tutor model to hold the first
    // request mid-pipeline, ensuring the second request arrives while
    // the first is still in flight.
    const gate = createDeferredPromise<undefined>()
    let gateReached = false
    const gateReachedPromise = new Promise<void>((resolve) => {
      tutorModel.behavior = async (modelRequest) => {
        gateReached = true
        resolve()
        await gate.promise
        const citationIds = tutorModel.extractAllowedCitationIds(modelRequest)
        return Object.freeze({
          rawOutput: Object.freeze(validCandidateRawOutput(citationIds)),
          provider: 'e2e-controllable-tutor',
          model: 'e2e-controllable-tutor-v1',
          promptVersion: modelRequest.promptVersion,
          inputTokens: 100,
          outputTokens: 50,
        })
      }
    })

    const firstResponsePromise = request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: 'First concurrent question' })
      .then((response) => response)

    // Wait for the first request to enter the tutor model gate
    await gateReachedPromise
    expect(gateReached).toBe(true)

    // Second request should get 409 because the first is still in flight
    const conflict = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: 'Second concurrent question' })
      .expect(409)
    expect(conflict.body).toEqual({
      code: STUDENT_CHAT_ERROR_CODES.TURN_IN_PROGRESS,
      message: 'A student chat turn is already in progress',
    })

    // Release the gate and let the first request complete
    gate.resolve(undefined)
    const firstResponse = await firstResponsePromise
    expect(firstResponse.status).toBe(201)

    await expect(
      prisma.message.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(2)
  })

  // ── 9. Privacy: cross-session retry concealment ────────────────────

  it('conceals cross-session retry targets', async () => {
    await createEvidenceMaterial({
      title: 'Privacy test source',
      content: 'Privacy test evidence',
    })
    const session1 = await createSession()
    const session2 = await createSession()

    embeddingFailure = true
    const failedResponse = await request(requireApp().getHttpServer())
      .post(messagesPath(session1.id))
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: 'Private question' })
      .expect(201)
    const failedTurn = failedResponse.body as GroundedChatTurnResponseDto

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
