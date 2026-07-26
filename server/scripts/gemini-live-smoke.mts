import { config as loadEnv } from 'dotenv'
import { createClient } from 'redis'

import { validateEnv } from '../src/modules/config/env.schema.js'
import {
  GeminiCompletionAdapter,
  createGeminiCompletionClient,
} from '../src/modules/completion/providers/gemini/gemini-completion.adapter.js'
import { GeminiQuotaService } from '../src/modules/completion/providers/gemini/gemini-quota.service.js'
import { ValidatedCompletionProvider } from '../src/modules/completion/validated-completion.provider.js'
import { GEMINI_LIVE_SMOKE_FIXTURE } from '../test/fixtures/gemini-live-smoke.fixture.js'

loadEnv({
  path: ['server/.env', '.env', '../.env'],
  quiet: true,
})

const MAX_DIAGNOSTIC_MESSAGE_LENGTH = 500
const REDACTED = '[redacted]'

// Every string the operator must never see in a diagnostic line: the credential
// itself and the exact synthetic prompt texts. Collected once so the failure
// reporter below cannot forget one.
function collectSensitiveStrings(): readonly string[] {
  return [
    process.env.GEMINI_API_KEY,
    GEMINI_LIVE_SMOKE_FIXTURE.studentQuestion,
    ...GEMINI_LIVE_SMOKE_FIXTURE.context.map((chunk) => chunk.content),
    ...GEMINI_LIVE_SMOKE_FIXTURE.context.map((chunk) => chunk.sourceTitle),
  ].filter(
    (value): value is string => typeof value === 'string' && value !== '',
  )
}

async function main(): Promise<void> {
  const env = validateEnv(process.env)
  if (
    env.COMPLETION_PROVIDER !== 'gemini' ||
    env.GEMINI_API_KEY === undefined ||
    env.GEMINI_REQUESTS_PER_MINUTE === undefined ||
    env.GEMINI_INPUT_TOKENS_PER_MINUTE === undefined ||
    env.GEMINI_REQUESTS_PER_HOUR === undefined ||
    env.GEMINI_REQUESTS_PER_DAY === undefined ||
    env.GEMINI_REQUESTS_PER_MONTH === undefined
  ) {
    throw new Error('Gemini smoke configuration is incomplete')
  }

  const redis = createClient({ url: env.REDIS_URL })
  redis.on('error', () => {
    // Connection errors surface through the awaited calls below, which report
    // them once. A second content-free line here would only duplicate them.
  })

  try {
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
        requestsPerMinute: env.GEMINI_REQUESTS_PER_MINUTE,
        inputTokensPerMinute: env.GEMINI_INPUT_TOKENS_PER_MINUTE,
        requestsPerHour: env.GEMINI_REQUESTS_PER_HOUR,
        requestsPerDay: env.GEMINI_REQUESTS_PER_DAY,
        requestsPerMonth: env.GEMINI_REQUESTS_PER_MONTH,
      },
      // The same deployment identity the composition root uses, so the smoke
      // spends the deployment's real budget instead of minting a private one.
      { credential: env.GEMINI_API_KEY },
    )
    const adapter = new GeminiCompletionAdapter(
      createGeminiCompletionClient(env.GEMINI_API_KEY),
      quota,
      {
        model: env.GEMINI_MODEL,
        completionTimeoutMs: env.COMPLETION_TIMEOUT_MS,
      },
    )
    const provider = new ValidatedCompletionProvider(
      adapter,
      env.COMPLETION_TIMEOUT_MS,
    )
    const result = await provider.complete(GEMINI_LIVE_SMOKE_FIXTURE)

    process.stdout.write(
      `${JSON.stringify({
        outcome: 'success',
        provider: result.provider,
        model: result.model,
        promptVersion: result.promptVersion,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      })}\n`,
    )
  } finally {
    // Closing the smoke connection is never allowed to replace the outcome
    // above: a `quit()` rejection inside `finally` would otherwise propagate in
    // place of the original failure and hide the reason the run failed.
    await closeRedis(redis)
  }
}

async function closeRedis(redis: {
  isOpen: boolean
  close: () => Promise<void>
  destroy: () => void
}): Promise<void> {
  if (!redis.isOpen) {
    return
  }
  try {
    await redis.close()
  } catch {
    // A graceful close that cannot complete must still release the socket, or
    // the command would hang after reporting its outcome.
    try {
      redis.destroy()
    } catch {
      // Nothing further can be done, and the outcome above stands.
    }
  }
}

// Reports what the operator has to act on — error type, HTTP status, and a
// bounded message — while never emitting the credential or any prompt/response
// text. Only these three fields are read; the completion result and the request
// fixture are never touched.
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
  const causeName =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.name
      : null

  return JSON.stringify({
    outcome: 'failure',
    error: name,
    cause: causeName,
    status: readStatus(error),
    message: redact(rawMessage, sensitive),
  })
}

function readStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) {
    return null
  }
  for (const field of ['statusCode', 'status'] as const) {
    const value: unknown = Reflect.get(error, field)
    if (
      typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= 100 &&
      value <= 599
    ) {
      return value
    }
  }
  return null
}

function redact(message: string, sensitive: readonly string[]): string {
  let redacted = message
  for (const secret of sensitive) {
    redacted = redacted.split(secret).join(REDACTED)
  }
  // Belt and braces for a credential shape that reached the message in an
  // encoded or truncated form rather than verbatim.
  redacted = redacted.replace(/\bAIza[0-9A-Za-z_-]{10,}/gu, REDACTED)
  // The keys this project actually uses are `AQ.`-prefixed, not `AIza`. The
  // literal value is redacted verbatim above regardless; this is the fallback
  // for a key that reached the message truncated or re-encoded.
  redacted = redacted.replace(/\bAQ\.[0-9A-Za-z_-]{10,}/gu, REDACTED)
  redacted = redacted.replace(
    /\b(key|api[_-]?key)=[^&\s"']+/giu,
    `$1=${REDACTED}`,
  )

  return redacted.length > MAX_DIAGNOSTIC_MESSAGE_LENGTH
    ? `${redacted.slice(0, MAX_DIAGNOSTIC_MESSAGE_LENGTH)}…`
    : redacted
}

main().catch((error: unknown) => {
  process.stderr.write(`${describeFailure(error)}\n`)
  process.exitCode = 1
})
