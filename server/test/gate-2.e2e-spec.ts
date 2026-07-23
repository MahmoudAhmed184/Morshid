import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import { AUDIT_EVENT_ACTIONS } from '../src/modules/audit/audit.constants'
import type { AuthSessionResponse } from '../src/modules/auth/auth.dto'
import { createCompletionProvider } from '../src/modules/completion/completion-provider.factory'
import {
  COMPLETION_PROVIDER_TOKEN,
  type CompletionProvider,
  type CompletionRequest,
  type CompletionResult,
} from '../src/modules/completion/completion-provider'
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_PROVIDER_TOKEN,
} from '../src/modules/embedding/embedding-provider'
import { ValidatedEmbeddingProvider } from '../src/modules/embedding/validated-embedding.provider'
import { MaterialProcessingScheduler } from '../src/modules/materials/material-processing.scheduler'
import { MaterialProcessingService } from '../src/modules/materials/material-processing.service'
import type { MaterialStatusDto } from '../src/modules/materials/materials.dto'
import { LocalPdfStorageAdapter } from '../src/modules/pdf-storage/local-pdf-storage.adapter'
import { PDF_STORAGE } from '../src/modules/pdf-storage/pdf-storage'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RagPersistenceRepository } from '../src/modules/rag-persistence/rag-persistence.repository'
import { RedisService } from '../src/modules/redis/redis.service'
import {
  type CourseRetrievalResult,
  RetrievalService,
} from '../src/modules/retrieval/retrieval.service'
import { GROUNDING_BLOCKED_CONTENT } from '../src/modules/student-chat/grounded-chat.service'
import type {
  ChatMessageHistoryResponseDto,
  ChatSessionResponseDto,
  GroundedChatTurnResponseDto,
} from '../src/modules/student-chat/student-chat.dto'
import {
  P0_DEMO_PASSWORD,
  seedP0DemoData,
  type P0DemoSeedResult,
} from '../src/seeds/p0-demo.seed'
import {
  GATE_2_FIXTURE,
  GATE_2_HIDDEN_SIMILARITY,
  GATE_2_VISIBLE_SIMILARITY,
  Gate2DeterministicEmbeddingProvider,
  gate2PermissionSafePdf,
  injectGate2BelowThresholdEvidence,
  injectGate2HiddenAdversary,
} from './fixtures/gate-2.fixture'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

const GATE_2_TIMEOUT_MS = 10_000

jest.setTimeout(30_000)

class CapturingCompletionProvider implements CompletionProvider {
  readonly requests: CompletionRequest[] = []

  constructor(private readonly delegate: CompletionProvider) {}

  complete(input: CompletionRequest): Promise<CompletionResult> {
    this.requests.push(input)
    return this.delegate.complete(input)
  }

  clear(): void {
    this.requests.length = 0
  }
}

class CapturingProcessingScheduler extends MaterialProcessingScheduler {
  readonly scheduledMaterialIds: string[] = []

  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  async scheduleMaterialProcessing(materialId: string): Promise<void> {
    await this.prismaService.materialProcessingCommand.upsert({
      where: { materialId },
      create: { materialId },
      update: {},
    })
    this.scheduledMaterialIds.push(materialId)
  }
}

describe('Gate 2 end-to-end and adversarial isolation', () => {
  let app: INestApplication<App> | undefined
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let seed: P0DemoSeedResult
  let storageRoot: string | undefined
  let storage: LocalPdfStorageAdapter
  let persistence: RagPersistenceRepository
  let retrievalService: RetrievalService
  let processingService: MaterialProcessingService
  let processingScheduler: CapturingProcessingScheduler
  let completionProvider: CapturingCompletionProvider

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_gate_2')
    prisma = database.prisma
    seed = await seedP0DemoData(prisma)
    storageRoot = await mkdtemp(join(tmpdir(), 'morshid-gate-2-'))
    storage = new LocalPdfStorageAdapter(storageRoot)
    completionProvider = new CapturingCompletionProvider(
      createCompletionProvider('deterministic', 30_000),
    )
    processingScheduler = new CapturingProcessingScheduler(prisma)

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn().mockResolvedValue('PONG') })
      .overrideProvider(PDF_STORAGE)
      .useValue(storage)
      .overrideProvider(EMBEDDING_PROVIDER_TOKEN)
      .useValue(
        new ValidatedEmbeddingProvider(
          new Gate2DeterministicEmbeddingProvider(),
        ),
      )
      .overrideProvider(COMPLETION_PROVIDER_TOKEN)
      .useValue(completionProvider)
      .overrideProvider(MaterialProcessingScheduler)
      .useValue(processingScheduler)
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()
    persistence = moduleFixture.get(RagPersistenceRepository)
    retrievalService = moduleFixture.get(RetrievalService)
    processingService = moduleFixture.get(MaterialProcessingService)
  })

  beforeEach(() => {
    completionProvider.clear()
  })

  afterAll(async () => {
    const cleanupFailures: unknown[] = []

    try {
      try {
        await app?.close()
      } catch (error) {
        cleanupFailures.push(error)
      }
    } finally {
      try {
        try {
          await database?.dispose()
        } catch (error) {
          cleanupFailures.push(error)
        }
      } finally {
        if (storageRoot !== undefined) {
          try {
            await rm(storageRoot, { recursive: true, force: true })
          } catch (error) {
            cleanupFailures.push(error)
          }
        }
      }
    }

    if (cleanupFailures.length > 0) {
      throw new AggregateError(cleanupFailures, 'Gate 2 teardown failed')
    }
  })

  it('proves upload through a persisted cited response without hidden-course leakage', async () => {
    const instructorToken = await gate2Stage(
      'authenticate authorized Instructor',
      () => signInAs('instructor@morshid.demo'),
    )
    const upload = await gate2Stage('upload permission-safe Python PDF', () =>
      request(requireApp().getHttpServer())
        .post(`/api/v1/courses/${seed.courses.pythonProgramming.id}/materials`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .field('title', GATE_2_FIXTURE.sourceTitle)
        .attach('file', gate2PermissionSafePdf(), {
          filename: GATE_2_FIXTURE.sourceFilename,
          contentType: 'application/pdf',
        })
        .expect(201),
    )
    const uploadedMaterialId = (
      upload.body as { material: { id: string; status: string } }
    ).material.id
    expect(upload.body).toMatchObject({
      material: {
        id: uploadedMaterialId,
        courseId: seed.courses.pythonProgramming.id,
        title: GATE_2_FIXTURE.sourceTitle,
        originalFilename: GATE_2_FIXTURE.sourceFilename,
        status: 'PROCESSING',
      },
    })
    expect(processingScheduler.scheduledMaterialIds).toEqual([
      uploadedMaterialId,
    ])

    const terminalStatus = await gate2Stage(
      'run real processing and wait for retrievable material readiness',
      async () => {
        await processingService.processMaterial(uploadedMaterialId)
        return waitForTerminalMaterialStatus(
          uploadedMaterialId,
          instructorToken,
        )
      },
    )
    expect(terminalStatus).toMatchObject({
      id: uploadedMaterialId,
      status: 'READY',
      errorMessage: null,
    })
    expect(terminalStatus.extractedTextLength).toBeGreaterThan(0)
    expect(terminalStatus.chunkCount).toBeGreaterThan(0)

    const uploadedChunks = await gate2Stage(
      'inspect extracted chunks and 1,536-dimension embeddings',
      async () => {
        const chunks = await persistence.findMaterialChunks(uploadedMaterialId)
        expect(chunks).toHaveLength(terminalStatus.chunkCount ?? 0)
        expect(chunks).not.toHaveLength(0)
        for (const chunk of chunks) {
          expect(chunk.embedding).toHaveLength(EMBEDDING_DIMENSIONS)
          expect(chunk.embeddingModel).toBe('gate-2-deterministic-embedding-v1')
        }
        return chunks
      },
    )
    await gate2Stage('verify upload and readiness audit evidence', async () => {
      const audits = await prisma.auditLog.findMany({
        where: { targetId: uploadedMaterialId },
        select: { action: true, courseId: true, metadata: true },
        orderBy: { createdAt: 'asc' },
      })
      expect(audits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_SUCCEEDED,
            courseId: seed.courses.pythonProgramming.id,
          }),
          expect.objectContaining({
            action: AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_READY,
            courseId: seed.courses.pythonProgramming.id,
          }),
        ]),
      )
    })

    const instructor = await prisma.user.findUniqueOrThrow({
      where: { email: 'instructor@morshid.demo' },
    })
    const hidden = await gate2Stage(
      'inject stronger unassigned HIDDEN-ISOLATION fixture',
      () =>
        injectGate2HiddenAdversary({
          courseId: seed.courses.hiddenIsolation.id,
          persistence,
          prisma,
          storage,
          uploadedById: instructor.id,
        }),
    )
    expect(GATE_2_HIDDEN_SIMILARITY).toBeGreaterThan(GATE_2_VISIBLE_SIMILARITY)
    await expect(
      prisma.courseMembership.count({
        where: {
          courseId: seed.courses.hiddenIsolation.id,
          user: { email: 'student1@morshid.demo' },
          removedAt: null,
        },
      }),
    ).resolves.toBe(0)

    const retrieval = await gate2Stage(
      'query production retrieval with mandatory Python course scope',
      () =>
        retrievalService.retrieveCourseEvidence(
          seed.courses.pythonProgramming.id,
          GATE_2_FIXTURE.question,
        ),
    )
    const retrievedChunks = requireEvidence(retrieval)
    expect(retrievedChunks.map(({ materialId }) => materialId)).toContain(
      uploadedMaterialId,
    )
    expect(
      retrievedChunks.find(
        ({ materialId }) => materialId === uploadedMaterialId,
      )?.content,
    ).toContain(GATE_2_FIXTURE.visibleSentinel)
    expectNoHiddenState(JSON.stringify(retrieval), hidden)

    const studentToken = await gate2Stage(
      'authenticate assigned Python Student',
      () => signInAs('student1@morshid.demo'),
    )
    const sessionId = await gate2Stage(
      'create private Python chat session',
      () => createGate2Session('Gate 2 conceptual question', studentToken),
    )
    const turn = await gate2Stage(
      'retrieve, complete, persist, and cite the locked question',
      () => sendGate2Message(sessionId, GATE_2_FIXTURE.question, studentToken),
    )

    expect(turn.studentMessage).toMatchObject({
      sequence: 1,
      content: GATE_2_FIXTURE.question,
      status: 'COMPLETED',
      citations: [],
    })
    expect(turn.assistantMessage).toMatchObject({
      sequence: 2,
      responseToMessageId: turn.studentMessage.id,
      status: 'COMPLETED',
      guidanceLabel: 'COURSE_GROUNDED',
    })
    expect(turn.assistantMessage.citations).toHaveLength(1)
    const citation = turn.assistantMessage.citations[0]
    expect(citation).toMatchObject({
      materialId: uploadedMaterialId,
      materialTitle: GATE_2_FIXTURE.sourceTitle,
      sourceAvailable: true,
    })
    expect(citation.evidence).toHaveLength(1)
    expect(citation.evidence[0]).toMatchObject({
      chunkId: uploadedChunks[0].id,
      chunkNumber: 1,
    })

    await gate2Stage(
      'prove hidden content never reaches provider, persistence, or response',
      async () => {
        expect(completionProvider.requests).toHaveLength(1)
        const providerInput = completionProvider.requests[0]
        expect(Object.keys(providerInput).sort()).toEqual([
          'context',
          'studentQuestion',
        ])
        expect(providerInput.studentQuestion).toBe(GATE_2_FIXTURE.question)
        expect(providerInput.context).toHaveLength(1)
        expect(providerInput.context[0]).toMatchObject({
          sourceTitle: GATE_2_FIXTURE.sourceTitle,
          chunkIndex: 0,
        })
        expect(providerInput.context[0].content).toContain(
          GATE_2_FIXTURE.visibleSentinel,
        )

        const persistedAssistant = await prisma.message.findUniqueOrThrow({
          where: { id: turn.assistantMessage.id },
          include: {
            retrievals: {
              include: { chunk: true },
              orderBy: { rank: 'asc' },
            },
            citations: { orderBy: { citationOrder: 'asc' } },
          },
        })
        expect(persistedAssistant).toMatchObject({
          content: turn.assistantMessage.content,
          status: 'COMPLETED',
          provider: 'deterministic',
          model: 'deterministic-completion-v1',
          promptVersion: 'grounded-completion-v1',
        })
        expect(persistedAssistant.content).not.toContain(
          GATE_2_FIXTURE.hiddenSentinel,
        )
        expect(persistedAssistant.retrievals).toHaveLength(1)
        expect(persistedAssistant.retrievals[0].chunkId).toBe(
          uploadedChunks[0].id,
        )
        expect(persistedAssistant.citations).toEqual([
          expect.objectContaining({ materialId: uploadedMaterialId }),
        ])
        expect(
          await prisma.messageRetrieval.count({
            where: { chunkId: hidden.chunkId },
          }),
        ).toBe(0)
        expect(
          await prisma.messageCitation.count({
            where: { materialId: hidden.material.id },
          }),
        ).toBe(0)
        const persistedMessages = await prisma.message.findMany({
          where: { sessionId },
          select: { id: true, role: true, sequence: true, status: true },
          orderBy: { sequence: 'asc' },
        })
        expect(persistedMessages).toEqual([
          {
            id: turn.studentMessage.id,
            role: 'STUDENT',
            sequence: 1,
            status: 'COMPLETED',
          },
          {
            id: turn.assistantMessage.id,
            role: 'ASSISTANT',
            sequence: 2,
            status: 'COMPLETED',
          },
        ])

        const exposedState = JSON.stringify({
          retrieval,
          providerInput,
          persistedAssistant,
          renderedResponse: turn,
        })
        expectNoHiddenState(exposedState, hidden)
      },
    )

    await gate2Stage(
      'reload the persisted Student and cited assistant messages',
      async () => {
        const reload = await request(requireApp().getHttpServer())
          .get(messagesPath(sessionId))
          .set('Authorization', `Bearer ${studentToken}`)
          .expect(200)
        const history = reload.body as ChatMessageHistoryResponseDto

        expect(history.messages).toHaveLength(2)
        expect(history.messages).toEqual([
          expect.objectContaining({
            id: turn.studentMessage.id,
            content: GATE_2_FIXTURE.question,
          }),
          expect.objectContaining({
            id: turn.assistantMessage.id,
            content: turn.assistantMessage.content,
            citations: turn.assistantMessage.citations,
          }),
        ])
        expectNoHiddenState(JSON.stringify(reload.body), hidden)
      },
    )
  })

  it('blocks insufficient evidence without an ungrounded completion call', async () => {
    const instructor = await prisma.user.findUniqueOrThrow({
      where: { email: 'instructor@morshid.demo' },
    })
    await gate2Stage(
      'insufficient evidence: install an eligible below-threshold row',
      () =>
        injectGate2BelowThresholdEvidence({
          courseId: seed.courses.pythonProgramming.id,
          persistence,
          prisma,
          storage,
          uploadedById: instructor.id,
        }),
    )
    await expect(
      retrievalService.retrieveCourseEvidence(
        seed.courses.pythonProgramming.id,
        GATE_2_FIXTURE.unsupportedQuestion,
      ),
    ).resolves.toEqual({ kind: 'insufficient_evidence' })

    const studentToken = await gate2Stage(
      'insufficient evidence: authenticate Student',
      () => signInAs('student1@morshid.demo'),
    )
    const sessionId = await gate2Stage(
      'insufficient evidence: create private session',
      () => createGate2Session('Gate 2 insufficient evidence', studentToken),
    )
    const turn = await gate2Stage(
      'insufficient evidence: enforce threshold before completion',
      () =>
        sendGate2Message(
          sessionId,
          GATE_2_FIXTURE.unsupportedQuestion,
          studentToken,
        ),
    )

    expect(completionProvider.requests).toHaveLength(0)
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

  function requireApp(): INestApplication<App> {
    if (app === undefined) {
      throw new Error('Gate 2 test application was not initialized')
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

  async function createGate2Session(
    title: string,
    token: string,
  ): Promise<string> {
    const response = await request(requireApp().getHttpServer())
      .post(
        `/api/v1/courses/${seed.courses.pythonProgramming.id}/chat-sessions`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ title })
      .expect(201)

    return (response.body as ChatSessionResponseDto).session.id
  }

  async function sendGate2Message(
    sessionId: string,
    content: string,
    token: string,
  ): Promise<GroundedChatTurnResponseDto> {
    const response = await request(requireApp().getHttpServer())
      .post(messagesPath(sessionId))
      .set('Authorization', `Bearer ${token}`)
      .send({ content })
      .expect(201)

    return response.body as GroundedChatTurnResponseDto
  }

  function messagesPath(sessionId: string): string {
    return `/api/v1/courses/${seed.courses.pythonProgramming.id}/chat-sessions/${sessionId}/messages`
  }

  async function waitForTerminalMaterialStatus(
    materialId: string,
    token: string,
  ): Promise<MaterialStatusDto> {
    const deadline = Date.now() + GATE_2_TIMEOUT_MS

    while (Date.now() < deadline) {
      const response = await request(requireApp().getHttpServer())
        .get(
          `/api/v1/courses/${seed.courses.pythonProgramming.id}/materials/${materialId}/status`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
      const status = response.body as MaterialStatusDto
      if (['READY', 'WARNING', 'FAILED'].includes(status.status)) {
        return status
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 25))
    }

    throw new Error(
      `material ${materialId} did not reach a terminal status within ${String(GATE_2_TIMEOUT_MS)}ms`,
    )
  }
})

function requireEvidence(result: CourseRetrievalResult) {
  expect(result.kind).toBe('evidence')
  if (result.kind !== 'evidence') {
    throw new Error('Gate 2 expected retrievable Python course evidence')
  }
  return result.chunks
}

function expectNoHiddenState(
  serialized: string,
  hidden: {
    chunkId: string
    content: string
    material: { id: string; storagePath: string; title: string }
  },
): void {
  for (const hiddenValue of [
    hidden.material.id,
    hidden.material.storagePath,
    hidden.material.title,
    hidden.chunkId,
    hidden.content,
    GATE_2_FIXTURE.hiddenSentinel,
  ]) {
    expect(serialized).not.toContain(hiddenValue)
  }
}

async function gate2Stage<Result>(
  name: string,
  operation: () => Promise<Result>,
): Promise<Result> {
  try {
    return await operation()
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Gate 2 stage failed — ${name}: ${detail}`, {
      cause: error,
    })
  }
}
