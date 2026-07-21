import type { AppEnvironment } from '../config/env.schema'
import { createCompletionProvider } from './completion-provider.factory'
import { CompletionProviderError } from './completion-provider'

const request = {
  studentQuestion: 'How should I study?',
  context: [
    {
      sourceTitle: 'Study guide',
      chunkIndex: 0,
      content: 'Practice with the supplied examples.',
    },
  ],
} as const

describe('createCompletionProvider', () => {
  it('selects the normal deterministic adapter with validation composed', async () => {
    const timeoutController = new AbortController()
    const timeoutFactory = jest.fn(() => timeoutController.signal)
    const provider = createCompletionProvider(
      'deterministic',
      789,
      timeoutFactory,
    )

    await expect(provider.complete(request)).resolves.toMatchObject({
      provider: 'deterministic',
      model: 'deterministic-completion-v1',
      promptVersion: 'grounded-completion-v1',
    })
    expect(timeoutFactory).toHaveBeenCalledWith(789)

    await expect(
      provider.complete({ ...request, context: [] as never }),
    ).rejects.toMatchObject({ code: 'COMPLETION_EMPTY_CONTEXT' })
  })

  it('defensively rejects unknown runtime values without echoing them', () => {
    const privateProvider = 'private-provider-or-credential-sentinel'

    let failure: unknown
    try {
      createCompletionProvider(
        privateProvider as AppEnvironment['COMPLETION_PROVIDER'],
        30_000,
      )
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(CompletionProviderError)
    expect(failure).toMatchObject({
      code: 'COMPLETION_PROVIDER_UNSUPPORTED',
    })
    expect((failure as Error).message).not.toContain(privateProvider)
    expect(JSON.stringify(failure)).not.toContain(privateProvider)
  })

  it.each(['constructor', 'toString', '__proto__'])(
    'does not accept inherited object key %s as a provider',
    (inheritedKey) => {
      expect(() =>
        createCompletionProvider(
          inheritedKey as AppEnvironment['COMPLETION_PROVIDER'],
          30_000,
        ),
      ).toThrow(CompletionProviderError)
    },
  )

  it('safely rejects a non-string runtime provider', () => {
    expect(() =>
      createCompletionProvider(
        null as unknown as AppEnvironment['COMPLETION_PROVIDER'],
        30_000,
      ),
    ).toThrow(CompletionProviderError)
  })
})
