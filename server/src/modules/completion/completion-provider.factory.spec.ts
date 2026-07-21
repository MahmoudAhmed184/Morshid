import type { AppEnvironment } from '../config/env.schema'
import { EmptyCompletionContextError } from './completion-errors'
import { createCompletionProvider } from './completion-provider.factory'
import { DETERMINISTIC_COMPLETION_MODEL } from './deterministic-completion.provider'

describe('createCompletionProvider', () => {
  it('selects the deterministic provider with validation composed', async () => {
    const provider = createCompletionProvider({
      provider: 'deterministic',
      model: DETERMINISTIC_COMPLETION_MODEL,
    })

    expect(provider.metadata).toEqual({
      provider: 'deterministic',
      model: DETERMINISTIC_COMPLETION_MODEL,
      supportsStreaming: false,
    })

    await expect(
      provider.completeGrounded({
        studentQuestion: 'How do lists work?',
        contextChunks: [],
      }),
    ).rejects.toBeInstanceOf(EmptyCompletionContextError)
  })

  it('uses the configured deterministic model name', () => {
    const provider = createCompletionProvider({
      provider: 'deterministic',
      model: 'custom-deterministic-model',
    })

    expect(provider.metadata.model).toBe('custom-deterministic-model')
  })

  it('fails at selection time for an unimplemented provider', () => {
    expect(() =>
      createCompletionProvider({
        provider: 'openai' as AppEnvironment['COMPLETION_PROVIDER'],
        model: DETERMINISTIC_COMPLETION_MODEL,
      }),
    ).toThrow('Unsupported completion provider')
  })

  it('does not require a live provider API key in deterministic mode', async () => {
    const previousApiKey = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY

    try {
      const provider = createCompletionProvider({
        provider: 'deterministic',
        model: DETERMINISTIC_COMPLETION_MODEL,
      })

      await expect(
        provider.completeGrounded({
          studentQuestion: 'How do lists preserve order?',
          contextChunks: [
            {
              materialTitle: 'Python Basics',
              chunkIndex: 0,
              content: 'Lists preserve insertion order.',
            },
          ],
        }),
      ).resolves.toMatchObject({
        provider: 'deterministic',
        model: DETERMINISTIC_COMPLETION_MODEL,
      })
    } finally {
      process.env.OPENAI_API_KEY = previousApiKey
    }
  })
})
