import { GoogleGenAI } from '@google/genai'
import { Logger } from '@nestjs/common'
import { config as loadEnv } from 'dotenv'

import { validateEnv } from '../src/platform/config/env.schema.js'
import {
  GEMINI_EMBEDDING_API_VERSION,
  GEMINI_EMBEDDING_BATCH_SIZE,
  type GeminiEmbeddingRequest,
} from '../src/platform/ai/embedding/embedding-configuration.js'
import { createEmbeddingProvider } from '../src/platform/ai/embedding/embedding-provider.factory.js'
import { EMBEDDING_DIMENSIONS } from '../src/platform/ai/embedding/embedding-provider.js'
import {
  GEMINI_EMBEDDING_LIVE_SMOKE_FIXTURE,
  buildGeminiSmokeBatch,
} from '../test/fixtures/gemini-embedding-live-smoke.fixture.js'

loadEnv({
  path: ['server/.env', '.env', '../.env'],
  quiet: true,
})

// The adapter logs diagnostics in the application. A smoke command has a
// stricter machine-readable contract: stdout/stderr contain only the single
// result or redacted failure object emitted below.
Logger.overrideLogger([])

/**
 * Minimum cosine margin the relevant fixture must beat the unrelated one by.
 *
 * A bare `relevant > unrelated` comparison passes on noise: two near-orthogonal
 * vectors differ by something, so the assertion would hold even if the model
 * had learned nothing useful. The margin is deliberately **per provider** and
 * calibrated after measuring both query tasks on disjoint calibration and
 * held-out fixtures; see `docs/gemini-embedding-task-selection.md`. The selected
 * protocol's held-out minimum margin was about 0.063, so 0.05 retains measured
 * headroom while still rejecting noisy ordering.
 */
const MIN_SEMANTIC_MARGIN = 0.05

const MAX_DIAGNOSTIC_MESSAGE_LENGTH = 500
const REDACTED = '[redacted]'

/**
 * Confirms only what documentation cannot: the selected API version, that one
 * `Content` yields one embedding, the dimensionality, that the configured
 * operational batch succeeds, and semantic ordering.
 *
 * It emits counts and booleans only — never source text, vector values, keys,
 * headers, titles, or raw bodies. Detailed retrieval-quality numbers belong in
 * the research note, not here.
 */
async function main(): Promise<void> {
  const env = validateEnv(process.env)
  if (
    env.EMBEDDING_PROVIDER !== 'gemini' ||
    env.GEMINI_EMBEDDING_API_KEY === undefined
  ) {
    throw new Error('Gemini embedding smoke configuration is incomplete')
  }

  const sdk = new GoogleGenAI({
    apiKey: env.GEMINI_EMBEDDING_API_KEY,
    httpOptions: {
      apiVersion: GEMINI_EMBEDDING_API_VERSION,
      retryOptions: { attempts: 1 },
    },
  })

  const adapter = createEmbeddingProvider('gemini', {
    gemini: {
      client: {
        embedContent: (request: GeminiEmbeddingRequest) =>
          sdk.models.embedContent(request),
      },
      // The smoke check exercises the wire contract, not the local admission
      // control, so it deliberately does not meter into the shared budget.
      quota: { reserveGeneration: () => Promise.resolve() },
      options: {
        queryTimeoutMs: env.EMBEDDING_QUERY_TIMEOUT_MS,
        documentTimeoutMs: env.EMBEDDING_DOCUMENT_TIMEOUT_MS,
        requestTimeoutMs: env.EMBEDDING_REQUEST_TIMEOUT_MS,
      },
    },
  })

  const fixture = GEMINI_EMBEDDING_LIVE_SMOKE_FIXTURE
  const queryVector = await adapter.embedQuery(fixture.query)
  const [relevantVector, unrelatedVector] = await adapter.embedDocuments([
    { text: fixture.relevant, title: fixture.materialTitle },
    { text: fixture.unrelated, title: fixture.materialTitle },
  ])

  const batch = await adapter.embedDocuments(
    buildGeminiSmokeBatch(GEMINI_EMBEDDING_BATCH_SIZE).map((text) => ({
      text,
      title: fixture.materialTitle,
    })),
  )

  const relevantSimilarity = cosineSimilarity(queryVector, relevantVector)
  const unrelatedSimilarity = cosineSimilarity(queryVector, unrelatedVector)
  const semanticOrderingPassed =
    relevantSimilarity > unrelatedSimilarity + MIN_SEMANTIC_MARGIN

  if (
    queryVector.length !== EMBEDDING_DIMENSIONS ||
    batch.some((vector) => vector.length !== EMBEDDING_DIMENSIONS) ||
    batch.length !== GEMINI_EMBEDDING_BATCH_SIZE ||
    !semanticOrderingPassed
  ) {
    throw new Error('Gemini embedding smoke contract failed')
  }

  process.stdout.write(
    `${JSON.stringify({
      provider: 'gemini',
      responseShape: 'embeddings[].values[]',
      vectorCount: batch.length,
      dimensions: queryVector.length,
      semanticOrderingPassed,
    })}\n`,
  )
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

// Every string the operator must never see in a diagnostic: the credential and
// every fixture string. Collected once so the reporter cannot forget one.
function collectSensitiveStrings(): readonly string[] {
  const fixture = GEMINI_EMBEDDING_LIVE_SMOKE_FIXTURE
  return [
    process.env.GEMINI_EMBEDDING_API_KEY,
    fixture.query,
    fixture.relevant,
    fixture.unrelated,
    fixture.materialTitle,
    fixture.batchFillerPrefix,
  ].filter(
    (value): value is string => typeof value === 'string' && value !== '',
  )
}

function describeFailure(error: unknown): string {
  const sensitive = collectSensitiveStrings()
  const name =
    error instanceof Error && error.name !== '' ? error.name : typeof error
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ''

  return JSON.stringify({
    outcome: 'failure',
    error: name,
    code: readCode(error),
    message: redact(rawMessage, sensitive),
  })
}

function readCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null
  }
  const value: unknown = Reflect.get(error, 'code')
  return typeof value === 'string' ? value : null
}

function redact(message: string, sensitive: readonly string[]): string {
  let redacted = message
  for (const secret of sensitive) {
    redacted = redacted.split(secret).join(REDACTED)
  }
  // Belt and braces for a credential shape that reached the message encoded or
  // truncated rather than verbatim.
  redacted = redacted.replace(/\bAIza[0-9A-Za-z_-]{10,}/gu, REDACTED)
  // The keys this project actually uses are `AQ.`-prefixed, not `AIza`. The
  // literal value is redacted verbatim above regardless; this is the fallback
  // for a key that reached the message truncated or re-encoded.
  redacted = redacted.replace(/\bAQ\.[0-9A-Za-z_-]{10,}/gu, REDACTED)
  redacted = redacted.replace(/\bsbg_[0-9A-Za-z_-]{10,}/gu, REDACTED)
  redacted = redacted.replace(/\bBearer\s+\S+/giu, `Bearer ${REDACTED}`)
  redacted = redacted.replace(/https?:\/\/[^\s"']+/giu, `https://${REDACTED}`)

  return redacted.length > MAX_DIAGNOSTIC_MESSAGE_LENGTH
    ? `${redacted.slice(0, MAX_DIAGNOSTIC_MESSAGE_LENGTH)}…`
    : redacted
}

main().catch((error: unknown) => {
  process.stderr.write(`${describeFailure(error)}\n`)
  process.exitCode = 1
})
