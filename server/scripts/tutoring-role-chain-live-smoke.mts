import { config as loadEnv } from 'dotenv'
import { createClient } from 'redis'

import { validateEnv } from '../src/platform/config/env.schema.js'
import { GeminiChatProjectPool } from '../src/platform/ai/upstream/gemini-chat-project-pool.js'
import {
  createGeminiPooledFetch,
  resolveChatTransport,
} from '../src/platform/ai/upstream/gemini-pooled-fetch.js'
import type { FetchImplementation } from '../src/platform/ai/upstream/structured-chat.transport.js'
import { parseTutoringConfiguration } from '../src/modules/tutoring/tutoring.configuration.js'
import { OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER } from '../src/modules/tutoring/infrastructure/analysis-model.configuration.js'
import { createAnalysisModelPort } from '../src/modules/tutoring/infrastructure/analysis-model.provider.js'
import { buildEducationalAnalysisModelRequest } from '../src/modules/tutoring/socratic-workflow/analysis/educational-analysis.prompt.js'
import { validateEducationalAnalysisResult } from '../src/modules/tutoring/socratic-workflow/analysis/educational-analysis.validator.js'
import { OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER } from '../src/modules/tutoring/infrastructure/tutor-model.configuration.js'
import { createTutorModelPort } from '../src/modules/tutoring/infrastructure/tutor-model.adapter.js'
import {
  buildGenerationContextPackage,
  guardEducationalContextFromGenerationContext,
} from '../src/modules/tutoring/socratic-workflow/generation/tutor-generation-context.js'
import { buildTutorGenerationModelRequest } from '../src/modules/tutoring/socratic-workflow/generation/tutor-prompt.builder.js'
import { validateCandidateResponse } from '../src/modules/tutoring/socratic-workflow/generation/tutor-candidate.schema.js'
import { OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER } from '../src/modules/tutoring/infrastructure/semantic-guard.configuration.js'
import { createSemanticGuardPort } from '../src/modules/tutoring/infrastructure/semantic-guard.adapter.js'
import { SemanticGuardService } from '../src/modules/tutoring/socratic-workflow/response-approval/semantic-guard.service.js'
import {
  SEMANTIC_GUARD_ERROR_CODE,
  SemanticGuardModelError,
  type SemanticGuardPort,
} from '../src/modules/tutoring/socratic-workflow/response-approval/semantic-guard.types.js'
import { RESPONSE_VALIDATION_ACTION } from '../src/modules/tutoring/socratic-workflow/response-approval/response-validation.types.js'
import {
  TUTORING_ROLE_CHAIN_ANALYSIS_CONTEXT,
  TUTORING_ROLE_CHAIN_LIVE_IDS,
  TUTORING_ROLE_CHAIN_RETRIEVED_CHUNKS,
  buildLivePersistedAnalysis,
  buildLiveTeachingDecision,
} from '../test/fixtures/tutoring-role-chain-live.fixture.js'

// Live Socratic role-chain integration smoke, not a full application E2E test.
// It exercises the real Analysis, Tutor, and Semantic Guard provider adapters
// plus downstream validation using synthetic context, teaching decision, and
// retrieval fixtures. It intentionally skips HTTP orchestration and persistence.

loadEnv({
  path: ['server/.env', '.env', '../.env'],
  quiet: true,
})

interface RoleReport {
  readonly provider: string
  readonly configuredModel: string
  readonly observedModel: string
  readonly promptVersion: string
  readonly inputTokens: number | null
  readonly outputTokens: number | null
  readonly validation: 'passed'
}

class SmokeFailure extends Error {
  constructor(readonly code: string) {
    super(code)
    Object.defineProperty(this, 'name', {
      configurable: true,
      value: 'SmokeFailure',
    })
  }
}

async function main(): Promise<void> {
  const appEnvironment = validateEnv(process.env)
  const env = parseTutoringConfiguration(appEnvironment)
  assertLiveRoleConfiguration(env)
  const geminiRuntime = await createLiveGeminiRuntime(
    appEnvironment.REDIS_URL,
    env,
  )

  try {
    const analysisTransport = resolveChatTransport(
      env.ANALYSIS_MODEL_BASE_URL,
      env.ANALYSIS_MODEL_API_KEY,
      geminiRuntime.fetch,
    )
    const tutorTransport = resolveChatTransport(
      env.TUTOR_MODEL_BASE_URL,
      env.TUTOR_MODEL_API_KEY,
      geminiRuntime.fetch,
    )
    const semanticGuardTransport = resolveChatTransport(
      env.SEMANTIC_GUARD_BASE_URL,
      env.SEMANTIC_GUARD_API_KEY,
      geminiRuntime.fetch,
    )
    const analysisPort = createAnalysisModelPort(
      {
        provider: OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER,
        timeoutMs: env.ANALYSIS_MODEL_TIMEOUT_MS,
        openAICompatible: {
          baseUrl: env.ANALYSIS_MODEL_BASE_URL,
          modelName: env.ANALYSIS_MODEL_NAME,
          apiKey: analysisTransport.apiKey,
          maxCompletionTokens: env.ANALYSIS_MODEL_MAX_COMPLETION_TOKENS,
        },
      },
      undefined,
      analysisTransport.fetchImplementation,
    )
    const tutorPort = createTutorModelPort(
      {
        provider: OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER,
        timeoutMs: env.TUTOR_MODEL_TIMEOUT_MS,
        openAICompatible: {
          baseUrl: env.TUTOR_MODEL_BASE_URL,
          modelName: env.TUTOR_MODEL_NAME,
          apiKey: tutorTransport.apiKey,
          maxCompletionTokens: env.TUTOR_MODEL_MAX_COMPLETION_TOKENS,
        },
      },
      undefined,
      tutorTransport.fetchImplementation,
    )
    const semanticGuardPort = createSemanticGuardPort(
      {
        provider: OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER,
        timeoutMs: env.SEMANTIC_GUARD_TIMEOUT_MS,
        openAICompatible: {
          baseUrl: env.SEMANTIC_GUARD_BASE_URL,
          modelName: env.SEMANTIC_GUARD_MODEL_NAME,
          apiKey: semanticGuardTransport.apiKey,
          maxCompletionTokens: env.SEMANTIC_GUARD_MAX_COMPLETION_TOKENS,
        },
      },
      undefined,
      semanticGuardTransport.fetchImplementation,
    )

    const analysisResponse = await analysisPort.analyze(
      buildEducationalAnalysisModelRequest(
        TUTORING_ROLE_CHAIN_ANALYSIS_CONTEXT,
      ),
    )
    const analysisValidation = validateEducationalAnalysisResult(
      analysisResponse.rawOutput,
      TUTORING_ROLE_CHAIN_ANALYSIS_CONTEXT,
    )
    if (!analysisValidation.success) {
      throw new SmokeFailure('ANALYSIS_DOWNSTREAM_VALIDATION_FAILED')
    }

    const acceptedAnalysis = buildLivePersistedAnalysis(
      analysisValidation.data,
      analysisResponse,
    )
    const teachingDecision = buildLiveTeachingDecision(acceptedAnalysis.id)
    const generationContext = buildGenerationContextPackage({
      analysisContext: TUTORING_ROLE_CHAIN_ANALYSIS_CONTEXT,
      acceptedAnalysis,
      teachingDecision,
      previousTeachingDecision: null,
      retrievedChunks: TUTORING_ROLE_CHAIN_RETRIEVED_CHUNKS,
    })
    if (!generationContext.success) {
      throw new SmokeFailure('GENERATION_CONTEXT_INVALID')
    }

    const tutorResponse = await tutorPort.generate(
      buildTutorGenerationModelRequest(generationContext.context),
    )
    const candidateValidation = validateCandidateResponse(
      tutorResponse.rawOutput,
      {
        allowedCitationIds: new Set(
          generationContext.context.allowedCitationIds,
        ),
        requireGrounding: teachingDecision.guardPolicy.requireGrounding,
        enforceCitationSupport:
          teachingDecision.guardPolicy.enforceCitationSupport,
        requireStudentAction: teachingDecision.requireStudentAction,
        reflectionMode: teachingDecision.reflectionMode,
      },
      {
        provider: tutorResponse.provider,
        model: tutorResponse.model,
        tokenUsage: {
          input: tutorResponse.inputTokens ?? 0,
          output: tutorResponse.outputTokens ?? 0,
        },
      },
    )
    if (!candidateValidation.success) {
      throw new SmokeFailure(candidateValidation.errorCode)
    }

    const semanticGuardService = new SemanticGuardService(semanticGuardPort)
    const semanticResult = await semanticGuardService.evaluate({
      attemptId: TUTORING_ROLE_CHAIN_LIVE_IDS.attemptId,
      topicId: TUTORING_ROLE_CHAIN_LIVE_IDS.topicId,
      courseId: TUTORING_ROLE_CHAIN_LIVE_IDS.courseId,
      candidateAttempt: 1,
      candidate: candidateValidation.data,
      educationalContext: guardEducationalContextFromGenerationContext(
        generationContext.context,
      ),
      validationContext: {
        allowedCitationIds: new Set(
          generationContext.context.allowedCitationIds,
        ),
        requireGrounding: teachingDecision.guardPolicy.requireGrounding,
        enforceCitationSupport:
          teachingDecision.guardPolicy.enforceCitationSupport,
        requireStudentAction: teachingDecision.requireStudentAction,
        reflectionMode: teachingDecision.reflectionMode,
        responseIntent: teachingDecision.strategy,
        primaryTechnique: teachingDecision.primaryTechnique,
        guidanceLevel: teachingDecision.guidanceLevel,
        revealPolicy: teachingDecision.revealPolicy,
        maximumDisclosedSteps:
          teachingDecision.guardPolicy.maximumDisclosedSteps,
      },
      guardPolicy: teachingDecision.guardPolicy,
      allowedCitationSummaries: generationContext.context.retrievedEvidence,
    })
    if (semanticResult.kind !== 'validated') {
      throw new SmokeFailure(semanticResult.errorCode)
    }
    if (semanticResult.result.model === null) {
      throw new SmokeFailure('SEMANTIC_GUARD_MODEL_METADATA_MISSING')
    }

    const fallback = await new SemanticGuardService(
      failingSemanticGuardPort(),
    ).evaluate({
      attemptId: TUTORING_ROLE_CHAIN_LIVE_IDS.attemptId,
      topicId: TUTORING_ROLE_CHAIN_LIVE_IDS.topicId,
      courseId: TUTORING_ROLE_CHAIN_LIVE_IDS.courseId,
      candidateAttempt: 1,
      candidate: candidateValidation.data,
      educationalContext: guardEducationalContextFromGenerationContext(
        generationContext.context,
      ),
      validationContext: {
        allowedCitationIds: new Set(
          generationContext.context.allowedCitationIds,
        ),
        requireGrounding: teachingDecision.guardPolicy.requireGrounding,
        enforceCitationSupport:
          teachingDecision.guardPolicy.enforceCitationSupport,
        requireStudentAction: teachingDecision.requireStudentAction,
        reflectionMode: teachingDecision.reflectionMode,
        responseIntent: teachingDecision.strategy,
        primaryTechnique: teachingDecision.primaryTechnique,
        guidanceLevel: teachingDecision.guidanceLevel,
        revealPolicy: teachingDecision.revealPolicy,
        maximumDisclosedSteps:
          teachingDecision.guardPolicy.maximumDisclosedSteps,
      },
      guardPolicy: teachingDecision.guardPolicy,
      allowedCitationSummaries: generationContext.context.retrievedEvidence,
    })
    if (
      fallback.kind !== 'infrastructure_failure' ||
      fallback.result.recommendedAction !==
        RESPONSE_VALIDATION_ACTION.USE_SAFE_FALLBACK
    ) {
      throw new SmokeFailure('SEMANTIC_GUARD_FALLBACK_FAILED')
    }

    process.stdout.write(
      `${JSON.stringify({
        outcome: 'success',
        scope: 'live-socratic-role-chain-integration-smoke',
        pipeline: 'analysis-tutor-semantic-guard',
        roles: {
          analysis: roleReport({
            provider: analysisResponse.provider,
            configuredModel: env.ANALYSIS_MODEL_NAME,
            observedModel: analysisResponse.model,
            promptVersion: analysisResponse.promptVersion,
            inputTokens: analysisResponse.inputTokens,
            outputTokens: analysisResponse.outputTokens,
          }),
          tutor: roleReport({
            provider: tutorResponse.provider,
            configuredModel: env.TUTOR_MODEL_NAME,
            observedModel: tutorResponse.model,
            promptVersion: tutorResponse.promptVersion,
            inputTokens: tutorResponse.inputTokens,
            outputTokens: tutorResponse.outputTokens,
          }),
          semanticGuard: roleReport({
            provider: semanticResult.result.provider ?? 'unknown',
            configuredModel: env.SEMANTIC_GUARD_MODEL_NAME,
            observedModel: semanticResult.result.model,
            promptVersion: semanticResult.result.promptVersion ?? 'unknown',
            inputTokens: null,
            outputTokens: null,
          }),
        },
        semanticGuardApproved: semanticResult.result.approved,
        semanticGuardFallback: {
          kind: fallback.kind,
          errorCode: fallback.errorCode,
          recommendedAction: fallback.result.recommendedAction,
        },
      })}\n`,
    )
  } finally {
    await geminiRuntime.close()
  }
}

interface LiveGeminiRuntime {
  readonly fetch: FetchImplementation | null
  close(): Promise<void>
}

async function createLiveGeminiRuntime(
  redisUrl: string,
  env: ReturnType<typeof parseTutoringConfiguration>,
): Promise<LiveGeminiRuntime> {
  if (env.GEMINI_CHAT_PROJECTS_JSON.length === 0) {
    return {
      fetch: null,
      close: () => Promise.resolve(),
    }
  }

  const redis = createClient({ url: redisUrl })
  await redis.connect()
  const pool = new GeminiChatProjectPool(
    {
      eval: (script, options) =>
        redis.eval(script, {
          keys: [...options.keys],
          arguments: [...options.arguments],
        }),
    },
    env.GEMINI_CHAT_PROJECTS_JSON,
  )
  return {
    fetch: createGeminiPooledFetch(pool),
    close: () => redis.quit().then(() => undefined),
  }
}

function assertLiveRoleConfiguration(
  env: ReturnType<typeof parseTutoringConfiguration>,
): void {
  if (
    env.ANALYSIS_MODEL_PROVIDER !== OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER
  ) {
    throw new SmokeFailure('ANALYSIS_MODEL_PROVIDER_NOT_LIVE')
  }
  if (env.TUTOR_MODEL_PROVIDER !== OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER) {
    throw new SmokeFailure('TUTOR_MODEL_PROVIDER_NOT_LIVE')
  }
  if (
    env.SEMANTIC_GUARD_PROVIDER !== OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER
  ) {
    throw new SmokeFailure('SEMANTIC_GUARD_PROVIDER_NOT_LIVE')
  }
}

function roleReport(input: {
  readonly provider: string
  readonly configuredModel: string
  readonly observedModel: string
  readonly promptVersion: string
  readonly inputTokens?: number | null
  readonly outputTokens?: number | null
}): RoleReport {
  return {
    ...input,
    inputTokens: input.inputTokens ?? null,
    outputTokens: input.outputTokens ?? null,
    validation: 'passed',
  }
}

function failingSemanticGuardPort(): SemanticGuardPort {
  return {
    evaluate: () =>
      Promise.reject(
        new SemanticGuardModelError(
          SEMANTIC_GUARD_ERROR_CODE.TRANSPORT_FAILURE,
        ),
      ),
  }
}

function describeFailure(error: unknown): string {
  return JSON.stringify({
    outcome: 'failure',
    error:
      error instanceof Error && error.name !== '' ? error.name : typeof error,
    code:
      error instanceof SmokeFailure
        ? error.code
        : error instanceof SemanticGuardModelError
          ? error.code
          : null,
  })
}

main().catch((error: unknown) => {
  process.stderr.write(`${describeFailure(error)}\n`)
  process.exitCode = 1
})
