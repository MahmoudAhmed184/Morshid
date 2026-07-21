import type {
  CompletionProvider,
  CompletionProviderMetadata,
  GroundedCompletionRequest,
  GroundedCompletionResult,
} from './completion-provider'
import { GROUNDED_COMPLETION_PROMPT_VERSION } from './completion-provider'
import { MalformedCompletionResultError } from './completion-errors'
import {
  ValidatedCompletionProvider,
  validateCompletionResult,
} from './validated-completion.provider'

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
  tokenUsage: {
    inputTokens: 20,
    outputTokens: 8,
  },
  metadata: {
    contextChunkCount: 1,
    supportsStreaming: false,
  },
}

class FakeCompletionProvider implements CompletionProvider {
  readonly metadata: CompletionProviderMetadata = {
    provider: 'deterministic',
    model: 'fake-completion-model',
    supportsStreaming: false,
  }

  readonly completeGrounded = jest.fn(
    async (): Promise<GroundedCompletionResult> => validResult,
  )
}

function malformed(patch: Record<string, unknown>): GroundedCompletionResult {
  return { ...validResult, ...patch } as GroundedCompletionResult
}

describe('ValidatedCompletionProvider', () => {
  it('passes through valid results and exposes inner metadata', async () => {
    const inner = new FakeCompletionProvider()
    const provider = new ValidatedCompletionProvider(inner)

    await expect(provider.completeGrounded(request)).resolves.toEqual(
      validResult,
    )
    expect(provider.metadata).toEqual(inner.metadata)
    expect(inner.completeGrounded).toHaveBeenCalledWith(request)
  })

  it.each([
    ['empty answer', malformed({ answer: '   ' })],
    ['missing provider', malformed({ provider: undefined })],
    ['missing model', malformed({ model: '' })],
    ['missing prompt version', malformed({ promptVersion: '' })],
    ['invalid finish reason', malformed({ finishReason: 'streaming' })],
    ['invalid guidance label', malformed({ guidanceLabel: 'OTHER' })],
    [
      'invalid input token count',
      malformed({ tokenUsage: { inputTokens: -1, outputTokens: 1 } }),
    ],
    [
      'invalid output token count',
      malformed({ tokenUsage: { inputTokens: 1, outputTokens: Number.NaN } }),
    ],
    ['invalid token shape', malformed({ tokenUsage: [] })],
    ['invalid metadata object', malformed({ metadata: [] })],
    [
      'invalid metadata value',
      malformed({ metadata: { contextText: { raw: 'private' } } }),
    ],
  ])('rejects %s', async (_, result) => {
    const inner = new FakeCompletionProvider()
    inner.completeGrounded.mockResolvedValueOnce(result)
    const provider = new ValidatedCompletionProvider(inner)

    await expect(provider.completeGrounded(request)).rejects.toBeInstanceOf(
      MalformedCompletionResultError,
    )
  })

  it('rejects a malformed result without leaking raw prompt or context', () => {
    const sentinel = 'private-context-sentinel'

    const failure = (() => {
      try {
        validateCompletionResult(
          malformed({
            answer: '',
            metadata: {
              rawPrompt: sentinel,
            },
          }),
        )
        return null
      } catch (error: unknown) {
        return error
      }
    })()

    expect(failure).toBeInstanceOf(MalformedCompletionResultError)
    expect(JSON.stringify(failure)).not.toContain(sentinel)
    expect((failure as Error).message).not.toContain(sentinel)
  })

  it('marks malformed result errors with safe code and reason metadata only', () => {
    const failure = (() => {
      try {
        validateCompletionResult(malformed({ finishReason: 'unsafe' }))
        return null
      } catch (error: unknown) {
        return error
      }
    })()

    expect(failure).toMatchObject({
      code: 'COMPLETION_MALFORMED_RESULT',
      retryable: false,
      safeMetadata: { reason: 'invalid_finish_reason' },
    })
  })
})
