import { Logger } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { ITI_BEDROCK_INSECURE_HTTP_WARNING } from './completion-configuration'
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
              NODE_ENV: 'test',
              COMPLETION_PROVIDER: 'aws-bedrock',
              COMPLETION_TIMEOUT_MS: 30_000,
              ITI_BEDROCK_GATEWAY_BASE_URL:
                'https://gateway.example.test/api/v1',
              ITI_BEDROCK_GATEWAY_API_KEY: '',
              ITI_BEDROCK_ALLOW_INSECURE_HTTP: false,
              AWS_BEDROCK_MODEL_ID: 'anthropic.test-model-v1:0',
              AWS_BEDROCK_ALLOWED_MODEL_IDS: ['anthropic.test-model-v1:0'],
              AWS_BEDROCK_MAX_TOKENS: 1_024,
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

  it('resolves aws-bedrock and emits only a fixed warning for explicit HTTP development mode', async () => {
    const keySentinel = 'private-key-sentinel'
    const promptSentinel = 'private-prompt-sentinel'
    const warningSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ output_text: 'Gateway output' })),
      )
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [
            () => ({
              NODE_ENV: 'development',
              COMPLETION_PROVIDER: 'aws-bedrock',
              COMPLETION_TIMEOUT_MS: 30_000,
              ITI_BEDROCK_GATEWAY_BASE_URL:
                'http://apiaccess.iti.net.eg/api/v1',
              ITI_BEDROCK_GATEWAY_API_KEY: keySentinel,
              ITI_BEDROCK_ALLOW_INSECURE_HTTP: true,
              AWS_BEDROCK_MODEL_ID: 'openai.test-model-v1:0',
              AWS_BEDROCK_ALLOWED_MODEL_IDS: ['openai.test-model-v1:0'],
              AWS_BEDROCK_MAX_TOKENS: 1_024,
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
          studentQuestion: promptSentinel,
          context: [
            {
              sourceTitle: 'Test source',
              chunkIndex: 0,
              content: 'Test evidence',
            },
          ],
        }),
      ).resolves.toMatchObject({
        provider: 'aws-bedrock',
        model: 'openai.test-model-v1:0',
        promptVersion: 'grounded-completion-v1',
      })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(warningSpy).toHaveBeenCalledWith(ITI_BEDROCK_INSECURE_HTTP_WARNING)
      expect(JSON.stringify(warningSpy.mock.calls)).not.toContain(keySentinel)
      expect(JSON.stringify(warningSpy.mock.calls)).not.toContain(
        promptSentinel,
      )
    } finally {
      await module.close()
      jest.restoreAllMocks()
    }
  })
})
