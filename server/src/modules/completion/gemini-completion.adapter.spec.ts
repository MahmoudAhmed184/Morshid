import { Logger } from '@nestjs/common'

import type { PreparedCompletionRequest } from './completion-adapter'
import { CompletionProviderError } from './completion-provider'
import {
  type GeminiCompletionClient,
  GeminiCompletionAdapter,
  type GeminiSdkFactory,
  createGeminiCompletionClient,
} from './gemini-completion.adapter'
import { GeminiQuotaReservationError } from './gemini-quota.service'

const systemInstruction = 'authoritative-system-instruction'
const untrustedInput = 'escaped-untrusted-envelope'

function preparedRequest(
  signal = new AbortController().signal,
): PreparedCompletionRequest {
  return {
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: untrustedInput },
    ],
    signal,
  }
}

function completedResponse(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    status: 'completed',
    output_text: 'Grounded answer',
    usage: {
      total_input_tokens: 13,
      total_output_tokens: 5,
    },
    ...overrides,
  }
}

function buildAdapter(options?: {
  model?: string
  timeoutMs?: number
  clock?: jest.MockedFunction<() => number>
  retryDelay?: jest.MockedFunction<
    (delayMs: number, signal: AbortSignal) => Promise<void>
  >
}) {
  const countTokens: jest.MockedFunction<
    GeminiCompletionClient['countTokens']
  > = jest.fn().mockResolvedValue({ totalTokens: 12 })
  const createInteraction: jest.MockedFunction<
    GeminiCompletionClient['createInteraction']
  > = jest.fn().mockResolvedValue(completedResponse())
  const client: jest.Mocked<GeminiCompletionClient> = {
    countTokens,
    createInteraction,
  }
  const quota = {
    reserveRequest: jest.fn().mockResolvedValue(undefined),
    reserveGeneration: jest.fn().mockResolvedValue(undefined),
    reconcileInputTokens: jest.fn().mockResolvedValue(undefined),
  }
  const clock = options?.clock ?? jest.fn(() => 0)
  const retryDelay =
    options?.retryDelay ?? jest.fn(() => Promise.resolve(undefined))
  const adapter = new GeminiCompletionAdapter(
    client,
    quota,
    {
      model: options?.model ?? 'gemini-test-stable',
      completionTimeoutMs: options?.timeoutMs ?? 30_000,
    },
    clock,
    retryDelay,
  )

  return {
    adapter,
    client,
    countTokens,
    createInteraction,
    quota,
    clock,
    retryDelay,
  }
}

async function captureFailure(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('Expected promise to reject')
}

describe('createGeminiCompletionClient', () => {
  it('creates one v1 client with SDK retries disabled', async () => {
    const countTokens = jest.fn().mockResolvedValue({ totalTokens: 1 })
    const create = jest.fn().mockResolvedValue(completedResponse())
    const sdkFactoryMock = jest.fn(
      (_options: Parameters<GeminiSdkFactory>[0]) => ({
        models: { countTokens },
        interactions: { create },
      }),
    )
    const sdkFactory: GeminiSdkFactory = sdkFactoryMock

    const client = createGeminiCompletionClient(
      'private-authorization-key',
      sdkFactory,
    )
    const signal = new AbortController().signal
    await client.countTokens({
      model: 'gemini-test',
      contents: 'input',
    })
    await client.createInteraction(
      {
        api_version: 'v1',
        model: 'gemini-test',
        input: 'input',
        system_instruction: 'system',
        store: false,
      },
      {
        retries: { strategy: 'none' },
        signal,
      },
    )

    expect(sdkFactoryMock).toHaveBeenCalledTimes(1)
    expect(sdkFactoryMock).toHaveBeenCalledWith({
      apiKey: 'private-authorization-key',
      apiVersion: 'v1',
      httpOptions: {
        retryOptions: {
          attempts: 1,
        },
      },
    })
    expect(countTokens).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(1)
  })
})

describe('GeminiCompletionAdapter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('maps the exact grounded messages to stateless Interactions input', async () => {
    const { adapter, countTokens, createInteraction, quota } = buildAdapter()
    const request = preparedRequest()

    await expect(adapter.complete(request)).resolves.toEqual({
      content: 'Grounded answer',
      provider: 'gemini',
      model: 'gemini-test-stable',
      promptVersion: 'grounded-completion-v1',
      inputTokens: 13,
      outputTokens: 5,
    })

    expect(countTokens).toHaveBeenCalledWith({
      model: 'gemini-test-stable',
      contents: untrustedInput,
      config: {
        systemInstruction,
        abortSignal: request.signal,
        httpOptions: {
          retryOptions: {
            attempts: 1,
          },
        },
      },
    })
    expect(createInteraction).toHaveBeenCalledWith(
      {
        api_version: 'v1',
        model: 'gemini-test-stable',
        input: untrustedInput,
        system_instruction: systemInstruction,
        store: false,
      },
      {
        retries: { strategy: 'none' },
        signal: request.signal,
      },
    )
    expect(Object.keys(createInteraction.mock.calls[0][0]).sort()).toEqual([
      'api_version',
      'input',
      'model',
      'store',
      'system_instruction',
    ])
    expect(quota.reserveRequest).toHaveBeenCalledTimes(1)
    expect(quota.reserveGeneration).toHaveBeenCalledWith(12)
    expect(quota.reconcileInputTokens).toHaveBeenCalledWith(1)
  })

  it('uses the configured model for counting, generation, and metadata', async () => {
    const { adapter, countTokens, createInteraction } = buildAdapter({
      model: 'gemini-explicit-stable-001',
    })

    await expect(adapter.complete(preparedRequest())).resolves.toMatchObject({
      model: 'gemini-explicit-stable-001',
    })
    expect(countTokens.mock.calls[0][0].model).toBe(
      'gemini-explicit-stable-001',
    )
    expect(createInteraction.mock.calls[0][0].model).toBe(
      'gemini-explicit-stable-001',
    )
  })

  it('propagates the composed abort signal to both outbound calls', async () => {
    const controller = new AbortController()
    const { adapter, countTokens, createInteraction } = buildAdapter()

    await adapter.complete(preparedRequest(controller.signal))

    expect(countTokens.mock.calls[0][0].config?.abortSignal).toBe(
      controller.signal,
    )
    expect(createInteraction.mock.calls[0][1].signal).toBe(controller.signal)
  })

  it.each([
    ['empty output', completedResponse({ output_text: '  ' })],
    ['blocked response', completedResponse({ status: 'failed' })],
    ['non-text response', completedResponse({ output_text: undefined })],
    ['missing usage', completedResponse({ usage: undefined })],
    [
      'malformed input usage',
      completedResponse({
        usage: { total_input_tokens: -1, total_output_tokens: 5 },
      }),
    ],
    [
      'malformed output usage',
      completedResponse({
        usage: { total_input_tokens: 12, total_output_tokens: 1.5 },
      }),
    ],
  ])('rejects %s as a safe completion failure', async (_, response) => {
    const { adapter, createInteraction } = buildAdapter()
    createInteraction.mockResolvedValueOnce(response)

    await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
      code: 'COMPLETION_PROVIDER_FAILURE',
    })
  })

  it.each([{}, { totalTokens: 0 }, { totalTokens: -1 }, { totalTokens: 1.5 }])(
    'rejects malformed countTokens response %#',
    async (countResponse) => {
      const { adapter, countTokens, createInteraction } = buildAdapter()
      countTokens.mockResolvedValueOnce(countResponse)

      await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
        code: 'COMPLETION_PROVIDER_FAILURE',
      })
      expect(createInteraction).not.toHaveBeenCalled()
    },
  )

  it.each([408, 429, 500, 503])(
    'retries transient HTTP %i once with another quota reservation',
    async (statusCode) => {
      const { adapter, createInteraction, quota, retryDelay } = buildAdapter()
      createInteraction
        .mockRejectedValueOnce({
          statusCode,
          headers: new Headers({ 'retry-after-ms': '17' }),
        })
        .mockResolvedValueOnce(completedResponse())

      await expect(adapter.complete(preparedRequest())).resolves.toMatchObject({
        provider: 'gemini',
      })

      expect(retryDelay).toHaveBeenCalledWith(17, expect.any(AbortSignal))
      expect(createInteraction).toHaveBeenCalledTimes(2)
      expect(quota.reserveGeneration).toHaveBeenCalledTimes(2)
      expect(quota.reserveGeneration).toHaveBeenNthCalledWith(1, 12)
      expect(quota.reserveGeneration).toHaveBeenNthCalledWith(2, 12)
    },
  )

  it.each([400, 403, 404])(
    'never retries permanent HTTP %i',
    async (statusCode) => {
      const { adapter, createInteraction, retryDelay } = buildAdapter()
      createInteraction.mockRejectedValueOnce({ statusCode })

      await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
        code: 'COMPLETION_PROVIDER_FAILURE',
      })
      expect(createInteraction).toHaveBeenCalledTimes(1)
      expect(retryDelay).not.toHaveBeenCalled()
    },
  )

  it.each([429, 500])(
    'maps exhausted transient HTTP %i retries to rate limiting',
    async (statusCode) => {
      const { adapter, createInteraction } = buildAdapter()
      createInteraction.mockRejectedValue({ statusCode })

      await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
        code: 'COMPLETION_RATE_LIMITED',
      })
      expect(createInteraction).toHaveBeenCalledTimes(2)
    },
  )

  it('does not retry when the provider delay exceeds the remaining deadline', async () => {
    const clock = jest.fn().mockReturnValueOnce(0).mockReturnValueOnce(29_900)
    const { adapter, createInteraction, retryDelay } = buildAdapter({
      timeoutMs: 30_000,
      clock,
    })
    createInteraction.mockRejectedValueOnce({
      statusCode: 503,
      headers: new Headers({ 'retry-after-ms': '250' }),
    })

    await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
      code: 'COMPLETION_RATE_LIMITED',
    })
    expect(createInteraction).toHaveBeenCalledTimes(1)
    expect(retryDelay).not.toHaveBeenCalled()
  })

  it.each(['requests_minute', 'input_tokens_minute', 'redis'] as const)(
    'fails closed when quota reservation denies %s',
    async (dimension) => {
      const { adapter, quota, countTokens } = buildAdapter()
      quota.reserveRequest.mockRejectedValueOnce(
        new GeminiQuotaReservationError(dimension),
      )

      await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
        code: 'COMPLETION_RATE_LIMITED',
      })
      expect(countTokens).not.toHaveBeenCalled()
    },
  )

  it('treats an upstream preflight 429 as rate limiting', async () => {
    const { adapter, countTokens } = buildAdapter()
    countTokens.mockRejectedValueOnce({ statusCode: 429 })

    await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
      code: 'COMPLETION_RATE_LIMITED',
    })
  })

  it('emits content-free diagnostics only', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn')
    const privateFailure = 'private-upstream-error'
    const { adapter, createInteraction } = buildAdapter()
    createInteraction.mockRejectedValueOnce({
      statusCode: 403,
      message: privateFailure,
    })

    const failure = await captureFailure(adapter.complete(preparedRequest()))

    expect(failure).toBeInstanceOf(CompletionProviderError)
    const serializedLogs = JSON.stringify(warn.mock.calls)
    expect(serializedLogs).not.toContain(privateFailure)
    expect(serializedLogs).not.toContain(systemInstruction)
    expect(serializedLogs).not.toContain(untrustedInput)
    expect(serializedLogs).toContain('upstream_failure')
    expect(serializedLogs).toContain('gemini-test-stable')
  })
})
