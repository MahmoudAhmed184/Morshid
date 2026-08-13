import { randomUUID } from 'node:crypto'

import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { config as loadEnv } from 'dotenv'
import request from 'supertest'
import type { App } from 'supertest/types'
import type * as AppModuleFile from '../../src/app.module.js'

import { configureApp } from '../../src/app.setup'
import {
  MaterialStatus,
  MessageGuidanceLabel,
  MessageRequestKind,
  MessageRole,
  Prisma,
  ReflectionMode,
  RevealPolicy,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
  TutoringAttemptStatus,
} from '../../src/generated/prisma/client'
import type { IdentitySessionResponse } from '../../src/modules/identity/identity.types'
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_PROVIDER_TOKEN,
  type EmbeddingProvider,
} from '../../src/platform/ai/embedding/embedding-provider'
import { MaterialProcessingScheduler } from '../../src/modules/materials/material-processing.scheduler'
import {
  PDF_STORAGE,
  type PdfStorage,
} from '../../src/platform/document-storage/pdf-storage'
import { PrismaService } from '../../src/platform/database/prisma.service'
import { RedisService } from '../../src/platform/cache/redis.service'
import type {
  ChatSessionResponseDto,
  TutoringTurnResponseDto,
} from '../../src/modules/conversations/interface/conversation-dto'
import { validateEnv } from '../../src/platform/config/env.schema'
import { parseTutoringConfiguration } from '../../src/modules/tutoring/tutoring.configuration'
import { CONFIG_ENV_FILE_PATHS } from '../../src/platform/config/configuration'
import {
  OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER,
  normalizeOpenAICompatibleBaseUrl,
} from '../../src/modules/tutoring/infrastructure/analysis-model.configuration'
import { OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER } from '../../src/modules/tutoring/infrastructure/tutor-model.configuration'
import { OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER } from '../../src/modules/tutoring/infrastructure/semantic-guard.configuration'
import { EDUCATIONAL_ANALYSIS_SOURCE } from '../../src/modules/tutoring/socratic-workflow/analysis/educational-analysis.types'
import { TUTOR_GENERATION_PROMPT_VERSION } from '../../src/modules/tutoring/socratic-workflow/generation/tutor-prompt.definition'
import { SAFE_FALLBACK_PROMPT_VERSION } from '../../src/modules/tutoring/socratic-workflow/response-approval/safe-fallback.service'
import { SemanticGuardService } from '../../src/modules/tutoring/socratic-workflow/response-approval/semantic-guard.service'
import {
  SEMANTIC_GUARD_PROMPT_VERSION,
  type SemanticGuardEvaluationInput,
} from '../../src/modules/tutoring/socratic-workflow/response-approval/semantic-guard.types'
import {
  RESPONSE_VALIDATION_ACTION,
  RESPONSE_VIOLATION_TYPE,
} from '../../src/modules/tutoring/socratic-workflow/response-approval/response-validation.types'
import { buildSocraticDisclosureContract } from '../../src/modules/tutoring/socratic-workflow/teaching-decision/socratic-disclosure-policy'
import type { TeachingGuardPolicy } from '../../src/modules/tutoring/socratic-workflow/teaching-decision/teaching-policy.types'
import type {
  CandidateResponse,
  TutorGuardEducationalContext,
} from '../../src/modules/tutoring/socratic-workflow/generation/tutor-generation.types'
import {
  P0_DEMO_PASSWORD,
  seedP0DemoData,
  type P0DemoSeedResult,
} from '../../src/seeds/p0-demo.seed'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from '../support/disposable-database'
import { NoopMaterialProcessingScheduler } from '../support/noop-material-processing-scheduler'

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
const OVER_REVEAL_CITATION_ID = 'retrieval.rank.1'
const OVER_REVEAL_STUDENT_MESSAGE =
  'I think iteration starts from the final item and moves backward.'
const OVER_REVEAL_EVIDENCE =
  'A standard Python for loop over a list visits the list elements in their written order, beginning at index 0 and continuing toward the final index.'
const QUERY_VECTOR = Object.freeze([
  1,
  ...Array<number>(EMBEDDING_DIMENSIONS - 1).fill(0),
])

const env = validateEnv(process.env)
const tutoringConfiguration = parseTutoringConfiguration(env)
assertLiveGeminiRoleConfiguration(tutoringConfiguration)

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
    database = await setUpDisposableDatabase('morshid_tutoring_live_e2e')
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
      await import('../../src/app.module.js')
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
        model: 'tutoring-live-e2e-embedding',
        queryProtocol: 'tutoring-live-e2e-query',
        embedQuery,
        embedDocuments: () =>
          Promise.reject(new Error('documents are not embedded in this spec')),
      } satisfies EmbeddingProvider)
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
    await prisma.guardResult.deleteMany()
    await prisma.tutoringCandidateAttempt.deleteMany()
    await prisma.tutoringAttempt.deleteMany()
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
    const turn = response.body as TutoringTurnResponseDto

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
          tutoringConfiguration.ANALYSIS_MODEL_BASE_URL,
          tutoringConfiguration.ANALYSIS_MODEL_NAME,
        ),
        expectedProviderCall(
          tutoringConfiguration.TUTOR_MODEL_BASE_URL,
          tutoringConfiguration.TUTOR_MODEL_NAME,
        ),
        expectedProviderCall(
          tutoringConfiguration.SEMANTIC_GUARD_BASE_URL,
          tutoringConfiguration.SEMANTIC_GUARD_MODEL_NAME,
        ),
      ]),
    )

    const tutoringAttempts = await prisma.tutoringAttempt.findMany({
      where: { sessionId: session.id },
    })
    expect(tutoringAttempts).toHaveLength(1)
    const tutoringAttempt = tutoringAttempts[0]
    expect(tutoringAttempt.status).toBe(TutoringAttemptStatus.COMPLETED)
    expect(tutoringAttempt.failureCode).toBeNull()
    expect(tutoringAttempt.completedAt).not.toBeNull()
    expect(tutoringAttempt.studentMessageId).toBe(turn.studentMessage.id)
    expect(tutoringAttempt.assistantMessageId).toBe(turn.assistantMessage.id)
    expect(tutoringAttempt.topicId).not.toBeNull()

    const analyses = await prisma.educationalAnalysis.findMany({
      where: { attemptId: tutoringAttempt.id },
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
    expect(analysis.model).toBe(tutoringConfiguration.ANALYSIS_MODEL_NAME)
    expect(analysis.studentMessageId).toBe(turn.studentMessage.id)
    expect(analysis.topicId).toBe(tutoringAttempt.topicId)
    expect(analysis.confidence).toBeGreaterThanOrEqual(
      tutoringConfiguration.ANALYSIS_CONFIDENCE_THRESHOLD,
    )

    const teachingDecision = await prisma.teachingDecision.findUniqueOrThrow({
      where: { attemptId: tutoringAttempt.id },
    })
    expect(teachingDecision.analysisId).toBe(analysis.id)
    expect(teachingDecision.topicId).toBe(tutoringAttempt.topicId)
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
    expect(storedAssistant.attemptId).toBe(tutoringAttempt.id)
    expect(storedAssistant.topicId).toBe(tutoringAttempt.topicId)
    expect(storedAssistant.guidanceLabel).toBe(
      MessageGuidanceLabel.COURSE_GROUNDED,
    )
    expect(storedAssistant.retrievals.length).toBeGreaterThanOrEqual(1)
    expect(storedAssistant.retrievals[0]?.rank).toBe(1)

    if (tutoringAttempt.safeFallbackUsed) {
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
      expect(storedAssistant.model).toBe(tutoringConfiguration.TUTOR_MODEL_NAME)
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
        scope: 'live-tutoring-runtime-e2e',
        httpStatus: 201,
        tutoringAttemptStatus: tutoringAttempt.status,
        approvedResponseSource: tutoringAttempt.safeFallbackUsed
          ? 'SAFE_FALLBACK'
          : 'VALIDATED_CANDIDATE',
        persistedRecords: {
          messages: 2,
          tutoringAttempts: 1,
          educationalAnalyses: analyses.length,
          teachingDecisions: 1,
          retrievals: storedAssistant.retrievals.length,
          citations: storedAssistant.citations.length,
        },
        liveModelCalls: {
          analysis: countObservedModelCalls(
            observedCalls,
            tutoringConfiguration.ANALYSIS_MODEL_NAME,
          ),
          tutor: countObservedModelCalls(
            observedCalls,
            tutoringConfiguration.TUTOR_MODEL_NAME,
          ),
          semanticGuard: countObservedModelCalls(
            observedCalls,
            tutoringConfiguration.SEMANTIC_GUARD_MODEL_NAME,
          ),
        },
      })}\n`,
    )
  }, 180_000)

  it('has the real Gemini Semantic Guard reject target-inference disclosure', async () => {
    const result = await requireApp()
      .get(SemanticGuardService)
      .evaluate(
        overRevealEvaluation(
          candidate({
            message:
              'Python iteration starts from the first element, not the last. Which element is first? [retrieval.rank.1]',
            studentActionDescription:
              'Identify the first element after the correction was stated.',
          }),
        ),
      )

    expect(result.kind).toBe('validated')
    expect(result.result).toMatchObject({
      approved: false,
      recommendedAction: RESPONSE_VALIDATION_ACTION.REGENERATE,
      provider: OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER,
      model: tutoringConfiguration.SEMANTIC_GUARD_MODEL_NAME,
      promptVersion: SEMANTIC_GUARD_PROMPT_VERSION,
    })
    expect(result.result.maximumSeverity).not.toBeNull()
    expect(result.result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: RESPONSE_VIOLATION_TYPE.DIRECT_ANSWER_DISCLOSURE,
        }),
      ]),
    )
    expect(
      countObservedModelCalls(
        fetchRecorder?.calls() ?? [],
        tutoringConfiguration.SEMANTIC_GUARD_MODEL_NAME,
      ),
    ).toBe(1)

    writeLiveGuardResult('negative', result.result)
  }, 90_000)

  it.each([
    {
      testCase: 'negative-ui-turn-3',
      message:
        'In Python, standard sequence iteration starts at the very beginning (index 0) and moves forward to the end. If you have [10, 20, 30], which value sits at index 0? [retrieval.rank.1]',
      studentActionDescription:
        'Identify the value at index 0 after the iteration order was stated.',
    },
    {
      testCase: 'negative-ui-turn-4',
      message:
        'Consider how Python accesses a list from left to right starting at index 0. In the list [10, 20, 30], which number is located at index 0? [retrieval.rank.1]',
      studentActionDescription:
        'Locate the value at index 0 after the access direction was stated.',
    },
  ])(
    'has the real Gemini Semantic Guard reject $testCase paraphrase',
    async ({ testCase, message, studentActionDescription }) => {
      const result = await requireApp()
        .get(SemanticGuardService)
        .evaluate(
          overRevealEvaluation(
            candidate({ message, studentActionDescription }),
          ),
        )

      expect(result.kind).toBe('validated')
      expect(result.result).toMatchObject({
        approved: false,
        maximumSeverity: 'HIGH',
        recommendedAction: RESPONSE_VALIDATION_ACTION.REGENERATE,
        provider: OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER,
        model: tutoringConfiguration.SEMANTIC_GUARD_MODEL_NAME,
        promptVersion: SEMANTIC_GUARD_PROMPT_VERSION,
      })
      expect(result.result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: RESPONSE_VIOLATION_TYPE.DIRECT_ANSWER_DISCLOSURE,
          }),
        ]),
      )
      expect(
        countObservedModelCalls(
          fetchRecorder?.calls() ?? [],
          tutoringConfiguration.SEMANTIC_GUARD_MODEL_NAME,
        ),
      ).toBe(1)

      writeLiveGuardResult(testCase, result.result)
    },
    90_000,
  )

  it('has the real Gemini Semantic Guard approve a bounded Socratic clue', async () => {
    const result = await requireApp()
      .get(SemanticGuardService)
      .evaluate(
        overRevealEvaluation(
          candidate({
            message:
              'Look at [5, 10, 15]. Which value is written at position 0? [retrieval.rank.1]',
            studentActionDescription:
              'Inspect the example and identify the value written at position 0.',
          }),
        ),
      )

    expect(result.kind).toBe('validated')
    expect(result.result).toMatchObject({
      approved: true,
      violations: [],
      maximumSeverity: null,
      recommendedAction: RESPONSE_VALIDATION_ACTION.APPROVE,
      provider: OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER,
      model: tutoringConfiguration.SEMANTIC_GUARD_MODEL_NAME,
      promptVersion: SEMANTIC_GUARD_PROMPT_VERSION,
    })
    expect(result.result.violations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: RESPONSE_VIOLATION_TYPE.DIRECT_ANSWER_DISCLOSURE,
        }),
      ]),
    )
    expect(
      countObservedModelCalls(
        fetchRecorder?.calls() ?? [],
        tutoringConfiguration.SEMANTIC_GUARD_MODEL_NAME,
      ),
    ).toBe(1)

    writeLiveGuardResult('positive', result.result)
  }, 90_000)

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
    return (response.body as IdentitySessionResponse).accessToken
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
    const storagePath = `tutoring-runtime-live/${id}.pdf`
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
        'tutoring-live-e2e-embedding'
      )
    `)
    availableStoragePaths.add(storagePath)
  }
})

const restrictiveOverRevealGuardPolicy: TeachingGuardPolicy = Object.freeze({
  preventDirectAnswer: true,
  preventFinalResult: true,
  preventCompleteSolution: true,
  preventSubmissionReadyCode: true,
  preventProtectedCodeLeakage: true,
  requireStudentReasoning: true,
  requireGrounding: true,
  enforceCitationSupport: true,
  maximumDisclosedSteps: 1,
})

const overRevealEducationalContext: TutorGuardEducationalContext =
  Object.freeze({
    currentStudentMessage: Object.freeze({
      id: 'live-over-reveal-student-message',
      content: OVER_REVEAL_STUDENT_MESSAGE,
    }),
    acceptedAnalysis: Object.freeze({
      id: 'live-over-reveal-analysis',
      requestKind: MessageRequestKind.CONCEPTUAL,
      studentState: StudentState.MISCONCEPTION,
      effortEvidence: Object.freeze({
        present: true,
        quality: 'MEANINGFUL' as const,
        type: 'REASONING_ATTEMPT' as const,
        addressesPreviousTutorAction: true,
        isRepeated: false,
        evidenceMessageIds: ['live-over-reveal-student-message'],
      }),
      learningEvidence: Object.freeze({
        present: false,
        strength: 'NONE' as const,
        evidenceMessageIds: [],
      }),
      misconceptions: [
        {
          code: 'REVERSE_ITERATION_MISCONCEPTION',
          description:
            'The student believes normal Python list iteration starts from the final item and moves backward.',
          confidence: 0.98,
          evidenceMessageId: 'live-over-reveal-student-message',
        },
      ],
      evidenceReferences: ['live-over-reveal-student-message'],
      confidence: 0.98,
      analysisSource: 'model',
      promptVersion: 'educational-analysis.v1',
      schemaVersion: 'educational-analysis.v1',
    }),
    topicState: null,
    previousTeachingDecision: null,
    currentTeachingDecision: Object.freeze({
      id: 'live-over-reveal-decision',
      policyVersion: 'socratic-policy.mvp.v2',
      guidanceLevel: 1,
      revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    }),
    recentConversation: Object.freeze([
      Object.freeze({
        id: 'live-over-reveal-previous-assistant',
        sequence: 1,
        role: MessageRole.ASSISTANT,
        attemptId: 'live-over-reveal-previous-turn',
        topicId: 'live-over-reveal-topic',
        content:
          'For x in [5, 10, 15], which value will x hold on the first iteration?',
      }),
    ]),
  })

function overRevealEvaluation(
  tutorCandidate: CandidateResponse,
): SemanticGuardEvaluationInput {
  const validationContext = {
    allowedCitationIds: new Set([OVER_REVEAL_CITATION_ID]),
    requireGrounding: true,
    enforceCitationSupport: true,
    requireStudentAction: true,
    reflectionMode: ReflectionMode.NONE,
    responseIntent: TeachingStrategy.MISCONCEPTION_REPAIR,
    primaryTechnique: TeachingTechnique.COUNTEREXAMPLE,
    guidanceLevel: 1,
    revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    maximumDisclosedSteps: 1,
  } as const
  const disclosureContract = buildSocraticDisclosureContract({
    guidanceLevel: validationContext.guidanceLevel,
    revealPolicy: validationContext.revealPolicy,
    guardPolicy: restrictiveOverRevealGuardPolicy,
  })
  expect(disclosureContract.directTargetInferenceAllowed).toBe(false)

  return {
    attemptId: 'live-over-reveal-turn',
    topicId: 'live-over-reveal-topic',
    courseId: 'live-over-reveal-course',
    candidateAttempt: 1,
    candidate: tutorCandidate,
    educationalContext: overRevealEducationalContext,
    validationContext,
    guardPolicy: restrictiveOverRevealGuardPolicy,
    allowedCitationSummaries: [
      {
        citationId: OVER_REVEAL_CITATION_ID,
        chunkId: 'live-over-reveal-chunk',
        materialId: 'live-over-reveal-material',
        materialTitle: 'Python iteration order',
        chunkIndex: 0,
        rank: 1,
        content: OVER_REVEAL_EVIDENCE,
      },
    ],
  }
}

function candidate(input: {
  readonly message: string
  readonly studentActionDescription: string
}): CandidateResponse {
  return {
    message: input.message,
    responseIntent: TeachingStrategy.MISCONCEPTION_REPAIR,
    usedCitationIds: [OVER_REVEAL_CITATION_ID],
    requiresStudentAction: true,
    studentAction: {
      type: TeachingTechnique.COUNTEREXAMPLE,
      description: input.studentActionDescription,
    },
    reflectionIncluded: false,
    selfReportedCompliance: {
      finalAnswerRevealed: false,
      completeSolutionRevealed: false,
    },
    provider: 'live-regression-fixture',
    model: 'live-regression-fixture',
    promptVersion: TUTOR_GENERATION_PROMPT_VERSION,
    tokenUsage: { input: 0, output: 0 },
  }
}

function writeLiveGuardResult(
  testCase: string,
  result: Awaited<ReturnType<SemanticGuardService['evaluate']>>['result'],
): void {
  process.stdout.write(
    `${JSON.stringify({
      scope: 'live-gemini-semantic-guard-over-reveal',
      testCase,
      approved: result.approved,
      violationTypes: result.violations.map((violation) => violation.type),
      maximumSeverity: result.maximumSeverity,
      recommendedAction: result.recommendedAction,
      provider: result.provider,
      model: result.model,
      promptVersion: result.promptVersion,
    })}\n`,
  )
}

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
  configuration: ReturnType<typeof parseTutoringConfiguration>,
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
