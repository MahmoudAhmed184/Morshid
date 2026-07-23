import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../config/env.schema'
import { createCompletionProvider } from './completion-provider.factory'
import { COMPLETION_PROVIDER_TOKEN } from './completion-provider'
import { defaultCompletionTimeoutSignalFactory } from './validated-completion.provider'

@Module({
  providers: [
    {
      provide: COMPLETION_PROVIDER_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnvironment, true>) =>
        createCompletionProvider(
          configService.get('COMPLETION_PROVIDER', { infer: true }),
          configService.get('COMPLETION_TIMEOUT_MS', { infer: true }),
          defaultCompletionTimeoutSignalFactory,
          {
            baseUrl: configService.get('SBG_BASE_URL', { infer: true }),
            apiKey: configService.get('SBG_API_KEY', { infer: true }),
            modelId: configService.get('SBG_MODEL_ID', { infer: true }),
            maxTokens: configService.get('SBG_MAX_TOKENS', { infer: true }),
          },
        ),
    },
  ],
  exports: [COMPLETION_PROVIDER_TOKEN],
})
export class CompletionModule {}
