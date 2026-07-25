import { Logger } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { validateEnv } from '../config/env.schema'
import { RedisService } from '../redis/redis.service'
import { ITI_BEDROCK_INSECURE_HTTP_WARNING } from './completion-configuration'
import type { CompletionProvider } from './completion-provider'
import {
  COMPLETION_PROVIDER_TOKEN,
  CompletionProviderError,
} from './completion-provider'
import { CompletionModule } from './completion.module'
import { GeminiCompletionAdapter } from './providers/gemini/gemini-completion.adapter'
import type { GeminiQuotaCaps } from './providers/gemini/gemini-quota.service'
import {
  GeminiQuotaReservationError,
  GeminiQuotaService,
} from './providers/gemini/gemini-quota.service'

const request = {
  studentQuestion: 'What should I practice?',
  context: [
    {
      sourceTitle: 'Offline fixture',
      chunkIndex: 0,
      content: 'Practice the supplied exercise.',
    },
  ],
} as const

const geminiCaps: GeminiQuotaCaps = {
  requestsPerMinute: 9,
  inputTokensPerMinute: 90_000,
  requestsPerHour: 90,
  requestsPerDay: 900,
  requestsPerMonth: 9_000,
}

const geminiEnv = {
  NODE_ENV: 'development',
  COMPLETION_PROVIDER: 'gemini',
  COMPLETION_TIMEOUT_MS: 30_000,
  GEMINI_API_KEY: 'authorization-key-for-module-test',
  GEMINI_MODEL: 'gemini-module-stable',
  GEMINI_REQUESTS_PER_MINUTE: geminiCaps.requestsPerMinute,
  GEMINI_INPUT_TOKENS_PER_MINUTE: geminiCaps.inputTokensPerMinute,
  GEMINI_REQUESTS_PER_HOUR: geminiCaps.requestsPerHour,
  GEMINI_REQUESTS_PER_DAY: geminiCaps.requestsPerDay,
  GEMINI_REQUESTS_PER_MONTH: geminiCaps.requestsPerMonth,
  REDIS_URL: 'redis://localhost:6379',
} as const

const unusedRedis = {
  eval: () => Promise.reject(new Error('not called')),
}

// The Redis key an independently constructed guard would meter into for the
// same identity. Comparing against it proves which identity the module passed
// without reaching inside the module or asserting on the digest algorithm.
function expectedQuotaKey(credential: string): string {
  return new GeminiQuotaService(unusedRedis, geminiCaps, { credential })
    .quotaKey
}

// The module builds the quota guard internally, so the guard itself is the only
// public seam that can report which identity it was keyed on. Which reservation
// the adapter debits first is its own concern, so every debit is intercepted
// and each guard instance reports once; denying it keeps the assembled provider
// entirely offline, and `fetch` is stubbed so that stays true even if a future
// adapter runs its unmetered token preflight before the first debit.
function captureQuotaKeys(): readonly string[] {
  const observed: string[] = []
  const reported = new WeakSet<GeminiQuotaService>()
  const capture = function (this: GeminiQuotaService): Promise<never> {
    if (!reported.has(this)) {
      reported.add(this)
      observed.push(this.quotaKey)
    }
    return Promise.reject(new GeminiQuotaReservationError('requests_day'))
  }

  // A fresh Response per call: a body may only be read once, so a shared
  // instance would make every call after the first fail for the wrong reason.
  jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ totalTokens: 42 }))),
    )
  for (const method of ['reserveRequest', 'reserveGeneration'] as const) {
    jest.spyOn(GeminiQuotaService.prototype, method).mockImplementation(capture)
  }
  return observed
}

async function completeThroughGemini(
  overrides: Record<string, unknown>,
): Promise<void> {
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        isGlobal: true,
        load: [() => ({ ...geminiEnv, ...overrides })],
      }),
      CompletionModule,
    ],
  }).compile()

  try {
    const provider = module.get<CompletionProvider>(COMPLETION_PROVIDER_TOKEN)
    // Which code a denied reservation maps to is the adapter's concern; this
    // test only needs the guard to have been consulted and no request to have
    // left the process.
    await expect(provider.complete(request)).rejects.toBeInstanceOf(
      CompletionProviderError,
    )
  } finally {
    await module.close()
  }
}

describe('CompletionModule', () => {
  // Mocks are installed before `compile()`, which may reject; restoring here
  // rather than in a per-test `finally` keeps a failed assembly from leaking a
  // mocked `globalThis.fetch` into the rest of the file.
  afterEach(() => {
    jest.restoreAllMocks()
  })

  // `CompletionModule` imports `RedisModule` unconditionally and `RedisService`
  // connects in `onModuleInit` whatever the provider is — `HealthModule` needs
  // Redis app-wide anyway — so the invariant worth holding is that a keyless
  // deployment issues no Redis *command* on the completion path. `getClient` is
  // the single seam every such command goes through.
  it('resolves the exported provider token without any Redis command', async () => {
    const getClient = jest.spyOn(RedisService.prototype, 'getClient')
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [
            () => ({
              COMPLETION_PROVIDER: 'deterministic',
              COMPLETION_TIMEOUT_MS: 30_000,
            }),
          ],
        }),
        CompletionModule,
      ],
    }).compile()

    try {
      const provider = module.get<CompletionProvider>(COMPLETION_PROVIDER_TOKEN)

      await expect(provider.complete(request)).resolves.toMatchObject({
        provider: 'deterministic',
        model: 'deterministic-completion-v1',
      })
      expect(getClient).not.toHaveBeenCalled()
    } finally {
      await module.close()
    }
  })

  it('composes the Gemini adapter through the exported validated provider', async () => {
    const adapterComplete = jest
      .spyOn(GeminiCompletionAdapter.prototype, 'complete')
      .mockResolvedValue({
        content: 'Grounded Gemini response',
        provider: 'gemini',
        model: 'gemini-module-stable',
        promptVersion: 'grounded-completion-v1',
        inputTokens: 12,
        outputTokens: 4,
      })
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [
            () => ({
              NODE_ENV: 'development',
              COMPLETION_PROVIDER: 'gemini',
              COMPLETION_TIMEOUT_MS: 30_000,
              GEMINI_API_KEY: 'authorization-key-for-module-test',
              GEMINI_MODEL: 'gemini-module-stable',
              GEMINI_REQUESTS_PER_MINUTE: 9,
              GEMINI_INPUT_TOKENS_PER_MINUTE: 90_000,
              GEMINI_REQUESTS_PER_HOUR: 90,
              GEMINI_REQUESTS_PER_DAY: 900,
              GEMINI_REQUESTS_PER_MONTH: 9_000,
              REDIS_URL: 'redis://localhost:6379',
            }),
          ],
        }),
        CompletionModule,
      ],
    }).compile()

    try {
      const provider = module.get<CompletionProvider>(COMPLETION_PROVIDER_TOKEN)

      await expect(
        provider.complete({
          studentQuestion: 'What should I practice?',
          context: [
            {
              sourceTitle: 'Synthetic fixture',
              chunkIndex: 0,
              content: 'Practice the supplied synthetic exercise.',
            },
          ],
        }),
      ).resolves.toMatchObject({
        provider: 'gemini',
        model: 'gemini-module-stable',
      })
      expect(adapterComplete).toHaveBeenCalledTimes(1)
    } finally {
      await module.close()
    }
  })

  // Gemini's limits are enforced per Google project, so the quota bucket must
  // be keyed on the credential. Keying it on the model instead let a
  // `GEMINI_MODEL` rotation mint a fresh day/month budget, and made two
  // deployments with different API keys on one Redis share a single bucket.
  it('keys the Gemini quota budget on the credential, not the model', async () => {
    const observed = captureQuotaKeys()

    await completeThroughGemini({})
    await completeThroughGemini({ GEMINI_MODEL: 'gemini-module-rotated' })

    expect(observed).toHaveLength(2)
    expect(observed[0]).toBe(expectedQuotaKey(geminiEnv.GEMINI_API_KEY))
    expect(observed[1]).toBe(observed[0])
    // The stored key discloses nothing about the deployment.
    expect(observed[0]).not.toContain(geminiEnv.GEMINI_API_KEY)
    expect(observed[0]).not.toContain(geminiEnv.GEMINI_MODEL)
  })

  it('separates the budgets of two deployments sharing one Redis', async () => {
    const observed = captureQuotaKeys()

    await completeThroughGemini({})
    await completeThroughGemini({
      GEMINI_API_KEY: 'authorization-key-for-second-deployment',
    })

    expect(observed[1]).toBe(
      expectedQuotaKey('authorization-key-for-second-deployment'),
    )
    expect(observed[1]).not.toBe(observed[0])
  })

  it('fails assembly when gemini is selected without its validated configuration', async () => {
    const compiling = Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [
            () => ({
              NODE_ENV: 'development',
              COMPLETION_PROVIDER: 'gemini',
              COMPLETION_TIMEOUT_MS: 30_000,
              REDIS_URL: 'redis://localhost:6379',
            }),
          ],
        }),
        CompletionModule,
      ],
    }).compile()

    await expect(compiling).rejects.toThrow(
      /Missing validated configuration: GEMINI_API_KEY/,
    )
  })

  it('rejects an invalid timeout while assembling the provider', async () => {
    const compiling = Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [
            () => ({
              COMPLETION_PROVIDER: 'deterministic',
              COMPLETION_TIMEOUT_MS: 0,
            }),
          ],
        }),
        CompletionModule,
      ],
    }).compile()

    await expect(compiling).rejects.toMatchObject({
      code: 'COMPLETION_CONFIGURATION_INVALID',
    })
  })

  it('fails assembly when the gateway is selected without valid configuration', async () => {
    const compiling = Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              COMPLETION_PROVIDER: 'aws-bedrock',
              COMPLETION_TIMEOUT_MS: 30_000,
              ITI_BEDROCK_GATEWAY_BASE_URL:
                'https://gateway.example.test/api/v1',
              ITI_BEDROCK_GATEWAY_API_KEY: '',
              ITI_BEDROCK_ALLOW_INSECURE_HTTP: false,
              AWS_BEDROCK_MODEL_ID: 'anthropic.test-model-v1:0',
              AWS_BEDROCK_ALLOWED_MODEL_IDS: ['anthropic.test-model-v1:0'],
              AWS_BEDROCK_MAX_TOKENS: 1_024,
            }),
          ],
        }),
        CompletionModule,
      ],
    }).compile()

    await expect(compiling).rejects.toMatchObject({
      code: 'COMPLETION_CONFIGURATION_INVALID',
    })
  })

  it('resolves aws-bedrock and emits only a fixed warning for explicit HTTP development mode', async () => {
    const keySentinel = 'private-key-sentinel'
    const promptSentinel = 'private-prompt-sentinel'
    const warningSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ output_text: 'Gateway output' })),
      )
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [
            () => ({
              NODE_ENV: 'development',
              COMPLETION_PROVIDER: 'aws-bedrock',
              COMPLETION_TIMEOUT_MS: 30_000,
              ITI_BEDROCK_GATEWAY_BASE_URL:
                'http://apiaccess.iti.net.eg/api/v1',
              ITI_BEDROCK_GATEWAY_API_KEY: keySentinel,
              ITI_BEDROCK_ALLOW_INSECURE_HTTP: true,
              AWS_BEDROCK_MODEL_ID: 'openai.test-model-v1:0',
              AWS_BEDROCK_ALLOWED_MODEL_IDS: ['openai.test-model-v1:0'],
              AWS_BEDROCK_MAX_TOKENS: 1_024,
            }),
          ],
        }),
        CompletionModule,
      ],
    }).compile()

    try {
      const provider = module.get<CompletionProvider>(COMPLETION_PROVIDER_TOKEN)
      await expect(
        provider.complete({
          studentQuestion: promptSentinel,
          context: [
            {
              sourceTitle: 'Test source',
              chunkIndex: 0,
              content: 'Test evidence',
            },
          ],
        }),
      ).resolves.toMatchObject({
        provider: 'aws-bedrock',
        model: 'openai.test-model-v1:0',
        promptVersion: 'grounded-completion-v1',
      })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(warningSpy).toHaveBeenCalledWith(ITI_BEDROCK_INSECURE_HTTP_WARNING)
      expect(JSON.stringify(warningSpy.mock.calls)).not.toContain(keySentinel)
      expect(JSON.stringify(warningSpy.mock.calls)).not.toContain(
        promptSentinel,
      )
    } finally {
      await module.close()
    }
  })

  it('warns about insecure transport when the accepted scheme is not lower case', async () => {
    const warningSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [
            () => ({
              NODE_ENV: 'development',
              COMPLETION_PROVIDER: 'aws-bedrock',
              COMPLETION_TIMEOUT_MS: 30_000,
              // `z.url()` accepts this verbatim and the request really does go
              // out in plaintext, so the warning must not depend on spelling.
              ITI_BEDROCK_GATEWAY_BASE_URL:
                'HTTP://apiaccess.iti.net.eg/api/v1',
              ITI_BEDROCK_GATEWAY_API_KEY: 'private-key-sentinel',
              ITI_BEDROCK_ALLOW_INSECURE_HTTP: true,
              AWS_BEDROCK_MODEL_ID: 'openai.test-model-v1:0',
              AWS_BEDROCK_ALLOWED_MODEL_IDS: ['openai.test-model-v1:0'],
              AWS_BEDROCK_MAX_TOKENS: 1_024,
            }),
          ],
        }),
        CompletionModule,
      ],
    }).compile()

    try {
      expect(
        module.get<CompletionProvider>(COMPLETION_PROVIDER_TOKEN),
      ).toBeDefined()
      expect(warningSpy).toHaveBeenCalledWith(ITI_BEDROCK_INSECURE_HTTP_WARNING)
    } finally {
      await module.close()
    }
  })

  it('drives the gateway adapter from raw environment strings through validateEnv', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ output_text: 'Gateway output' })),
      )
    // The production wiring in `app.module.ts` reaches `ConfigService` only
    // through `validateEnv`, so the comma-separated allow-list, the blank
    // insecure-HTTP flag, and the numeric token budget arrive as zod
    // transforms rather than as ready-made values.
    const environment = validateEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://morshid:morshid@localhost:5432/morshid',
      REDIS_URL: 'redis://localhost:6379',
      PDF_STORAGE_PATH: '../storage/pdfs',
      COMPLETION_PROVIDER: 'aws-bedrock',
      COMPLETION_TIMEOUT_MS: '30000',
      ITI_BEDROCK_GATEWAY_BASE_URL: 'https://gateway.example.test/api/v1',
      ITI_BEDROCK_GATEWAY_API_KEY: '<test-only-placeholder>',
      ITI_BEDROCK_ALLOW_INSECURE_HTTP: '',
      AWS_BEDROCK_MODEL_ID: 'openai.test-model-v1:0',
      AWS_BEDROCK_ALLOWED_MODEL_IDS:
        'openai.test-model-v1:0, openai.other-model-v1:0',
      AWS_BEDROCK_MAX_TOKENS: '256',
      AUTH_ACCESS_TOKEN_SECRET: 'test-only-access-secret-value-0123456789',
      AUTH_REFRESH_TOKEN_HASH_SECRET:
        'test-only-refresh-secret-value-9876543210',
    })

    expect(environment.AWS_BEDROCK_ALLOWED_MODEL_IDS).toEqual([
      'openai.test-model-v1:0',
      'openai.other-model-v1:0',
    ])
    expect(environment.ITI_BEDROCK_ALLOW_INSECURE_HTTP).toBe(false)

    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          isGlobal: true,
          load: [() => environment],
        }),
        CompletionModule,
      ],
    }).compile()

    try {
      const provider = module.get<CompletionProvider>(COMPLETION_PROVIDER_TOKEN)

      await expect(provider.complete(request)).resolves.toMatchObject({
        provider: 'aws-bedrock',
        model: 'openai.test-model-v1:0',
        promptVersion: 'grounded-completion-v1',
      })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const [endpoint, requestInit] = fetchSpy.mock.calls[0]
      expect(endpoint).toBe('https://gateway.example.test/api/v1/student/chat')

      const body: unknown = JSON.parse(
        typeof requestInit?.body === 'string' ? requestInit.body : 'null',
      )
      expect(body).toMatchObject({
        model_id: 'openai.test-model-v1:0',
        max_tokens: 256,
      })
    } finally {
      await module.close()
    }
  })
})
