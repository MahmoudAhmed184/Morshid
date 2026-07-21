import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../config/env.schema'
import { createCompletionProvider } from './completion-provider.factory'
import { COMPLETION_PROVIDER_TOKEN } from './completion-provider'

@Module({
  providers: [
    {
      provide: COMPLETION_PROVIDER_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnvironment, true>) =>
        createCompletionProvider(
          configService.get('COMPLETION_PROVIDER', { infer: true }),
          configService.get('COMPLETION_TIMEOUT_MS', { infer: true }),
        ),
    },
  ],
  exports: [COMPLETION_PROVIDER_TOKEN],
})
export class CompletionModule {}
