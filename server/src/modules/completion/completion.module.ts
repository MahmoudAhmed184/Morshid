import { Logger, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../config/env.schema'
import { RedisModule } from '../redis/redis.module'
import { RedisService } from '../redis/redis.service'
import {
  AWS_BEDROCK_COMPLETION_PROVIDER,
  GEMINI_COMPLETION_PROVIDER,
  ITI_BEDROCK_INSECURE_HTTP_WARNING,
  isInsecureItiBedrockBaseUrl,
} from './completion-configuration'
import { createCompletionProvider } from './completion-provider.factory'
import { COMPLETION_PROVIDER_TOKEN } from './completion-provider'
import {
  type GeminiConfiguration,
  createGeminiCompletionClient,
} from './providers/gemini/gemini-completion.adapter'
import { GeminiQuotaService } from './providers/gemini/gemini-quota.service'

const completionModuleLogger = new Logger('CompletionModule')

@Module({
  imports: [RedisModule],
  providers: [
    {
      provide: COMPLETION_PROVIDER_TOKEN,
      inject: [ConfigService, RedisService],
      useFactory: (
        configService: ConfigService<AppEnvironment, true>,
        redisService: RedisService,
      ) => {
        const provider = configService.get('COMPLETION_PROVIDER', {
          infer: true,
        })
        const timeoutMs = configService.get('COMPLETION_TIMEOUT_MS', {
          infer: true,
        })

        if (provider === AWS_BEDROCK_COMPLETION_PROVIDER) {
          const baseUrl = configService.get('ITI_BEDROCK_GATEWAY_BASE_URL', {
            infer: true,
          })
          const completionProvider = createCompletionProvider({
            provider,
            timeoutMs,
            awsBedrock: {
              baseUrl,
              apiKey: configService.get('ITI_BEDROCK_GATEWAY_API_KEY', {
                infer: true,
              }),
              allowInsecureHttp: configService.get(
                'ITI_BEDROCK_ALLOW_INSECURE_HTTP',
                { infer: true },
              ),
              modelId: configService.get('AWS_BEDROCK_MODEL_ID', {
                infer: true,
              }),
              allowedModelIds: configService.get(
                'AWS_BEDROCK_ALLOWED_MODEL_IDS',
                { infer: true },
              ),
              maxTokens: configService.get('AWS_BEDROCK_MAX_TOKENS', {
                infer: true,
              }),
              environment: configService.get('NODE_ENV', { infer: true }),
            },
          })

          // Asks the configuration module what counts as insecure rather than
          // re-deciding here, so an accepted `HTTP://…` spelling cannot silently
          // skip the one operator signal for the knowingly-insecure path.
          if (isInsecureItiBedrockBaseUrl(baseUrl)) {
            completionModuleLogger.warn(ITI_BEDROCK_INSECURE_HTTP_WARNING)
          }

          return completionProvider
        }

        if (provider === GEMINI_COMPLETION_PROVIDER) {
          return createCompletionProvider({
            provider,
            timeoutMs,
            gemini: createGeminiConfiguration(configService, redisService),
          })
        }

        return createCompletionProvider({ provider, timeoutMs })
      },
    },
  ],
  exports: [COMPLETION_PROVIDER_TOKEN],
})
export class CompletionModule {}

// Gemini's collaborators are built here rather than in the factory: the quota
// guard is Redis-backed, and the composition root is the only place that owns a
// connection. `RedisModule` is imported unconditionally and `RedisService`
// opens its client in `onModuleInit` whatever `COMPLETION_PROVIDER` says —
// `HealthModule` requires Redis app-wide regardless — so what a deterministic or
// gateway deployment avoids is every Redis *command* on the completion path,
// not the connection. Resolving the client lazily inside the eval closure is
// what keeps that true.
function createGeminiConfiguration(
  configService: ConfigService<AppEnvironment, true>,
  redisService: RedisService,
): GeminiConfiguration {
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
    // Gemini's limits are enforced per Google project, so the budget is keyed
    // on the credential and not on the model: rotating `GEMINI_MODEL` must not
    // mint a fresh day/month budget, and two deployments sharing one Redis with
    // different API keys must not collapse onto one bucket. Only a salted,
    // truncated digest of this value ever reaches Redis.
    { credential: apiKey },
  )

  return {
    client: createGeminiCompletionClient(apiKey),
    quota,
    options: {
      model,
      completionTimeoutMs,
    },
  }
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
