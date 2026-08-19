import { ConfigModule, ConfigService } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'

import { ConversationPresentationModule } from '../../../application/conversation-presentation.module'
import { RedisService } from '../../../platform/cache/redis.service'
import { PrismaService } from '../../../platform/database/prisma.service'
import {
  ANALYSIS_MODEL_PORT,
  type AnalysisModelPort,
  type AnalysisModelRequest,
} from './analysis/analysis-model.port'
import { EDUCATIONAL_ANALYSIS_PROMPT_VERSION } from './analysis/educational-analysis.prompt'
import {
  DEBUGGING_DIAGNOSIS_MODEL_PORT,
  DEBUGGING_DIAGNOSIS_MODEL_PROMPT_VERSION,
  type DebuggingDiagnosisModelPort,
  type DebuggingDiagnosisModelRequest,
} from './debugging-guidance/debugging-diagnosis-model.port'
import {
  SEMANTIC_GUARD_PORT,
  SEMANTIC_GUARD_PROMPT_VERSION,
  type SemanticGuardPort,
  type SemanticGuardRequest,
} from './response-approval/semantic-guard.types'
import { SocraticWorkflowModule } from './socratic-workflow.module'
import {
  TUTOR_MODEL_PORT,
  type TutorModelPort,
  type TutorModelRequest,
} from './generation/tutor-generation.types'
import { TUTOR_GENERATION_PROMPT_VERSION } from './generation/tutor-prompt.definition'

const pooledApiKey = 'first-secret-api-key-value'
const geminiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai'

describe('SocraticWorkflowModule Gemini composition', () => {
  it('routes analysis, diagnosis, tutor, and semantic guard through the shared project pool', async () => {
    const redisEval = jest.fn(() => Promise.resolve([1, '0']))
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((_input, init) =>
        Promise.resolve(chatCompletion(modelFrom(init))),
      )
    let moduleRef: TestingModule | undefined

    try {
      moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true }),
          ConversationPresentationModule,
          SocraticWorkflowModule,
        ],
      })
        .overrideProvider(PrismaService)
        .useValue({})
        .overrideProvider(RedisService)
        .useValue({
          getClient: () => ({ eval: redisEval }),
        })
        .overrideProvider(ConfigService)
        .useValue({ get: readGeminiConfiguration })
        .compile()

      await moduleRef
        .get<AnalysisModelPort>(ANALYSIS_MODEL_PORT)
        .analyze(analysisRequest)
      await moduleRef
        .get<DebuggingDiagnosisModelPort>(DEBUGGING_DIAGNOSIS_MODEL_PORT)
        .diagnose(debuggingDiagnosisRequest)
      await moduleRef
        .get<TutorModelPort>(TUTOR_MODEL_PORT)
        .generate(tutorRequest)
      await moduleRef
        .get<SemanticGuardPort>(SEMANTIC_GUARD_PORT)
        .evaluate(semanticGuardRequest)

      expect(fetchSpy).toHaveBeenCalledTimes(4)
      expect(redisEval).toHaveBeenCalledTimes(4)
      for (const call of fetchSpy.mock.calls) {
        expect(new Headers(call[1]?.headers).get('Authorization')).toBe(
          `Bearer ${pooledApiKey}`,
        )
      }
      expect(requestBody(fetchSpy.mock.calls[0]?.[1])).toMatchObject({
        model: 'gemini-3.5-flash',
        temperature: 0,
        top_p: 1,
      })
      expect(requestBody(fetchSpy.mock.calls[1]?.[1])).toMatchObject({
        model: 'gemini-3.4-flash',
        temperature: 0,
        top_p: 1,
      })
      expect(requestBody(fetchSpy.mock.calls[2]?.[1])).toMatchObject({
        model: 'gemini-3.6-flash',
      })
      expect(requestBody(fetchSpy.mock.calls[2]?.[1])).not.toHaveProperty(
        'temperature',
      )
      expect(requestBody(fetchSpy.mock.calls[2]?.[1])).not.toHaveProperty(
        'top_p',
      )
      expect(requestBody(fetchSpy.mock.calls[3]?.[1])).toMatchObject({
        model: 'gemini-3.5-flash-lite',
        max_completion_tokens: 2048,
        temperature: 0,
        top_p: 1,
      })
    } finally {
      await moduleRef?.close()
      fetchSpy.mockRestore()
    }
  })
})

const analysisRequest = Object.freeze<AnalysisModelRequest>({
  messages: Object.freeze([
    Object.freeze({ role: 'system', content: 'trusted analysis prompt' }),
    Object.freeze({
      role: 'user',
      content: '{"studentMessage":{"id":"message-22"}}',
    }),
  ]),
  promptVersion: EDUCATIONAL_ANALYSIS_PROMPT_VERSION,
  responseSchemaName: 'EducationalAnalysisResult',
})

const tutorRequest = Object.freeze<TutorModelRequest>({
  messages: Object.freeze([
    Object.freeze({ role: 'system', content: 'trusted tutor prompt' }),
    Object.freeze({
      role: 'user',
      content: '{"allowedCitationIds":["retrieval.rank.1"]}',
    }),
  ]),
  promptVersion: TUTOR_GENERATION_PROMPT_VERSION,
  responseSchemaName: 'CandidateResponse',
})

const debuggingDiagnosisRequest = Object.freeze<DebuggingDiagnosisModelRequest>(
  {
    messages: Object.freeze([
      Object.freeze({ role: 'system', content: 'trusted diagnosis prompt' }),
      Object.freeze({
        role: 'user',
        content: '{"code":"x = 1","symptom":"wrong value","codeLineCount":1}',
      }),
    ]),
    promptVersion: DEBUGGING_DIAGNOSIS_MODEL_PROMPT_VERSION,
    responseSchemaName: 'DebuggingDiagnosisResult',
  },
)

const semanticGuardRequest = Object.freeze<SemanticGuardRequest>({
  messages: Object.freeze([
    Object.freeze({ role: 'system', content: 'trusted guard prompt' }),
    Object.freeze({
      role: 'user',
      content: '{"candidate":{"message":"What changes first?"}}',
    }),
  ]),
  promptVersion: SEMANTIC_GUARD_PROMPT_VERSION,
  responseSchemaName: 'SemanticGuardResult',
})

function readGeminiConfiguration(key: string): unknown {
  const values: Readonly<Record<string, unknown>> = {
    NODE_ENV: 'test',
    REDIS_URL: 'redis://localhost:6379',
    PDF_STORAGE_PATH: '../storage/pdfs',
    EMBEDDING_PROVIDER: 'deterministic',
    EMBEDDING_QUERY_TIMEOUT_MS: 10_000,
    EMBEDDING_DOCUMENT_TIMEOUT_MS: 120_000,
    EMBEDDING_REQUEST_TIMEOUT_MS: 30_000,
    PDF_MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
    RETRIEVAL_TOP_K: 5,
    RETRIEVAL_MIN_SIMILARITY: 0.62,
    TUTORING_REQUEST_TIMEOUT_MS: 120_000,
    GEMINI_CHAT_PROJECTS_JSON: JSON.stringify([
      { id: 'chat-project-01', apiKey: pooledApiKey },
    ]),
    ANALYSIS_MODEL_PROVIDER: 'openai-compatible',
    ANALYSIS_MODEL_BASE_URL: geminiBaseUrl,
    ANALYSIS_MODEL_NAME: 'gemini-3.5-flash',
    ANALYSIS_MODEL_API_KEY: '',
    ANALYSIS_MODEL_TIMEOUT_MS: 30_000,
    ANALYSIS_MODEL_MAX_COMPLETION_TOKENS: 2048,
    ANALYSIS_MODEL_MAX_RETRIES: 0,
    ANALYSIS_CONFIDENCE_THRESHOLD: 0.2,
    DEBUGGING_DIAGNOSIS_MODEL_PROVIDER: 'openai-compatible',
    DEBUGGING_DIAGNOSIS_MODEL_BASE_URL: geminiBaseUrl,
    DEBUGGING_DIAGNOSIS_MODEL_NAME: 'gemini-3.4-flash',
    DEBUGGING_DIAGNOSIS_MODEL_API_KEY: '',
    DEBUGGING_DIAGNOSIS_MODEL_TIMEOUT_MS: 30_000,
    DEBUGGING_DIAGNOSIS_MODEL_MAX_COMPLETION_TOKENS: 1024,
    DEBUGGING_DIAGNOSIS_MODEL_MAX_RETRIES: 0,
    TUTOR_MODEL_PROVIDER: 'openai-compatible',
    TUTOR_MODEL_BASE_URL: geminiBaseUrl,
    TUTOR_MODEL_NAME: 'gemini-3.6-flash',
    TUTOR_MODEL_API_KEY: '',
    TUTOR_MODEL_TIMEOUT_MS: 30_000,
    TUTOR_MODEL_MAX_COMPLETION_TOKENS: 2048,
    TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES: 1,
    SEMANTIC_GUARD_PROVIDER: 'openai-compatible',
    SEMANTIC_GUARD_BASE_URL: geminiBaseUrl,
    SEMANTIC_GUARD_MODEL_NAME: 'gemini-3.5-flash-lite',
    SEMANTIC_GUARD_API_KEY: '',
    SEMANTIC_GUARD_TIMEOUT_MS: 30_000,
    SEMANTIC_GUARD_MAX_COMPLETION_TOKENS: 2048,
  }
  return values[key]
}

function modelFrom(init: RequestInit | undefined): string {
  const parsed = requestBody(init)
  const model: unknown = Reflect.get(parsed, 'model')
  if (typeof model !== 'string') {
    throw new TypeError('Expected a model name')
  }
  return model
}

function requestBody(init: RequestInit | undefined): Record<string, unknown> {
  if (typeof init?.body !== 'string') {
    throw new TypeError('Expected a JSON request body')
  }
  const parsed: unknown = JSON.parse(init.body)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new TypeError('Expected a JSON request object')
  }
  return parsed as Record<string, unknown>
}

function chatCompletion(model: string): Response {
  const content =
    model === 'gemini-3.5-flash'
      ? validAnalysis
      : model === 'gemini-3.4-flash'
        ? validDiagnosis
        : model === 'gemini-3.6-flash'
          ? validCandidate
          : validGuard
  return new Response(
    JSON.stringify({
      model,
      choices: [
        { message: { role: 'assistant', content: JSON.stringify(content) } },
      ],
    }),
    { status: 200 },
  )
}

const validAnalysis = Object.freeze({
  requestKind: 'CODE_DIAGNOSIS',
  studentState: 'DEBUGGING_ISSUE',
  effortEvidence: Object.freeze({
    present: true,
    quality: 'MEANINGFUL',
    type: 'CODE_ATTEMPT',
    addressesPreviousTutorAction: true,
    isRepeated: false,
    evidenceMessageIds: Object.freeze(['message-22']),
  }),
  learningEvidence: Object.freeze({
    present: false,
    strength: 'NONE',
    evidenceMessageIds: Object.freeze([]),
  }),
  misconceptions: Object.freeze([]),
  topicRelation: 'CONTINUE_CURRENT_TOPIC',
  recommendedStrategy: 'DEBUGGING_GUIDANCE',
  recommendedTechnique: 'TRACE_EXECUTION',
  recommendedGuidanceLevel: 2,
  confidence: 0.9,
  evidenceReferences: Object.freeze(['message-22']),
})

const validCandidate = Object.freeze({
  message: 'What changes after one loop iteration?',
  responseIntent: 'SOCRATIC_QUESTIONING',
  usedCitationIds: Object.freeze(['retrieval.rank.1']),
  requiresStudentAction: true,
  studentAction: Object.freeze({
    type: 'ORIENTATION_QUESTION',
    description: 'Ask the learner to inspect the loop update.',
  }),
  reflectionIncluded: false,
  selfReportedCompliance: Object.freeze({
    finalAnswerRevealed: false,
    completeSolutionRevealed: false,
  }),
})

const validDiagnosis = Object.freeze({
  status: 'RESOLVED',
  category: 'BOUNDARY',
  likelyDefect: 'The loop stops before checking the last relevant value.',
  location: Object.freeze({
    lineStart: 1,
    lineEnd: 1,
    kind: 'CODE',
  }),
  evidenceReferences: Object.freeze([
    Object.freeze({ source: 'CODE', lineStart: 1, lineEnd: 1 }),
    Object.freeze({ source: 'SYMPTOM', lineStart: null, lineEnd: null }),
  ]),
  underlyingConcept:
    'Loop boundary conditions control which values are visited.',
  requiresRuntimeEvidence: true,
  runtimeEvidenceNeeded: 'TRACE_VALUES',
  inspectionGoal: 'Trace which indices the loop visits.',
})

const validGuard = Object.freeze({
  approved: true,
  violations: Object.freeze([]),
})
