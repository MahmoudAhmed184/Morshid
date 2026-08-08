/**
 * Guarded live-completion validation for the canonical Python diagnosis.
 *
 * This command makes one real Gemini completion request through the production
 * completion adapter, then applies the production output guard. It does not
 * claim to validate database-backed retrieval or embeddings: those concerns
 * belong to grounded-chat.e2e-spec.ts and test:gemini-embedding:smoke.
 *
 * Required environment:
 *   COMPLETION_PROVIDER=gemini
 *   GEMINI_API_KEY=<real key>
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

const REDACTED = '[redacted]'
const CANONICAL_FIXTURE_ID = 'gd-p0-v1-058'
const fixturePath = resolve(
  process.cwd(),
  '..',
  'fixtures',
  'golden-dataset',
  'python-code-diagnosis-p0.json',
)
const LIVE_CONTEXT = Object.freeze([
  Object.freeze({
    sourceTitle: 'Live qualification: Python functions and scope',
    chunkIndex: 0,
    content:
      'Python resolves names in the active function scope. A parameter name must match the name referenced by an expression.',
  }),
])

interface LiveGeminiConfiguration {
  readonly apiKey: string
  readonly model: string
  readonly redisUrl: string
  readonly timeoutMs: number
  readonly requestsPerMinute: number
  readonly inputTokensPerMinute: number
  readonly requestsPerHour: number
  readonly requestsPerDay: number
  readonly requestsPerMonth: number
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
    if (
      env.GEMINI_API_KEY === undefined ||
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
        model: env.GEMINI_MODEL,
        redisUrl: env.REDIS_URL,
        timeoutMs: env.COMPLETION_TIMEOUT_MS,
        requestsPerMinute: env.GEMINI_REQUESTS_PER_MINUTE,
        inputTokensPerMinute: env.GEMINI_INPUT_TOKENS_PER_MINUTE,
        requestsPerHour: env.GEMINI_REQUESTS_PER_HOUR,
        requestsPerDay: env.GEMINI_REQUESTS_PER_DAY,
        requestsPerMonth: env.GEMINI_REQUESTS_PER_MONTH,
      },
    }
  } catch {
    return {
      kind: 'skipped',
      reason: 'Gemini live configuration is unavailable',
    }
  }
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

  const liveProvider = await createLiveProvider(live.configuration)
  try {
    const completion = await liveProvider.provider.complete({
      studentQuestion: input,
      context: LIVE_CONTEXT,
      strategy: 'PYTHON_CODE_DIAGNOSIS',
      diagnosis: selection.diagnosis,
    })
    const outputPolicyResult = validatePythonCodeDiagnosisOutput({
      content: completion.content,
      authorizedCitationCount: LIVE_CONTEXT.length,
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
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
      })}\n`,
    )
  } finally {
    await liveProvider.close()
  }
}

function redact(message: string): string {
  const apiKey = process.env.GEMINI_API_KEY
  let result = message
  if (apiKey !== undefined && apiKey !== '') {
    result = result.split(apiKey).join(REDACTED)
  }
  return result
    .replace(/\bAIza[0-9A-Za-z_-]{10,}/gu, REDACTED)
    .replace(/\bAQ\.[0-9A-Za-z_-]{10,}/gu, REDACTED)
    .slice(0, 500)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error'
  process.stderr.write(
    `${JSON.stringify({ outcome: 'failure', error: redact(message) })}\n`,
  )
  process.exitCode = 1
})
