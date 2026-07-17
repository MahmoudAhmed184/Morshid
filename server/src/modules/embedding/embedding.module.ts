import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../config/env.schema'
import { createEmbeddingProvider } from './embedding-provider.factory'
import { EMBEDDING_PROVIDER_TOKEN } from './embedding-provider'

@Module({
  providers: [
    {
      provide: EMBEDDING_PROVIDER_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnvironment, true>) =>
        createEmbeddingProvider(
          configService.get('EMBEDDING_PROVIDER', { infer: true }),
        ),
    },
  ],
  exports: [EMBEDDING_PROVIDER_TOKEN],
})
export class EmbeddingModule {}
