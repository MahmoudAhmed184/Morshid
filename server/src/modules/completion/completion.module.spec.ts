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
  })
})
