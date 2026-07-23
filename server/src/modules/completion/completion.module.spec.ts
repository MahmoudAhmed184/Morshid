import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import type { CompletionProvider } from './completion-provider'
import { COMPLETION_PROVIDER_TOKEN } from './completion-provider'
import { CompletionModule } from './completion.module'
import { GeminiCompletionAdapter } from './gemini-completion.adapter'
import { GeminiQuotaService } from './gemini-quota.service'

describe('CompletionModule', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('resolves the exported provider token without network access', async () => {
    const quotaReservation = jest.spyOn(
      GeminiQuotaService.prototype,
      'reserveRequest',
    )
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

      await expect(
        provider.complete({
          studentQuestion: 'What should I practice?',
          context: [
            {
              sourceTitle: 'Offline fixture',
              chunkIndex: 0,
              content: 'Practice the supplied exercise.',
            },
          ],
        }),
      ).resolves.toMatchObject({
        provider: 'deterministic',
        model: 'deterministic-completion-v1',
      })
      expect(quotaReservation).not.toHaveBeenCalled()
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
})
