import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../config/env.schema'
import { RedisModule } from '../redis/redis.module'
import { RedisService } from '../redis/redis.service'
import {
  GeminiCompletionAdapter,
  createGeminiCompletionClient,
} from './gemini-completion.adapter'
import { GeminiQuotaService } from './gemini-quota.service'
import { createCompletionProvider } from './completion-provider.factory'
import { COMPLETION_PROVIDER_TOKEN } from './completion-provider'

@Module({
  imports: [RedisModule],
  providers: [
    {
      provide: COMPLETION_PROVIDER_TOKEN,
      inject: [ConfigService, RedisService],
      useFactory: (
        configService: ConfigService<AppEnvironment, true>,
        redisService: RedisService,
      ) =>
        createCompletionProvider(
          configService.get('COMPLETION_PROVIDER', { infer: true }),
          configService.get('COMPLETION_TIMEOUT_MS', { infer: true }),
          undefined,
          {
            gemini: () => createGeminiAdapter(configService, redisService),
          },
        ),
    },
  ],
  exports: [COMPLETION_PROVIDER_TOKEN],
})
export class CompletionModule {}

function createGeminiAdapter(
  configService: ConfigService<AppEnvironment, true>,
  redisService: RedisService,
): GeminiCompletionAdapter {
  const apiKey = requireString(configService, 'GEMINI_API_KEY')
  const model = requireString(configService, 'GEMINI_MODEL')
  const completionTimeoutMs = requirePositiveInteger(
    configService,
    'COMPLETION_TIMEOUT_MS',
  )
  const quota = new GeminiQuotaService(
    {
      eval: (script, options) =>
        redisService.getClient().eval(script, {
          keys: [...options.keys],
          arguments: [...options.arguments],
        }),
    },
    {
      requestsPerMinute: requirePositiveInteger(
        configService,
        'GEMINI_REQUESTS_PER_MINUTE',
      ),
      inputTokensPerMinute: requirePositiveInteger(
        configService,
        'GEMINI_INPUT_TOKENS_PER_MINUTE',
      ),
      requestsPerHour: requirePositiveInteger(
        configService,
        'GEMINI_REQUESTS_PER_HOUR',
      ),
      requestsPerDay: requirePositiveInteger(
        configService,
        'GEMINI_REQUESTS_PER_DAY',
      ),
      requestsPerMonth: requirePositiveInteger(
        configService,
        'GEMINI_REQUESTS_PER_MONTH',
      ),
    },
    model,
  )

  return new GeminiCompletionAdapter(
    createGeminiCompletionClient(apiKey),
    quota,
    {
      model,
      completionTimeoutMs,
    },
  )
}

function requireString(
  configService: ConfigService<AppEnvironment, true>,
  key: keyof AppEnvironment,
): string {
  const value: unknown = configService.get(key, { infer: true })
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing validated configuration: ${key}`)
  }
  return value
}

function requirePositiveInteger(
  configService: ConfigService<AppEnvironment, true>,
  key: keyof AppEnvironment,
): number {
  const value: unknown = configService.get(key, { infer: true })
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Missing validated configuration: ${key}`)
  }
  return value
}
