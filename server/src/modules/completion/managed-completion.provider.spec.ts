import {
  CompletionCancelledError,
  CompletionProviderFailureError,
  CompletionProviderTimeoutError,
} from './completion-errors'
import type {
  CompletionProvider,
  CompletionProviderMetadata,
  GroundedCompletionRequest,
  GroundedCompletionResult,
} from './completion-provider'
import { GROUNDED_COMPLETION_PROMPT_VERSION } from './completion-provider'
import { ManagedCompletionProvider } from './managed-completion.provider'

const request: GroundedCompletionRequest = {
  studentQuestion: 'How do lists work?',
  contextChunks: [
    {
      materialTitle: 'Python Basics',
      chunkIndex: 0,
      content: 'Python lists preserve insertion order.',
    },
  ],
}

const validResult: GroundedCompletionResult = {
  answer: 'Python lists preserve insertion order.',
  provider: 'deterministic',
  model: 'morshid-deterministic-completion-v1',
  promptVersion: GROUNDED_COMPLETION_PROMPT_VERSION,
  guidanceLabel: 'COURSE_GROUNDED',
  finishReason: 'complete',
}

class FakeCompletionProvider implements CompletionProvider {
  readonly metadata: CompletionProviderMetadata = {
    provider: 'deterministic',
    model: 'fake-completion-model',
    supportsStreaming: false,
  }

  readonly completeGrounded = jest.fn((): Promise<GroundedCompletionResult> =>
    Promise.resolve(validResult),
  )
}

describe('ManagedCompletionProvider', () => {
  it('passes through successful complete-response results', async () => {
    const inner = new FakeCompletionProvider()
    const provider = new ManagedCompletionProvider(inner, {
      defaultTimeoutMs: 30_000,
    })

    await expect(provider.completeGrounded(request)).resolves.toBe(validResult)
    expect(provider.metadata).toEqual(inner.metadata)
  })

  it('maps timeouts to safe completion timeout errors', async () => {
    const inner = new FakeCompletionProvider()
    inner.completeGrounded.mockImplementationOnce(
      () => new Promise<GroundedCompletionResult>(() => undefined),
    )
    const provider = new ManagedCompletionProvider(inner, {
      defaultTimeoutMs: 5,
    })
    const sentinel = 'private-context-sentinel'

    const failure = await provider
      .completeGrounded({
        studentQuestion: sentinel,
        contextChunks: [
          {
            materialTitle: 'Python Basics',
            chunkIndex: 0,
            content: sentinel,
          },
        ],
      })
      .then(
        () => null,
        (error: unknown) => error,
      )

    expect(failure).toBeInstanceOf(CompletionProviderTimeoutError)
    expect(failure).toMatchObject({
      code: 'COMPLETION_PROVIDER_TIMEOUT',
      retryable: true,
      safeMetadata: { timeoutMs: 5 },
    })
    expect(JSON.stringify(failure)).not.toContain(sentinel)
  })

  it('maps unexpected provider failures to safe completion failure errors', async () => {
    const inner = new FakeCompletionProvider()
    inner.completeGrounded.mockRejectedValueOnce(
      new Error('raw-provider-payload-secret'),
    )
    const provider = new ManagedCompletionProvider(inner, {
      defaultTimeoutMs: 30_000,
    })

    const failure = await provider.completeGrounded(request).then(
      () => null,
      (error: unknown) => error,
    )

    expect(failure).toBeInstanceOf(CompletionProviderFailureError)
    expect(failure).toMatchObject({
      code: 'COMPLETION_PROVIDER_FAILURE',
      retryable: true,
      safeMetadata: { provider: 'deterministic' },
    })
    expect(JSON.stringify(failure)).not.toContain('raw-provider-payload-secret')
  })

  it('maps already-aborted signals to safe cancellation errors', async () => {
    const inner = new FakeCompletionProvider()
    const provider = new ManagedCompletionProvider(inner, {
      defaultTimeoutMs: 30_000,
    })
    const controller = new AbortController()
    controller.abort()

    await expect(
      provider.completeGrounded({ ...request, signal: controller.signal }),
    ).rejects.toBeInstanceOf(CompletionCancelledError)
    expect(inner.completeGrounded).not.toHaveBeenCalled()
  })

  it('maps in-flight abort signals to safe cancellation errors', async () => {
    const inner = new FakeCompletionProvider()
    inner.completeGrounded.mockImplementationOnce(
      () => new Promise<GroundedCompletionResult>(() => undefined),
    )
    const provider = new ManagedCompletionProvider(inner, {
      defaultTimeoutMs: 30_000,
    })
    const controller = new AbortController()
    const pending = provider.completeGrounded({
      ...request,
      signal: controller.signal,
    })

    controller.abort()

    await expect(pending).rejects.toBeInstanceOf(CompletionCancelledError)
  })
})
