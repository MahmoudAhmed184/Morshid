import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../config/env.schema'
import { RedisModule } from '../redis/redis.module'
import {
  createEmbeddingProviderFrom,
  snapshotEmbeddingConfiguration,
} from './embedding-provider.factory'
import { EMBEDDING_PROVIDER_TOKEN } from './embedding-provider'

// `RedisModule` is imported unconditionally so a live provider's quota guard
// has a client available. When one is wired, the client must be resolved
// lazily inside the eval closure rather than at factory time: six e2e specs
// stub `RedisService` with only `ping`, and a deterministic deployment issues
// no quota commands at all.
@Module({
  imports: [RedisModule],
  providers: [
    {
      provide: EMBEDDING_PROVIDER_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnvironment, true>) =>
        createEmbeddingProviderFrom(
          snapshotEmbeddingConfiguration({
            EMBEDDING_PROVIDER: configService.get('EMBEDDING_PROVIDER', {
              infer: true,
            }),
          }),
        ),
    },
  ],
  exports: [EMBEDDING_PROVIDER_TOKEN],
})
export class EmbeddingModule {}
