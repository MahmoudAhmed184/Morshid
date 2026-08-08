/**
 * Guarded live-completion validation for the canonical Python diagnosis.
 *
 * This command embeds the canonical diagnosis query and two candidate course
 * excerpts through the production Gemini embedding adapter, selects the most
 * similar excerpt, makes one real Gemini completion request through the
 * production completion adapter, then applies the production output guard.
 *
 * Required environment:
 *   COMPLETION_PROVIDER=gemini
 *   EMBEDDING_PROVIDER=gemini
 *   GEMINI_API_KEY=<real key>
 *   GEMINI_EMBEDDING_API_KEY=<separate real key>
 *   GEMINI_MODEL=<allowed model>
 *   REDIS_URL=<running Redis>
 *   GEMINI_* quota limits and COMPLETION_TIMEOUT_MS
 *
 * Opt-in: npm run test:live-diagnosis --workspace server
 * Skip behavior: exits 0 with a skip message when the live configuration is
 * unavailable. It never records a credential, prompt, context, or response.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { GoogleGenAI } from '@google/genai'
import { Logger } from '@nestjs/common'
import { config as loadEnv } from 'dotenv'
import { createClient } from 'redis'

import { validateEnv } from '../src/modules/config/env.schema.js'
import type { CompletionProvider } from '../src/modules/completion/completion-provider.js'
import {
  GeminiCompletionAdapter,
  createGeminiCompletionClient,
} from '../src/modules/completion/providers/gemini/gemini-completion.adapter.js'
import { GeminiQuotaService } from '../src/modules/completion/providers/gemini/gemini-quota.service.js'
import { ValidatedCompletionProvider } from '../src/modules/completion/validated-completion.provider.js'
import {
  GEMINI_EMBEDDING_API_VERSION,
  type GeminiEmbeddingRequest,
} from '../src/modules/embedding/embedding-configuration.js'
import { createEmbeddingProvider } from '../src/modules/embedding/embedding-provider.factory.js'
import {
  EMBEDDING_DIMENSIONS,
  type EmbeddingProvider,
} from '../src/modules/embedding/embedding-provider.js'
import {
  type PythonCodeDiagnosisFixture,
  materializePythonCodeDiagnosisFixtureInput,
  parsePythonCodeDiagnosisFixtureDataset,
} from '../src/modules/tutor/code-diagnosis/python-code-diagnosis.fixture.js'
import { validatePythonCodeDiagnosisOutput } from '../src/modules/tutor/code-diagnosis/python-code-diagnosis.output-guard.js'
import { selectTutorStrategy } from '../src/modules/tutor/tutor-decision.js'

loadEnv({
  path: ['server/.env', '.env', '../.env'],
  quiet: true,
})

Logger.overrideLogger([])

const REDACTED = '[redacted]'
const CANONICAL_FIXTURE_ID = 'gd-p0-v1-058'
const MIN_SEMANTIC_MARGIN = 0.05
const sensitiveRuntimeValues = new Set<string>()
const fixturePath = resolve(
  process.cwd(),
  '..',
  'fixtures',
  'golden-dataset',
  'python-code-diagnosis-p0.json',
)
const LIVE_CANDIDATES = Object.freeze([
  Object.freeze({
    sourceTitle: 'Live qualification: Python functions and scope',
    chunkIndex: 0,
    content:
      'Python resolves names in the active function scope. A parameter name must match the name referenced by an expression.',
  }),
  Object.freeze({
    sourceTitle: 'Live qualification: Python file handling',
    chunkIndex: 1,
    content:
      'Text files can be opened with an explicit encoding and closed by a context manager.',
  }),
])

interface LiveGeminiConfiguration {
  readonly apiKey: string
  readonly embeddingApiKey: string
  readonly model: string
  readonly redisUrl: string
  readonly timeoutMs: number
  readonly requestsPerMinute: number
  readonly inputTokensPerMinute: number
  readonly requestsPerHour: number
  readonly requestsPerDay: number
  readonly requestsPerMonth: number
  readonly embeddingQueryTimeoutMs: number
  readonly embeddingDocumentTimeoutMs: number
  readonly embeddingRequestTimeoutMs: number
}

function getLiveConfiguration():
  | { readonly kind: 'ready'; readonly configuration: LiveGeminiConfiguration }
  | { readonly kind: 'skipped'; readonly reason: string } {
  try {
    const env = validateEnv(process.env)
    if (env.COMPLETION_PROVIDER !== 'gemini') {
      return {
        kind: 'skipped',
        reason:
          'COMPLETION_PROVIDER must be gemini for live diagnosis validation',
      }
    }
    if (env.EMBEDDING_PROVIDER !== 'gemini') {
      return {
        kind: 'skipped',
        reason:
          'EMBEDDING_PROVIDER must be gemini for live diagnosis validation',
      }
    }
    if (
      env.GEMINI_API_KEY === undefined ||
      env.GEMINI_EMBEDDING_API_KEY === undefined ||
      env.GEMINI_REQUESTS_PER_MINUTE === undefined ||
      env.GEMINI_INPUT_TOKENS_PER_MINUTE === undefined ||
      env.GEMINI_REQUESTS_PER_HOUR === undefined ||
      env.GEMINI_REQUESTS_PER_DAY === undefined ||
      env.GEMINI_REQUESTS_PER_MONTH === undefined
    ) {
      return {
        kind: 'skipped',
        reason: 'Gemini live configuration is incomplete',
      }
    }

    return {
      kind: 'ready',
      configuration: {
        apiKey: env.GEMINI_API_KEY,
        embeddingApiKey: env.GEMINI_EMBEDDING_API_KEY,
        model: env.GEMINI_MODEL,
        redisUrl: env.REDIS_URL,
        timeoutMs: env.COMPLETION_TIMEOUT_MS,
        requestsPerMinute: env.GEMINI_REQUESTS_PER_MINUTE,
        inputTokensPerMinute: env.GEMINI_INPUT_TOKENS_PER_MINUTE,
        requestsPerHour: env.GEMINI_REQUESTS_PER_HOUR,
        requestsPerDay: env.GEMINI_REQUESTS_PER_DAY,
        requestsPerMonth: env.GEMINI_REQUESTS_PER_MONTH,
        embeddingQueryTimeoutMs: env.EMBEDDING_QUERY_TIMEOUT_MS,
        embeddingDocumentTimeoutMs: env.EMBEDDING_DOCUMENT_TIMEOUT_MS,
        embeddingRequestTimeoutMs: env.EMBEDDING_REQUEST_TIMEOUT_MS,
      },
    }
  } catch {
    return {
      kind: 'skipped',
      reason: 'Gemini live configuration is unavailable',
    }
  }
}

function createLiveEmbeddingProvider(
  configuration: LiveGeminiConfiguration,
): EmbeddingProvider {
  const sdk = new GoogleGenAI({
    apiKey: configuration.embeddingApiKey,
    httpOptions: {
      apiVersion: GEMINI_EMBEDDING_API_VERSION,
      retryOptions: { attempts: 1 },
    },
  })

  return createEmbeddingProvider('gemini', {
    gemini: {
      client: {
        embedContent: (request: GeminiEmbeddingRequest) =>
          sdk.models.embedContent(request),
      },
      quota: { reserveGeneration: () => Promise.resolve() },
      options: {
        queryTimeoutMs: configuration.embeddingQueryTimeoutMs,
        documentTimeoutMs: configuration.embeddingDocumentTimeoutMs,
        requestTimeoutMs: configuration.embeddingRequestTimeoutMs,
      },
    },
  })
}

async function selectLiveContext(
  provider: EmbeddingProvider,
  query: string,
): Promise<{
  readonly context: readonly [(typeof LIVE_CANDIDATES)[number]]
  readonly dimensions: number
  readonly semanticOrderingPassed: boolean
}> {
  const queryVector = await provider.embedQuery(query)
  const candidateVectors = await provider.embedDocuments(
    LIVE_CANDIDATES.map((candidate) => ({
      text: candidate.content,
      title: candidate.sourceTitle,
    })),
  )
  if (
    queryVector.length !== EMBEDDING_DIMENSIONS ||
    candidateVectors.length !== LIVE_CANDIDATES.length ||
    candidateVectors.some((vector) => vector.length !== EMBEDDING_DIMENSIONS)
  ) {
    throw new Error('Live diagnosis embedding shape validation failed')
  }

  const similarities = candidateVectors.map((candidate) =>
    cosineSimilarity(queryVector, candidate),
  )
  const relevantIndex = 0
  const selectedIndex = similarities[0] >= similarities[1] ? 0 : 1
  if (
    selectedIndex !== relevantIndex ||
    similarities[0] < similarities[1] + MIN_SEMANTIC_MARGIN
  ) {
    throw new Error('Live diagnosis embedding semantic ordering failed')
  }

  return {
    context: [LIVE_CANDIDATES[selectedIndex]],
    dimensions: queryVector.length,
    semanticOrderingPassed: true,
  }
}

function cosineSimilarity(
  left: readonly number[],
  right: readonly number[],
): number {
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftNorm += left[index] * left[index]
    rightNorm += right[index] * right[index]
  }
  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm)
  return denominator === 0 ? 0 : dot / denominator
}

function findCanonicalFixture(): PythonCodeDiagnosisFixture {
  const dataset = parsePythonCodeDiagnosisFixtureDataset(
    JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown,
  )
  const fixture = dataset.fixtures.find(({ id }) => id === CANONICAL_FIXTURE_ID)
  if (fixture === undefined) {
    throw new Error(`Missing fixture ${CANONICAL_FIXTURE_ID}`)
  }
  return fixture
}

async function createLiveProvider(
  configuration: LiveGeminiConfiguration,
): Promise<{
  readonly provider: CompletionProvider
  readonly close: () => Promise<void>
}> {
  const redis = createClient({ url: configuration.redisUrl })
  redis.on('error', () => undefined)
  await redis.connect()

  const quota = new GeminiQuotaService(
    {
      eval: (script, options) =>
        redis.eval(script, {
          keys: [...options.keys],
          arguments: [...options.arguments],
        }),
    },
    {
      requestsPerMinute: configuration.requestsPerMinute,
      inputTokensPerMinute: configuration.inputTokensPerMinute,
      requestsPerHour: configuration.requestsPerHour,
      requestsPerDay: configuration.requestsPerDay,
      requestsPerMonth: configuration.requestsPerMonth,
    },
    { credential: configuration.apiKey },
  )
  const adapter = new GeminiCompletionAdapter(
    createGeminiCompletionClient(configuration.apiKey),
    quota,
    {
      model: configuration.model,
      completionTimeoutMs: configuration.timeoutMs,
    },
  )

  return {
    provider: new ValidatedCompletionProvider(adapter, configuration.timeoutMs),
    close: async () => {
      if (!redis.isOpen) {
        return
      }
      try {
        await redis.close()
      } catch {
        redis.destroy()
      }
    },
  }
}

async function main(): Promise<void> {
  const live = getLiveConfiguration()
  if (live.kind === 'skipped') {
    process.stdout.write(
      `${JSON.stringify({ outcome: 'skipped', reason: live.reason })}\n`,
    )
    return
  }

  const fixture = findCanonicalFixture()
  const input = materializePythonCodeDiagnosisFixtureInput(fixture)
  const selection = selectTutorStrategy(input)
  if (selection.diagnosis === null) {
    throw new Error('Canonical fixture did not produce a static diagnosis')
  }
  sensitiveRuntimeValues.add(input)
  sensitiveRuntimeValues.add(selection.retrievalQuery)

  const embeddingProvider = createLiveEmbeddingProvider(live.configuration)
  const embeddingResult = await selectLiveContext(
    embeddingProvider,
    selection.retrievalQuery,
  )

  const liveProvider = await createLiveProvider(live.configuration)
  try {
    const completion = await liveProvider.provider.complete({
      studentQuestion: input,
      context: embeddingResult.context,
      strategy: 'PYTHON_CODE_DIAGNOSIS',
      diagnosis: selection.diagnosis,
    })
    const outputPolicyResult = validatePythonCodeDiagnosisOutput({
      content: completion.content,
      authorizedCitationCount: embeddingResult.context.length,
    })
    if (outputPolicyResult !== 'ALLOWED_DIAGNOSIS') {
      throw new Error(
        `Live completion failed diagnosis output policy: ${outputPolicyResult}`,
      )
    }

    process.stdout.write(
      `${JSON.stringify({
        outcome: 'passed',
        fixtureId: fixture.id,
        provider: completion.provider,
        model: completion.model,
        promptVersion: completion.promptVersion,
        embeddingModel: embeddingProvider.model,
        embeddingDimensions: embeddingResult.dimensions,
        semanticOrderingPassed: embeddingResult.semanticOrderingPassed,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
      })}\n`,
    )
  } finally {
    await liveProvider.close()
  }
}

function redact(message: string): string {
  let result = message
  const sensitive = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_EMBEDDING_API_KEY,
    process.env.REDIS_URL,
    ...sensitiveRuntimeValues,
    ...LIVE_CANDIDATES.flatMap((candidate) => [
      candidate.sourceTitle,
      candidate.content,
    ]),
  ]
  for (const value of sensitive) {
    if (value !== undefined && value !== '') {
      result = result.split(value).join(REDACTED)
    }
  }
  return result
    .replace(/\bAIza[0-9A-Za-z_-]{10,}/gu, REDACTED)
    .replace(/\bAQ\.[0-9A-Za-z_-]{10,}/gu, REDACTED)
    .replace(/\bBearer\s+\S+/giu, `Bearer ${REDACTED}`)
    .replace(/https?:\/\/[^\s"']+/giu, `https://${REDACTED}`)
    .slice(0, 500)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error'
  process.stderr.write(
    `${JSON.stringify({ outcome: 'failure', error: redact(message) })}\n`,
  )
  process.exitCode = 1
})
