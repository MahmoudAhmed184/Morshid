import { config as loadEnv } from 'dotenv'
import { createClient } from 'redis'

import { validateEnv } from '../src/modules/config/env.schema.js'
import {
  GeminiCompletionAdapter,
  createGeminiCompletionClient,
} from '../src/modules/completion/gemini-completion.adapter.js'
import { GeminiQuotaService } from '../src/modules/completion/gemini-quota.service.js'
import { ValidatedCompletionProvider } from '../src/modules/completion/validated-completion.provider.js'
import { GEMINI_LIVE_SMOKE_FIXTURE } from '../test/fixtures/gemini-live-smoke.fixture.js'

loadEnv({
  path: ['server/.env', '.env', '../.env'],
  quiet: true,
})

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
    // The smoke command reports only a fixed failure below.
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
      env.GEMINI_MODEL,
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
    if (redis.isOpen) {
      await redis.quit()
    }
  }
}

main().catch(() => {
  process.stderr.write(
    'Gemini live smoke failed; inspect content-free server diagnostics.\n',
  )
  process.exitCode = 1
})
