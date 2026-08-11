import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../../config/env.schema'
import { RedisModule } from '../../cache/redis.module'
import { RedisService } from '../../cache/redis.service'
import { GEMINI_EMBEDDING_PROVIDER } from './embedding-configuration'
import {
  createEmbeddingProviderFrom,
  snapshotEmbeddingConfiguration,
  type EmbeddingProviderCollaborators,
} from './embedding-provider.factory'
import { EMBEDDING_PROVIDER_TOKEN } from './embedding-provider'
import { composeGeminiEmbeddingConfiguration } from './gemini-embedding-runtime'

// `RedisModule` is imported unconditionally, but the client is resolved lazily
// *inside* the eval closure rather than at factory time: six e2e specs stub
// `RedisService` with only `ping`, and a deterministic deployment issues no
// quota commands at all. `HealthModule` already requires Redis app-wide, so
// what a deterministic deployment avoids is every Redis *command* on the
// embedding path, not the connection.
@Module({
  imports: [RedisModule],
  providers: [
    {
      provide: EMBEDDING_PROVIDER_TOKEN,
      inject: [ConfigService, RedisService],
      useFactory: (
        configService: ConfigService<AppEnvironment, true>,
        redisService: RedisService,
      ) => {
        const provider = configService.get('EMBEDDING_PROVIDER', {
          infer: true,
        })

        return createEmbeddingProviderFrom(
          snapshotEmbeddingConfiguration(
            { EMBEDDING_PROVIDER: provider },
            buildCollaborators(provider, configService, redisService),
          ),
        )
      },
    },
  ],
  exports: [EMBEDDING_PROVIDER_TOKEN],
})
export class EmbeddingModule {}

// Only the selected provider's collaborators are constructed: a deterministic
// deployment must not need a Gemini key to boot, and the factory must not be
// handed a half-built client it would then have to reject.
function buildCollaborators(
  provider: AppEnvironment['EMBEDDING_PROVIDER'],
  configService: ConfigService<AppEnvironment, true>,
  redisService: RedisService,
): EmbeddingProviderCollaborators {
  if (provider !== GEMINI_EMBEDDING_PROVIDER) {
    return {}
  }

  const apiKey = requireString(configService, 'GEMINI_EMBEDDING_API_KEY')
  const gemini = composeGeminiEmbeddingConfiguration({
    apiKey,
    quotaProjectId: requireString(
      configService,
      'GEMINI_EMBEDDING_QUOTA_PROJECT_ID',
    ),
    redis: {
      eval: (script, options) =>
        redisService.getClient().eval(script, {
          keys: [...options.keys],
          arguments: [...options.arguments],
        }),
    },
    quotaCaps: {
      requestsPerMinute: requirePositiveInteger(
        configService,
        'GEMINI_EMBEDDING_REQUESTS_PER_MINUTE',
      ),
      inputTokensPerMinute: requirePositiveInteger(
        configService,
        'GEMINI_EMBEDDING_INPUT_TOKENS_PER_MINUTE',
      ),
      requestsPerHour: requirePositiveInteger(
        configService,
        'GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_HOUR',
      ),
      requestsPerDay: requirePositiveInteger(
        configService,
        'GEMINI_EMBEDDING_REQUESTS_PER_DAY',
      ),
      requestsPerMonth: requirePositiveInteger(
        configService,
        'GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_30_DAYS',
      ),
    },
    options: {
      queryTimeoutMs: requirePositiveInteger(
        configService,
        'EMBEDDING_QUERY_TIMEOUT_MS',
      ),
      documentTimeoutMs: requirePositiveInteger(
        configService,
        'EMBEDDING_DOCUMENT_TIMEOUT_MS',
      ),
      requestTimeoutMs: requirePositiveInteger(
        configService,
        'EMBEDDING_REQUEST_TIMEOUT_MS',
      ),
    },
  })

  return {
    gemini,
  }
}

// The environment schema already gates these on the selected provider, so a
// miss here means the schema and this wiring disagree — which must fail at boot
// rather than reach an adapter as `undefined`.
function requireString(
  configService: ConfigService<AppEnvironment, true>,
  key: keyof AppEnvironment,
): string {
  const value: unknown = configService.get(key, { infer: true })
  if (typeof value !== 'string' || value === '') {
    throw new Error(`Missing embedding configuration: ${key}`)
  }
  return value
}

function requirePositiveInteger(
  configService: ConfigService<AppEnvironment, true>,
  key: keyof AppEnvironment,
): number {
  const value: unknown = configService.get(key, { infer: true })
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Missing embedding configuration: ${key}`)
  }
  return value
}
