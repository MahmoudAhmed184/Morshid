import { randomUUID } from 'node:crypto'

import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { config as loadEnv } from 'dotenv'
import request from 'supertest'
import type { App } from 'supertest/types'
import type * as AppModuleFile from '../src/app.module.js'

import { configureApp } from '../src/app.setup'
import {
  MaterialStatus,
  MessageGuidanceLabel,
  Prisma,
  TutorTurnStatus,
} from '../src/generated/prisma/client'
import type { AuthSessionResponse } from '../src/modules/auth/auth.dto'
import { COMPLETION_PROVIDER_TOKEN } from '../src/modules/completion/completion-provider'
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
import type {
  ChatSessionResponseDto,
  GroundedChatTurnResponseDto,
} from '../src/modules/student-chat/student-chat.dto'
import { validateEnv } from '../src/modules/config/env.schema'
import { CONFIG_ENV_FILE_PATHS } from '../src/modules/config/configuration'
import {
  OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER,
  normalizeOpenAICompatibleBaseUrl,
} from '../src/modules/socratic-tutor/analysis-model.configuration'
import { OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER } from '../src/modules/socratic-tutor/tutor-model.configuration'
import { OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER } from '../src/modules/socratic-tutor/semantic-guard.configuration'
import { EDUCATIONAL_ANALYSIS_SOURCE } from '../src/modules/socratic-tutor/educational-analysis.types'
import { TUTOR_GENERATION_PROMPT_VERSION } from '../src/modules/socratic-tutor/tutor-prompt.registry'
import { SAFE_FALLBACK_PROMPT_VERSION } from '../src/modules/socratic-tutor/safe-fallback.service'
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

loadEnv({
  path: CONFIG_ENV_FILE_PATHS,
  override: true,
  quiet: true,
})

const STUDENT_EMAIL = 'student1@morshid.demo'
const INSTRUCTOR_EMAIL = 'instructor@morshid.demo'
const LIVE_E2E_QUESTION =
  'I wrote total = price + tax after calculating tax = price * rate. How can I check whether my substitution step makes sense without you giving me the final number?'
const LIVE_E2E_MATERIAL =
  'When checking a substitution step, name each variable, replace one symbol at a time with the given value, and verify the operation order before calculating the final result.'
const QUERY_VECTOR = Object.freeze([
  1,
  ...Array<number>(EMBEDDING_DIMENSIONS - 1).fill(0),
])

const env = validateEnv(process.env)
assertLiveGeminiRoleConfiguration(env)

describe('Gemini Socratic runtime HTTP live verification', () => {
  let app: INestApplication<App> | undefined
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let seed: P0DemoSeedResult
  let pythonCourseId: string
  let instructorId: string
  let studentToken: string
  let fetchRecorder: FetchRecorder | undefined

  const embedQuery = jest.fn() as jest.MockedFunction<
    EmbeddingProvider['embedQuery']
  >
  const storageExists = jest.fn() as jest.MockedFunction<PdfStorage['exists']>
  const availableStoragePaths = new Set<string>()

  beforeAll(async () => {
    fetchRecorder = installFetchRecorder()
    database = await setUpDisposableDatabase('morshid_gemini_socratic_live_e2e')
    prisma = database.prisma
    seed = await seedP0DemoData(prisma)
    pythonCourseId = seed.courses.pythonProgramming.id

    const instructor = seed.users.find(
      (user) => user.email === INSTRUCTOR_EMAIL,
    )
    if (instructor === undefined) {
      throw new Error(`Seed missing ${INSTRUCTOR_EMAIL}`)
    }
    instructorId = instructor.id

    embedQuery.mockResolvedValue(QUERY_VECTOR)
    storageExists.mockImplementation((storagePath) =>
      Promise.resolve(availableStoragePaths.has(storagePath)),
    )

    const appModuleImport: typeof AppModuleFile =
      await import('../src/app.module.js')
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [appModuleImport.AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn().mockResolvedValue('PONG') })
      .overrideProvider(MaterialProcessingScheduler)
      .useClass(NoopMaterialProcessingScheduler)
      .overrideProvider(EMBEDDING_PROVIDER_TOKEN)
      .useValue({
        model: 'gemini-socratic-live-e2e-embedding',
        queryProtocol: 'gemini-socratic-live-e2e-query',
        embedQuery,
        embedDocuments: () =>
          Promise.reject(new Error('documents are not embedded in this spec')),
      } satisfies EmbeddingProvider)
      .overrideProvider(COMPLETION_PROVIDER_TOKEN)
      .useValue({
        complete: () =>
          Promise.reject(
            new Error('CompletionProvider.complete is not the Socratic path'),
          ),
      })
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
  }, 180_000)

  beforeEach(async () => {
    fetchRecorder?.clear()
    availableStoragePaths.clear()
    embedQuery.mockClear()
    storageExists.mockClear()
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
  })

  afterAll(async () => {
    try {
      await app?.close()
    } finally {
      fetchRecorder?.restore()
      await database?.dispose()
    }
  })

  it('persists the approved live Gemini Socratic turn through the real HTTP path', async () => {
    await createEvidenceMaterial({
      title: 'Synthetic substitution checking guide',
      content: LIVE_E2E_MATERIAL,
    })
    const session = await createSession()

    const response = await request(requireApp().getHttpServer())
      .post(messagesPath(session.id))
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        content: LIVE_E2E_QUESTION,
        clientMessageId: randomUUID(),
      })
      .expect(201)
    const turn = response.body as GroundedChatTurnResponseDto

    expect(turn.studentMessage).toMatchObject({
      sequence: 1,
      content: LIVE_E2E_QUESTION,
      status: 'COMPLETED',
    })
    expect(turn.assistantMessage).toMatchObject({
      sequence: 2,
      responseToMessageId: turn.studentMessage.id,
      status: 'COMPLETED',
      guidanceLabel: 'COURSE_GROUNDED',
    })
    expect(turn.assistantMessage.content.trim()).not.toBe('')

    const observedCalls = fetchRecorder?.calls() ?? []
    expect(observedCalls).toEqual(
      expect.arrayContaining([
        expectedProviderCall(
          env.ANALYSIS_MODEL_BASE_URL,
          env.ANALYSIS_MODEL_NAME,
        ),
        expectedProviderCall(env.TUTOR_MODEL_BASE_URL, env.TUTOR_MODEL_NAME),
        expectedProviderCall(
          env.SEMANTIC_GUARD_BASE_URL,
          env.SEMANTIC_GUARD_MODEL_NAME,
        ),
      ]),
    )

    const tutorTurns = await prisma.tutorTurn.findMany({
      where: { sessionId: session.id },
    })
    expect(tutorTurns).toHaveLength(1)
    const tutorTurn = tutorTurns[0]
    expect(tutorTurn.status).toBe(TutorTurnStatus.COMPLETED)
    expect(tutorTurn.failureCode).toBeNull()
    expect(tutorTurn.completedAt).not.toBeNull()
    expect(tutorTurn.studentMessageId).toBe(turn.studentMessage.id)
    expect(tutorTurn.approvedTutorMessageId).toBe(turn.assistantMessage.id)
    expect(tutorTurn.topicId).not.toBeNull()

    const analyses = await prisma.educationalAnalysis.findMany({
      where: { turnId: tutorTurn.id },
      include: {
        evidenceLinks: true,
        misconceptions: true,
      },
    })
    expect(analyses).toHaveLength(1)
    const [analysis] = analyses
    expect(analysis.analysisSource).toBe(EDUCATIONAL_ANALYSIS_SOURCE.MODEL)
    expect(analysis.fallbackReason).toBeNull()
    expect(analysis.failureCategory).toBeNull()
    expect(analysis.provider).toBe(OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER)
    expect(analysis.model).toBe(env.ANALYSIS_MODEL_NAME)
    expect(analysis.studentMessageId).toBe(turn.studentMessage.id)
    expect(analysis.topicId).toBe(tutorTurn.topicId)
    expect(analysis.confidence).toBeGreaterThanOrEqual(
      env.ANALYSIS_CONFIDENCE_THRESHOLD,
    )

    const teachingDecision = await prisma.teachingDecision.findUniqueOrThrow({
      where: { turnId: tutorTurn.id },
    })
    expect(teachingDecision.analysisId).toBe(analysis.id)
    expect(teachingDecision.topicId).toBe(tutorTurn.topicId)
    expect(teachingDecision.requireStudentAction).toBe(true)

    const storedAssistant = await prisma.message.findUniqueOrThrow({
      where: { id: turn.assistantMessage.id },
      include: {
        retrievals: { orderBy: { rank: 'asc' } },
        citations: { orderBy: { citationOrder: 'asc' } },
      },
    })
    expect(storedAssistant.status).toBe('COMPLETED')
    expect(storedAssistant.content).toBe(turn.assistantMessage.content)
    expect(storedAssistant.responseToMessageId).toBe(turn.studentMessage.id)
    expect(storedAssistant.turnId).toBe(tutorTurn.id)
    expect(storedAssistant.topicId).toBe(tutorTurn.topicId)
    expect(storedAssistant.guidanceLabel).toBe(
      MessageGuidanceLabel.COURSE_GROUNDED,
    )
    expect(storedAssistant.retrievals.length).toBeGreaterThanOrEqual(1)
    expect(storedAssistant.retrievals[0]?.rank).toBe(1)

    if (tutorTurn.safeFallbackUsed) {
      expect(storedAssistant.provider).toBeNull()
      expect(storedAssistant.model).toBeNull()
      expect(storedAssistant.promptVersion).toBe(SAFE_FALLBACK_PROMPT_VERSION)
      expect(storedAssistant.inputTokens).toBe(0)
      expect(storedAssistant.outputTokens).toBe(0)
      expect(storedAssistant.citations).toHaveLength(0)
    } else {
      expect(storedAssistant.provider).toBe(
        OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER,
      )
      expect(storedAssistant.model).toBe(env.TUTOR_MODEL_NAME)
      expect(storedAssistant.promptVersion).toBe(
        TUTOR_GENERATION_PROMPT_VERSION,
      )
      expect(storedAssistant.inputTokens).not.toBeNull()
      expect(storedAssistant.outputTokens).not.toBeNull()
    }

    await expect(
      prisma.message.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(2)
    await expect(
      prisma.message.count({
        where: {
          sessionId: session.id,
          role: 'ASSISTANT',
          status: { not: 'COMPLETED' },
        },
      }),
    ).resolves.toBe(0)

    process.stdout.write(
      `${JSON.stringify({
        outcome: 'success',
        scope: 'live-gemini-socratic-runtime-e2e',
        httpStatus: 201,
        tutorTurnStatus: tutorTurn.status,
        approvedResponseSource: tutorTurn.safeFallbackUsed
          ? 'SAFE_FALLBACK'
          : 'VALIDATED_CANDIDATE',
        persistedRecords: {
          messages: 2,
          tutorTurns: 1,
          educationalAnalyses: analyses.length,
          teachingDecisions: 1,
          retrievals: storedAssistant.retrievals.length,
          citations: storedAssistant.citations.length,
        },
        liveModelCalls: {
          analysis: countObservedModelCalls(
            observedCalls,
            env.ANALYSIS_MODEL_NAME,
          ),
          tutor: countObservedModelCalls(observedCalls, env.TUTOR_MODEL_NAME),
          semanticGuard: countObservedModelCalls(
            observedCalls,
            env.SEMANTIC_GUARD_MODEL_NAME,
          ),
        },
      })}\n`,
    )
  }, 180_000)

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
      .send({ title: 'Gemini Socratic runtime live E2E' })
      .expect(201)
    return (response.body as ChatSessionResponseDto).session
  }

  async function createEvidenceMaterial(input: {
    title: string
    content: string
  }): Promise<void> {
    const id = randomUUID()
    const chunkId = randomUUID()
    const storagePath = `gemini-socratic-runtime-live/${id}.pdf`
    const material = await prisma.material.create({
      data: {
        id,
        courseId: pythonCourseId,
        uploadedById: instructorId,
        title: input.title,
        originalFilename: `${id}.pdf`,
        storagePath,
        status: MaterialStatus.READY,
        extractedTextLength: input.content.length,
        chunkCount: 1,
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
        'gemini-socratic-live-e2e-embedding'
      )
    `)
    availableStoragePaths.add(storagePath)
  }
})

interface ObservedProviderCall {
  readonly endpoint: string
  readonly model: string
}

interface FetchRecorder {
  clear(): void
  calls(): readonly ObservedProviderCall[]
  restore(): void
}

function installFetchRecorder(): FetchRecorder {
  const originalFetch = globalThis.fetch
  const calls: ObservedProviderCall[] = []

  globalThis.fetch = async (input, init) => {
    recordOpenAICompatibleCall(calls, input, init)
    return originalFetch(input, init)
  }

  return {
    clear: () => {
      calls.length = 0
    },
    calls: () => [...calls],
    restore: () => {
      globalThis.fetch = originalFetch
    },
  }
}

function recordOpenAICompatibleCall(
  calls: ObservedProviderCall[],
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
): void {
  const endpoint = endpointFromFetchInput(input)
  const body = init?.body
  if (endpoint === null || typeof body !== 'string') {
    return
  }

  const model = modelFromBody(body)
  if (model === null) {
    return
  }

  calls.push({ endpoint, model })
}

function endpointFromFetchInput(
  input: Parameters<typeof fetch>[0],
): string | null {
  if (typeof input === 'string') {
    return input
  }
  if (input instanceof URL) {
    return input.toString()
  }
  return input.url
}

function modelFromBody(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body)
    return typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      typeof Reflect.get(parsed, 'model') === 'string'
      ? (Reflect.get(parsed, 'model') as string)
      : null
  } catch {
    return null
  }
}

function countObservedModelCalls(
  calls: readonly ObservedProviderCall[],
  model: string,
): number {
  return calls.filter((call) => call.model === model).length
}

function expectedProviderCall(
  baseUrl: string,
  model: string,
): ObservedProviderCall {
  return {
    endpoint: `${normalizeOpenAICompatibleBaseUrl(baseUrl)}/chat/completions`,
    model,
  }
}

function assertLiveGeminiRoleConfiguration(
  configuration: ReturnType<typeof validateEnv>,
): void {
  if (
    configuration.ANALYSIS_MODEL_PROVIDER !==
      OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER ||
    configuration.TUTOR_MODEL_PROVIDER !==
      OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER ||
    configuration.SEMANTIC_GUARD_PROVIDER !==
      OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER
  ) {
    throw new Error(
      'Live Socratic runtime E2E requires openai-compatible analysis, tutor, and semantic guard providers',
    )
  }

  for (const [name, model] of [
    ['ANALYSIS_MODEL_NAME', configuration.ANALYSIS_MODEL_NAME],
    ['TUTOR_MODEL_NAME', configuration.TUTOR_MODEL_NAME],
    ['SEMANTIC_GUARD_MODEL_NAME', configuration.SEMANTIC_GUARD_MODEL_NAME],
  ] as const) {
    if (!model.toLowerCase().includes('gemini')) {
      throw new Error(`${name} must reference a Gemini model`)
    }
  }
}
