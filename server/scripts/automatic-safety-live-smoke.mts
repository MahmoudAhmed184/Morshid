import { createHash } from 'node:crypto'

import { GoogleGenAI } from '@google/genai'
import { Logger } from '@nestjs/common'
import { config as loadEnv } from 'dotenv'

import { createCompletionProvider } from '../src/modules/completion/completion-provider.factory.js'
import { validateEnv } from '../src/modules/config/env.schema.js'
import {
  GEMINI_EMBEDDING_API_VERSION,
  type GeminiEmbeddingRequest,
} from '../src/modules/embedding/embedding-configuration.js'
import { createEmbeddingProvider } from '../src/modules/embedding/embedding-provider.factory.js'
import { AUTOMATIC_SAFETY_FIXTURES } from '../src/modules/output-policy/automatic-safety.fixtures.js'
import {
  serializeAutomaticSafetySmokeFailure,
  serializeAutomaticSafetySmokeSuccess,
  type AutomaticSafetySmokeStage,
} from '../src/modules/output-policy/automatic-safety-smoke-report.js'

loadEnv({ path: ['server/.env', '.env', '../.env'], quiet: true })
Logger.overrideLogger([])

let stage: AutomaticSafetySmokeStage = 'configuration'

async function main(): Promise<void> {
  if (process.env.AUTOMATIC_SAFETY_LIVE_SMOKE_ACKNOWLEDGED !== 'true') {
    throw new Error('Automatic safety live smoke is not acknowledged')
  }
  const env = validateEnv(process.env)
  if (
    env.COMPLETION_PROVIDER !== 'aws-bedrock' ||
    env.ITI_BEDROCK_GATEWAY_API_KEY === undefined ||
    env.EMBEDDING_PROVIDER !== 'gemini' ||
    env.GEMINI_EMBEDDING_API_KEY === undefined
  ) {
    throw new Error('Automatic safety live smoke configuration is incomplete')
  }

  const completion = createCompletionProvider({
    provider: 'aws-bedrock',
    timeoutMs: env.COMPLETION_TIMEOUT_MS,
    awsBedrock: {
      baseUrl: env.ITI_BEDROCK_GATEWAY_BASE_URL,
      apiKey: env.ITI_BEDROCK_GATEWAY_API_KEY,
      modelId: env.AWS_BEDROCK_MODEL_ID,
      allowedModelIds: env.AWS_BEDROCK_ALLOWED_MODEL_IDS,
      maxTokens: env.AWS_BEDROCK_MAX_TOKENS,
      allowInsecureHttp: env.ITI_BEDROCK_ALLOW_INSECURE_HTTP,
      environment: env.NODE_ENV,
    },
  })
  const sdk = new GoogleGenAI({
    apiKey: env.GEMINI_EMBEDDING_API_KEY,
    httpOptions: {
      apiVersion: GEMINI_EMBEDDING_API_VERSION,
      retryOptions: { attempts: 1 },
    },
  })
  const embedding = createEmbeddingProvider('gemini', {
    gemini: {
      client: {
        embedContent: (request: GeminiEmbeddingRequest) =>
          sdk.models.embedContent(request),
      },
      quota: { reserveGeneration: () => Promise.resolve() },
      options: {
        queryTimeoutMs: env.EMBEDDING_QUERY_TIMEOUT_MS,
        documentTimeoutMs: env.EMBEDDING_DOCUMENT_TIMEOUT_MS,
        requestTimeoutMs: env.EMBEDDING_REQUEST_TIMEOUT_MS,
      },
    },
  })

  stage = 'completion'
  const completions = []
  for (const fixture of AUTOMATIC_SAFETY_FIXTURES) {
    completions.push(
      await completion.complete({
        studentQuestion: fixture.studentQuestion,
        context: [
          {
            sourceTitle: 'Synthetic automatic safety fixture',
            chunkIndex: 0,
            content:
              'This synthetic context supports a small course-policy learning step only.',
          },
        ],
      }),
    )
  }

  stage = 'embedding'
  const vectors = []
  for (const fixture of AUTOMATIC_SAFETY_FIXTURES) {
    vectors.push(await embedding.embedQuery(fixture.studentQuestion))
  }

  stage = 'validation'
  const firstCompletion = completions.at(0)
  if (
    firstCompletion === undefined ||
    completions.some(
      (result) =>
        result.provider !== firstCompletion.provider ||
        result.model !== firstCompletion.model ||
        result.promptVersion !== firstCompletion.promptVersion ||
        result.content.trim().length === 0,
    ) ||
    vectors.some((vector) => vector.length === 0)
  ) {
    throw new Error('Automatic safety live smoke contract failed')
  }

  process.stdout.write(
    `${serializeAutomaticSafetySmokeSuccess({
      scenarioIds: AUTOMATIC_SAFETY_FIXTURES.map(({ id }) => id),
      completionProvider: firstCompletion.provider,
      completionModel: firstCompletion.model,
      promptVersion: firstCompletion.promptVersion,
      embeddingProvider: 'gemini',
      embeddingModel: embedding.model,
      embeddingProtocol: embedding.queryProtocol,
      fixtureHash: `sha256:${createHash('sha256')
        .update(JSON.stringify(AUTOMATIC_SAFETY_FIXTURES))
        .digest('hex')}`,
      completionCount: completions.length,
      embeddingCount: vectors.length,
    })}\n`,
  )
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${serializeAutomaticSafetySmokeFailure(stage, error)}\n`,
  )
  process.exitCode = 1
})
