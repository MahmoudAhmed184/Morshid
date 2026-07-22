import { randomUUID } from 'node:crypto'

import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import {
  CourseMembershipRole,
  MaterialStatus,
  Prisma,
} from '../src/generated/prisma/client'
import type { AuthSessionResponse } from '../src/modules/auth/auth.dto'
import {
  COMPLETION_PROVIDER_TOKEN,
  type CompletionProvider,
  type CompletionRequest,
  type CompletionResult,
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
  type BeginGroundedChatTurnInput,
  type BeginGroundedChatTurnResult,
  type CompleteGroundedChatTurnInput,
  type FinalizeGroundedChatTurnInput,
  type FinalizeGroundedChatTurnResult,
  GroundedChatTurnRepository,
  PrismaGroundedChatTurnRepository,
  type RetryGroundedChatTurnInput,
  type RetryGroundedChatTurnResult,
} from '../src/modules/student-chat/grounded-chat-turn.repository'
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

const STUDENT_1_EMAIL = 'student1@morshid.demo'
const STUDENT_2_EMAIL = 'student2@morshid.demo'
const UNASSIGNED_STUDENT_EMAIL = 'student3@morshid.demo'
const INSTRUCTOR_EMAIL = 'instructor@morshid.demo'
const QUESTION = 'Explain the eligible course evidence exactly'
const GROUNDED_ANSWER = 'This answer uses only eligible course evidence.'
const PROVIDER_SECRET = 'raw provider failure: never expose or persist this'
const QUERY_VECTOR = Object.freeze([
  1,
  ...Array<number>(EMBEDDING_DIMENSIONS - 1).fill(0),
])

interface SeededActor {
  id: string
  email: string
}

interface EvidenceMaterial {
  chunkId: string
  content: string
  id: string
  storagePath: string
  title: string
}

type CompletionBehavior = (
  completionRequest: CompletionRequest,
) => Promise<CompletionResult>

class ControllableGroundedChatTurnRepository extends GroundedChatTurnRepository {
  failNextCompletion = false
  failFailurePersistence = false

  constructor(private readonly delegate: PrismaGroundedChatTurnRepository) {
    super()
  }

  override beginTurn(
    input: BeginGroundedChatTurnInput,
  ): Promise<BeginGroundedChatTurnResult> {
    return this.delegate.beginTurn(input)
  }

  override retryTurn(
    input: RetryGroundedChatTurnInput,
  ): Promise<RetryGroundedChatTurnResult> {
    return this.delegate.retryTurn(input)
  }

  override completeTurn(
    input: CompleteGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult> {
    if (this.failNextCompletion) {
      this.failNextCompletion = false
      return Promise.reject(new Error('forced final write failure'))
    }

    return this.delegate.completeTurn(input)
  }

  override failTurn(
    input: FinalizeGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult> {
    if (this.failFailurePersistence) {
      return Promise.reject(new Error('forced terminal write failure'))
    }

    return this.delegate.failTurn(input)
  }

  override blockTurn(
    input: FinalizeGroundedChatTurnInput,
  ): Promise<FinalizeGroundedChatTurnResult> {
    return this.delegate.blockTurn(input)
  }
}

describe('Authorized grounded chat orchestration (e2e)', () => {
  let app: INestApplication<App> | undefined
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let seed: P0DemoSeedResult
  let pythonCourseId: string
  let hiddenCourseId: string
  let student1: SeededActor
  let student2: SeededActor
  let unassignedStudent: SeededActor
  let instructor: SeededActor
  let student1Token: string
  let student2Token: string
  let unassignedStudentToken: string
  let instructorToken: string
  let embeddingFailure: boolean
  let completionBehavior: CompletionBehavior
  let turnRepository: ControllableGroundedChatTurnRepository
  const availableStoragePaths = new Set<string>()
  const embedBatch = jest.fn() as jest.MockedFunction<
    EmbeddingProvider['embedBatch']
  >
  const complete = jest.fn() as jest.MockedFunction<
    CompletionProvider['complete']
  >
  const storageExists = jest.fn() as jest.MockedFunction<PdfStorage['exists']>

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue88_http')
    prisma = database.prisma
    seed = await seedP0DemoData(prisma)
    pythonCourseId = seed.courses.pythonProgramming.id
    hiddenCourseId = seed.courses.hiddenIsolation.id
    student1 = requireSeededActor(STUDENT_1_EMAIL)
    student2 = requireSeededActor(STUDENT_2_EMAIL)
    unassignedStudent = requireSeededActor(UNASSIGNED_STUDENT_EMAIL)
    instructor = requireSeededActor(INSTRUCTOR_EMAIL)

    await prisma.courseMembership.create({
      data: {
        courseId: hiddenCourseId,
        userId: student1.id,
        role: CourseMembershipRole.STUDENT,
      },
    })
    await prisma.courseMembership.update({
      where: {
        courseId_userId: {
          courseId: pythonCourseId,
          userId: unassignedStudent.id,
        },
      },
      data: { removedAt: new Date() },
    })

    embedBatch.mockImplementation((texts) => {
      if (embeddingFailure) {
        return Promise.reject(new Error('raw embedding failure'))
      }

      return Promise.resolve(texts.map(() => QUERY_VECTOR))
    })
    complete.mockImplementation((completionRequest) =>
      completionBehavior(completionRequest),
    )
    storageExists.mockImplementation((storagePath) =>
      Promise.resolve(availableStoragePaths.has(storagePath)),
    )

    turnRepository = new ControllableGroundedChatTurnRepository(
      new PrismaGroundedChatTurnRepository(prisma),
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
      .useValue({ model: 'issue-88-test-embedding', embedBatch })
      .overrideProvider(COMPLETION_PROVIDER_TOKEN)
      .useValue({ complete })
      .overrideProvider(PDF_STORAGE)
      .useValue({
        create: jest.fn(),
        read: jest.fn(),
        exists: storageExists,
        delete: jest.fn(),
      } satisfies PdfStorage)
      .overrideProvider(GroundedChatTurnRepository)
      .useValue(turnRepository)
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
    await prisma.message.deleteMany()
    await prisma.chatSession.deleteMany()
    await prisma.materialChunk.deleteMany()
    await prisma.material.deleteMany()
    availableStoragePaths.clear()
    embedBatch.mockClear()
    complete.mockClear()
    storageExists.mockClear()
    embeddingFailure = false
    turnRepository.failNextCompletion = false
    turnRepository.failFailurePersistence = false
    completionBehavior = () => Promise.resolve(successfulCompletion())
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

    return actor
  }

  async function signInAs(email: string): Promise<string> {
    const response = await request(requireApp().getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)

    return (response.body as AuthSessionResponse).accessToken
  }

  function sessionsPath(courseId = pythonCourseId): string {
    return `/api/v1/courses/${courseId}/chat-sessions`
  }

  function messagesPath(sessionId: string, courseId = pythonCourseId): string {
    return `${sessionsPath(courseId)}/${sessionId}/messages`
  }

  async function createSession(
    token = student1Token,
    courseId = pythonCourseId,
  ): Promise<ChatSessionResponseDto['session']> {
    const response = await request(requireApp().getHttpServer())
      .post(sessionsPath(courseId))
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Issue 88 grounded chat' })
      .expect(201)

    return (response.body as ChatSessionResponseDto).session
  }

  async function createEvidenceMaterial(input: {
    courseId?: string
    title: string
    content: string
    status?: MaterialStatus
    deleted?: boolean
    available?: boolean
  }): Promise<EvidenceMaterial> {
    const id = randomUUID()
    const chunkId = randomUUID()
    const storagePath = `issue-88/${id}.pdf`
    const status = input.status ?? MaterialStatus.READY
    const material = await prisma.material.create({
      data: {
        id,
        courseId: input.courseId ?? pythonCourseId,
        uploadedById: instructor.id,
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
        'issue-88-test-embedding'
      )
    `)
    if (input.available !== false) {
      availableStoragePaths.add(storagePath)
    }

    return {
      chunkId,
      content: input.content,
      id: material.id,
      storagePath,
      title: material.title,
    }
  }

  function successfulCompletion(): CompletionResult {
    return {
      content: GROUNDED_ANSWER,
      provider: 'issue-88-test-provider',
      model: 'issue-88-test-model',
      promptVersion: 'issue-88-test-prompt-v1',
      inputTokens: 41,
      outputTokens: 9,
    }
  }

  it('grounds completion and persistence only in eligible, available chunks from the trusted course', async () => {
    const ready = await createEvidenceMaterial({
      title: 'Eligible READY source',
      content: 'Eligible READY evidence',
    })
    const warning = await createEvidenceMaterial({
      title: 'Eligible WARNING source',
      content: 'Eligible WARNING evidence',
      status: MaterialStatus.WARNING,
    })
    const forbidden = [
      await createEvidenceMaterial({
        courseId: hiddenCourseId,
        title: 'Hidden-course source',
        content: 'HIDDEN COURSE SENTINEL',
      }),
      await createEvidenceMaterial({
        title: 'Unready source',
        content: 'UNREADY SENTINEL',
        status: MaterialStatus.PROCESSING,
      }),
      await createEvidenceMaterial({
        title: 'Deleted source',
        content: 'DELETED SENTINEL',
        deleted: true,
      }),
      await createEvidenceMaterial({
        title: 'Unavailable source',
        content: 'UNAVAILABLE SENTINEL',
        available: false,
      }),
    ]
    const session = await createSession()

    const response = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ content: `  ${QUESTION}  ` })
      .expect(201)
    const turn = response.body as GroundedChatTurnResponseDto

    expect(turn.studentMessage).toMatchObject({
      sequence: 1,
      content: QUESTION,
      status: 'COMPLETED',
      citations: [],
    })
    expect(turn.assistantMessage).toMatchObject({
      sequence: 2,
      responseToMessageId: turn.studentMessage.id,
      content: GROUNDED_ANSWER,
      status: 'COMPLETED',
      guidanceLabel: 'COURSE_GROUNDED',
    })
    expect(complete).toHaveBeenCalledTimes(1)
    const providerRequest = complete.mock.calls[0][0]
    expect(providerRequest.studentQuestion).toBe(QUESTION)
    expect(providerRequest.context).toHaveLength(2)
    expect(
      providerRequest.context.map(({ content }) => content).sort(),
    ).toEqual([ready.content, warning.content].sort())
    expect(Object.keys(providerRequest).sort()).toEqual([
      'context',
      'studentQuestion',
    ])

    expect(turn.assistantMessage.citations).toHaveLength(2)
    expect(
      turn.assistantMessage.citations
        .map(({ materialId }) => materialId)
        .sort(),
    ).toEqual([ready.id, warning.id].sort())
    expect(
      turn.assistantMessage.citations.flatMap(({ evidence }) => evidence),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ chunkId: ready.chunkId, chunkNumber: 1 }),
        expect.objectContaining({ chunkId: warning.chunkId, chunkNumber: 1 }),
      ]),
    )

    const stored = await prisma.message.findUniqueOrThrow({
      where: { id: turn.assistantMessage.id },
      include: {
        retrievals: { orderBy: { rank: 'asc' } },
        citations: { orderBy: { citationOrder: 'asc' } },
      },
    })
    expect(stored).toMatchObject({
      status: 'COMPLETED',
      provider: 'issue-88-test-provider',
      model: 'issue-88-test-model',
      promptVersion: 'issue-88-test-prompt-v1',
      inputTokens: 41,
      outputTokens: 9,
    })
    expect(stored.retrievals).toHaveLength(2)
    expect(stored.citations).toHaveLength(2)

    const serializedAllowedState = JSON.stringify({
      providerRequest,
      response: response.body as unknown,
      retrievals: stored.retrievals,
      citations: stored.citations,
    })
    for (const excluded of forbidden) {
      expect(serializedAllowedState).not.toContain(excluded.id)
      expect(serializedAllowedState).not.toContain(excluded.chunkId)
      expect(serializedAllowedState).not.toContain(excluded.content)
    }
    const checkedPaths = storageExists.mock.calls.map(([path]) => path)
    expect(checkedPaths).not.toContain(forbidden[0].storagePath)
    expect(checkedPaths).not.toContain(forbidden[1].storagePath)
    expect(checkedPaths).not.toContain(forbidden[2].storagePath)
    expect(checkedPaths).toContain(forbidden[3].storagePath)
  })

  it('blocks insufficient evidence without calling completion or retaining evidence', async () => {
    const session = await createSession()

    const response = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ content: 'No course source covers this' })
      .expect(201)
    const turn = response.body as GroundedChatTurnResponseDto

    expect(complete).not.toHaveBeenCalled()
    expect(turn.assistantMessage).toMatchObject({
      status: 'BLOCKED',
      guidanceLabel: 'GENERAL_NOT_FOUND',
      content: GROUNDING_BLOCKED_CONTENT,
      errorCode: 'GROUNDING_INSUFFICIENT_EVIDENCE',
      citations: [],
    })
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

  it('maps retrieval and final-write failures to durable safe failed turns', async () => {
    await createEvidenceMaterial({
      title: 'Eligible source',
      content: 'Eligible evidence',
    })
    const retrievalFailureSession = await createSession()
    embeddingFailure = true

    const retrievalFailure = await request(requireApp().getHttpServer())
      .post(messagesPath(retrievalFailureSession.id))
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ content: 'Question with raw retrieval failure' })
      .expect(201)
    expect(retrievalFailure.body).toMatchObject({
      assistantMessage: {
        status: 'FAILED',
        content: GROUNDING_FAILED_CONTENT,
        errorCode: 'GROUNDING_RESPONSE_FAILED',
        citations: [],
      },
    })
    expect(complete).not.toHaveBeenCalled()

    embeddingFailure = false
    const finalFailureSession = await createSession()
    turnRepository.failNextCompletion = true
    const finalFailure = await request(requireApp().getHttpServer())
      .post(messagesPath(finalFailureSession.id))
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ content: 'Question with a final write failure' })
      .expect(201)
    const failedTurn = finalFailure.body as GroundedChatTurnResponseDto
    expect(failedTurn.assistantMessage).toMatchObject({
      status: 'FAILED',
      content: GROUNDING_FAILED_CONTENT,
      errorCode: 'GROUNDING_RESPONSE_FAILED',
      citations: [],
    })
    await expect(
      prisma.message.findUniqueOrThrow({
        where: { id: failedTurn.assistantMessage.id },
        select: {
          status: true,
          provider: true,
          model: true,
          promptVersion: true,
          errorMessage: true,
          retrievals: true,
          citations: true,
        },
      }),
    ).resolves.toEqual({
      status: 'FAILED',
      provider: null,
      model: null,
      promptVersion: null,
      errorMessage: null,
      retrievals: [],
      citations: [],
    })
  })

  it('retries only a failed response while preserving both message identities and sequences', async () => {
    await createEvidenceMaterial({
      title: 'Retry source',
      content: 'Retry-safe evidence',
    })
    const session = await createSession()
    completionBehavior = () => Promise.reject(new Error(PROVIDER_SECRET))
    const initialResponse = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ content: 'Retry this exact persisted question' })
      .expect(201)
    const initialTurn = initialResponse.body as GroundedChatTurnResponseDto
    expect(initialTurn.assistantMessage).toMatchObject({
      status: 'FAILED',
      content: GROUNDING_FAILED_CONTENT,
    })
    expect(JSON.stringify(initialResponse.body)).not.toContain(PROVIDER_SECRET)

    completionBehavior = () => Promise.resolve(successfulCompletion())
    const retryPath = `${messagesPath(session.id)}/${initialTurn.studentMessage.id}/retry`
    const retryResponse = await request(requireApp().getHttpServer())
      .post(retryPath)
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(200)
    const retriedTurn = retryResponse.body as GroundedChatTurnResponseDto

    expect(retriedTurn.studentMessage.id).toBe(initialTurn.studentMessage.id)
    expect(retriedTurn.assistantMessage.id).toBe(
      initialTurn.assistantMessage.id,
    )
    expect(retriedTurn.studentMessage.sequence).toBe(1)
    expect(retriedTurn.assistantMessage.sequence).toBe(2)
    expect(retriedTurn.assistantMessage.status).toBe('COMPLETED')
    await expect(
      prisma.message.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(2)

    const disallowedRetry = await request(requireApp().getHttpServer())
      .post(retryPath)
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(409)
    expect(disallowedRetry.body).toEqual({
      code: STUDENT_CHAT_ERROR_CODES.RETRY_NOT_ALLOWED,
      message: 'Only a failed assistant response can be retried',
    })
  })

  it('returns one conflict for concurrent sends without creating an orphan Student message', async () => {
    await createEvidenceMaterial({
      title: 'Concurrent source',
      content: 'Concurrent evidence',
    })
    const session = await createSession()
    let releaseCompletion: (() => void) | undefined
    let markCompletionStarted: (() => void) | undefined
    const completionStarted = new Promise<void>((resolve) => {
      markCompletionStarted = resolve
    })
    const completionGate = new Promise<void>((resolve) => {
      releaseCompletion = resolve
    })
    completionBehavior = async () => {
      markCompletionStarted?.()
      await completionGate
      return successfulCompletion()
    }

    const firstResponsePromise = request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ content: 'First concurrent question' })
      .then((response) => response)
    await completionStarted

    const conflict = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ content: 'Second concurrent question' })
      .expect(409)
    expect(conflict.body).toEqual({
      code: STUDENT_CHAT_ERROR_CODES.TURN_IN_PROGRESS,
      message: 'A student chat turn is already in progress',
    })

    releaseCompletion?.()
    const firstResponse = await firstResponsePromise
    expect(firstResponse.status).toBe(201)
    await expect(
      prisma.message.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(2)
  })

  it('conceals foreign, cross-course, deleted, and foreign retry targets and rejects role and body overrides', async () => {
    const ownerSession = await createSession()
    const protectedQuestion = 'Owner-only question must not appear in audits'
    const beforeOverride = await prisma.message.count()
    const overrideResponse = await request(requireApp().getHttpServer())
      .post(messagesPath(ownerSession.id))
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        content: protectedQuestion,
        courseId: hiddenCourseId,
        studentId: student2.id,
        chunks: [],
        ranks: [],
        scores: [],
        citations: [],
        labels: [],
        provider: 'client-provider',
        model: 'client-model',
      })
      .expect(400)
    expect(overrideResponse.body).toMatchObject({
      code: STUDENT_CHAT_ERROR_CODES.INVALID_REQUEST,
      message: 'Invalid student chat request',
    })
    await expect(prisma.message.count()).resolves.toBe(beforeOverride)

    const foreignResponse = await request(requireApp().getHttpServer())
      .post(messagesPath(ownerSession.id))
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ content: protectedQuestion })
      .expect(404)
    expect(foreignResponse.body).toEqual({
      code: STUDENT_CHAT_ERROR_CODES.SESSION_NOT_FOUND,
      message: 'Chat session was not found',
    })

    await request(requireApp().getHttpServer())
      .post(messagesPath(ownerSession.id, hiddenCourseId))
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ content: protectedQuestion })
      .expect(404)
    await request(requireApp().getHttpServer())
      .post(messagesPath(ownerSession.id))
      .set('Authorization', `Bearer ${unassignedStudentToken}`)
      .send({ content: protectedQuestion })
      .expect(403)
    await request(requireApp().getHttpServer())
      .post(messagesPath(ownerSession.id))
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({ content: protectedQuestion })
      .expect(403)

    const deletedSession = await createSession()
    await request(requireApp().getHttpServer())
      .delete(`${sessionsPath()}/${deletedSession.id}`)
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(204)
    await request(requireApp().getHttpServer())
      .post(messagesPath(deletedSession.id))
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ content: protectedQuestion })
      .expect(404)

    await createEvidenceMaterial({
      title: 'Foreign retry source',
      content: 'Foreign retry evidence',
    })
    completionBehavior = () => Promise.reject(new Error(PROVIDER_SECRET))
    const failedTurnResponse = await request(requireApp().getHttpServer())
      .post(messagesPath(ownerSession.id))
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ content: protectedQuestion })
      .expect(201)
    const failedTurn = failedTurnResponse.body as GroundedChatTurnResponseDto
    const otherOwnerSession = await createSession()
    const foreignRetryPath = `${messagesPath(otherOwnerSession.id)}/${failedTurn.studentMessage.id}/retry`
    const foreignRetry = await request(requireApp().getHttpServer())
      .post(foreignRetryPath)
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(404)
    expect(foreignRetry.body).toEqual({
      code: STUDENT_CHAT_ERROR_CODES.RETRY_TARGET_NOT_FOUND,
      message: 'Chat message was not found',
    })
    await request(requireApp().getHttpServer())
      .post(
        `${messagesPath(ownerSession.id)}/${failedTurn.studentMessage.id}/retry`,
      )
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ provider: 'client-provider' })
      .expect(400)

    const auditRecords = await prisma.auditLog.findMany()
    const serializedAudits = JSON.stringify(auditRecords)
    expect(serializedAudits).not.toContain(protectedQuestion)
    expect(serializedAudits).not.toContain(PROVIDER_SECRET)
  })

  it('uses 503 only when a safe terminal state cannot be persisted', async () => {
    await createEvidenceMaterial({
      title: 'Terminal persistence source',
      content: 'Terminal persistence evidence',
    })
    const session = await createSession()
    completionBehavior = () => Promise.reject(new Error(PROVIDER_SECRET))
    turnRepository.failFailurePersistence = true

    const response = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ content: 'Terminal state cannot be trusted' })
      .expect(503)

    expect(response.body).toEqual({
      code: STUDENT_CHAT_ERROR_CODES.TERMINAL_STATE_UNAVAILABLE,
      message: 'The student chat turn could not be safely persisted',
    })
    expect(JSON.stringify(response.body)).not.toContain(PROVIDER_SECRET)
  })
})
