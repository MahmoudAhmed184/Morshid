import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import type { CompletionProvider } from './completion-provider'
import { COMPLETION_PROVIDER_TOKEN } from './completion-provider'
import { CompletionModule } from './completion.module'

describe('CompletionModule', () => {
  it('resolves the exported provider token without network access', async () => {
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

  it('fails assembly when the gateway is selected without valid configuration', async () => {
    const compiling = Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [
            () => ({
              COMPLETION_PROVIDER: 'student-bedrock-gateway',
              COMPLETION_TIMEOUT_MS: 30_000,
              SBG_BASE_URL: 'https://gateway.example.test/api/v1',
              SBG_API_KEY: '',
              SBG_MODEL_ID: 'anthropic.test-model-v1:0',
              SBG_MAX_TOKENS: 1_024,
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
