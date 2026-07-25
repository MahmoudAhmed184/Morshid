import { Logger, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../config/env.schema'
import {
  AWS_BEDROCK_COMPLETION_PROVIDER,
  ITI_BEDROCK_INSECURE_HTTP_WARNING,
  isInsecureItiBedrockBaseUrl,
} from './completion-configuration'
import { createCompletionProvider } from './completion-provider.factory'
import { COMPLETION_PROVIDER_TOKEN } from './completion-provider'

const completionModuleLogger = new Logger('CompletionModule')

@Module({
  providers: [
    {
      provide: COMPLETION_PROVIDER_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnvironment, true>) => {
        const provider = configService.get('COMPLETION_PROVIDER', {
          infer: true,
        })
        const timeoutMs = configService.get('COMPLETION_TIMEOUT_MS', {
          infer: true,
        })

        if (provider !== AWS_BEDROCK_COMPLETION_PROVIDER) {
          return createCompletionProvider({ provider, timeoutMs })
        }

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
      },
    },
  ],
  exports: [COMPLETION_PROVIDER_TOKEN],
})
export class CompletionModule {}
