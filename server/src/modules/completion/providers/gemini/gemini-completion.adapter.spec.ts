import { Logger } from '@nestjs/common'

import type { PreparedCompletionRequest } from '../../completion-adapter'
import { CompletionProviderError } from '../../completion-provider'
import type { GroundedCompletionMessage } from '../../grounded-completion-envelope'
import { MAX_UPSTREAM_ATTEMPTS } from '../http-retry-policy'
import {
  type GeminiCompletionClient,
  GeminiCompletionAdapter,
  type GeminiSdkFactory,
  createGeminiCompletionClient,
} from './gemini-completion.adapter'
import { GEMINI_MAX_OUTPUT_TOKENS } from './gemini-completion.constants'
import {
  GEMINI_QUOTA_DIMENSIONS,
  GEMINI_QUOTA_UNAVAILABLE_REASONS,
  GeminiQuotaReservationError,
  GeminiQuotaUnavailableError,
} from './gemini-quota.service'

const systemInstruction = 'authoritative-system-instruction'
const untrustedInput = 'escaped-untrusted-envelope'

const groundedMessage = (
  role: GroundedCompletionMessage['role'],
  content: string,
): GroundedCompletionMessage => Object.freeze({ role, content })

function preparedRequest(
  signal = new AbortController().signal,
): PreparedCompletionRequest {
  return {
    messages: [
      groundedMessage('system', systemInstruction),
      groundedMessage('user', untrustedInput),
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
    reserveInputTokens: jest.fn().mockResolvedValue(undefined),
    recordInputTokens: jest.fn().mockResolvedValue(undefined),
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

function quotaStub() {
  return {
    reserveRequest: jest.fn(),
    reserveGeneration: jest.fn(),
    reserveInputTokens: jest.fn(),
    recordInputTokens: jest.fn(),
  }
}

function buildAdapterWithModel(model: string): GeminiCompletionAdapter {
  return new GeminiCompletionAdapter(
    { countTokens: jest.fn(), createInteraction: jest.fn() },
    quotaStub(),
    { model, completionTimeoutMs: 30_000 },
  )
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
        generation_config: { max_output_tokens: GEMINI_MAX_OUTPUT_TOKENS },
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
    jest.spyOn(Logger.prototype, 'error').mockImplementation()
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
      contents: {
        role: 'user',
        parts: [{ text: systemInstruction }, { text: untrustedInput }],
      },
      config: {
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
        generation_config: { max_output_tokens: GEMINI_MAX_OUTPUT_TOKENS },
      },
      {
        retries: { strategy: 'none' },
        signal: request.signal,
      },
    )
    expect(Object.keys(createInteraction.mock.calls[0][0]).sort()).toEqual([
      'api_version',
      'generation_config',
      'input',
      'model',
      'store',
      'system_instruction',
    ])
    // One request unit for the one generation call, and no more: the preflight
    // count is not metered, and the first attempt's input tokens are debited
    // on their own because its request unit was already reserved up front.
    expect(quota.reserveRequest).toHaveBeenCalledTimes(1)
    expect(quota.reserveGeneration).not.toHaveBeenCalled()
    expect(quota.reserveInputTokens).toHaveBeenCalledWith(12)
    // Google billed 13 against the 12 counted, and the extra one is recorded
    // rather than reserved: it is already spent, so there is nothing to admit.
    expect(quota.recordInputTokens).toHaveBeenCalledWith(1)
  })

  it('reserves the request unit before any call reaches Gemini', async () => {
    const { adapter, quota, countTokens, createInteraction } = buildAdapter()
    quota.reserveRequest.mockRejectedValueOnce(
      new GeminiQuotaReservationError('requests_day'),
    )

    await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
      code: 'COMPLETION_RATE_LIMITED',
    })
    expect(countTokens).not.toHaveBeenCalled()
    expect(createInteraction).not.toHaveBeenCalled()
  })

  // The result validator discards any answer above
  // MAX_COMPLETION_OUTPUT_CODE_POINTS, so an unbounded generation is billed in
  // full and then thrown away. The ceiling has to reach the provider.
  it('bounds the generated output so a verbose answer cannot burn full quota', async () => {
    const { adapter, createInteraction } = buildAdapter()

    await adapter.complete(preparedRequest())

    expect(createInteraction.mock.calls[0][0].generation_config).toEqual({
      max_output_tokens: GEMINI_MAX_OUTPUT_TOKENS,
    })
    expect(GEMINI_MAX_OUTPUT_TOKENS).toBeLessThan(65_536)
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

  // The prepared tuple is positional: index 0 is authoritative and index 1 is
  // untrusted. Nothing in the declared type records that, so the adapter has to
  // assert it at its own trust boundary and report the same code as every
  // sibling provider — an operator must be able to tell "our prompt builder
  // broke" from "the provider broke".
  it.each([
    [
      'the authoritative and untrusted messages are swapped',
      [
        groundedMessage('user', untrustedInput),
        groundedMessage('system', systemInstruction),
      ] as const,
    ],
    [
      'both messages carry the untrusted role',
      [
        groundedMessage('user', untrustedInput),
        groundedMessage('user', untrustedInput),
      ] as const,
    ],
    [
      'both messages carry the authoritative role',
      [
        groundedMessage('system', systemInstruction),
        groundedMessage('system', systemInstruction),
      ] as const,
    ],
  ])('never reaches Gemini when %s', async (_, messages) => {
    const { adapter, countTokens, createInteraction, quota } = buildAdapter()

    const failure = await captureFailure(
      adapter.complete({
        messages,
        signal: new AbortController().signal,
      }),
    )

    expect(failure).toBeInstanceOf(CompletionProviderError)
    expect(failure).toMatchObject({ code: 'COMPLETION_INVALID_REQUEST' })
    expect(JSON.stringify(failure)).not.toContain(systemInstruction)
    expect(JSON.stringify(failure)).not.toContain(untrustedInput)
    expect(countTokens).not.toHaveBeenCalled()
    expect(createInteraction).not.toHaveBeenCalled()
    expect(quota.reserveGeneration).not.toHaveBeenCalled()
  })

  it('rejects a message tuple that is not a two-element array', async () => {
    const { adapter, countTokens } = buildAdapter()

    await expect(
      adapter.complete({
        messages: [
          groundedMessage('system', systemInstruction),
          groundedMessage('user', untrustedInput),
          groundedMessage('user', untrustedInput),
        ],
        signal: new AbortController().signal,
      } as unknown as PreparedCompletionRequest),
    ).rejects.toMatchObject({ code: 'COMPLETION_INVALID_REQUEST' })
    expect(countTokens).not.toHaveBeenCalled()
  })

  it('fails fast on an already cancelled request', async () => {
    const controller = new AbortController()
    controller.abort()
    const { adapter, countTokens, quota } = buildAdapter()

    await expect(
      adapter.complete(preparedRequest(controller.signal)),
    ).rejects.toMatchObject({ code: 'COMPLETION_CANCELLED' })
    expect(countTokens).not.toHaveBeenCalled()
    expect(quota.reserveGeneration).not.toHaveBeenCalled()
  })

  it('reports cancellation during generation rather than retrying', async () => {
    const controller = new AbortController()
    const { adapter, createInteraction, retryDelay } = buildAdapter()
    createInteraction.mockImplementationOnce(() => {
      controller.abort()
      return Promise.reject(new Error('aborted'))
    })

    await expect(
      adapter.complete(preparedRequest(controller.signal)),
    ).rejects.toMatchObject({ code: 'COMPLETION_CANCELLED' })
    expect(createInteraction).toHaveBeenCalledTimes(1)
    expect(retryDelay).not.toHaveBeenCalled()
  })

  it.each([
    ['empty output', completedResponse({ output_text: '  ' })],
    ['blocked response', completedResponse({ status: 'failed' })],
    ['non-text response', completedResponse({ output_text: undefined })],
    ['truncated response', completedResponse({ status: 'incomplete' })],
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

  // Truncation and absent usage are deliberately distinguishable from a
  // genuinely malformed payload: only the first says the output ceiling is too
  // tight, and only the second says the provider changed its usage shape.
  it.each([
    ['incomplete', 'truncated_response'],
    ['completed', 'missing_usage'],
  ])(
    'logs a distinct outcome for a %s response without usable usage',
    async (status, outcome) => {
      const error = jest.spyOn(Logger.prototype, 'error')
      const { adapter, createInteraction } = buildAdapter()
      createInteraction.mockResolvedValueOnce(
        completedResponse({ status, usage: undefined }),
      )

      await captureFailure(adapter.complete(preparedRequest()))

      expect(JSON.stringify(error.mock.calls)).toContain(outcome)
    },
  )

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
      // A retry is a second genuine generation that Google bills in full, so
      // it debits a second request unit together with its input tokens —
      // deliberately, and only then.
      expect(quota.reserveRequest).toHaveBeenCalledTimes(1)
      expect(quota.reserveGeneration).toHaveBeenCalledTimes(1)
      expect(quota.reserveGeneration).toHaveBeenCalledWith(12)
    },
  )

  // A socket hang-up or DNS blip carries no HTTP status. Treating it as
  // permanent failed instantly with the whole retry budget unused, after the
  // attempt had already been debited.
  it('retries a transport failure that carries no HTTP status', async () => {
    const { adapter, createInteraction, retryDelay, quota } = buildAdapter()
    createInteraction
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(completedResponse())

    await expect(adapter.complete(preparedRequest())).resolves.toMatchObject({
      provider: 'gemini',
    })
    expect(createInteraction).toHaveBeenCalledTimes(2)
    expect(retryDelay).toHaveBeenCalledWith(250, expect.any(AbortSignal))
    expect(
      quota.reserveRequest.mock.calls.length +
        quota.reserveGeneration.mock.calls.length,
    ).toBe(MAX_UPSTREAM_ATTEMPTS)
  })

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

  it('maps an exhausted HTTP 429 retry to rate limiting', async () => {
    const { adapter, createInteraction } = buildAdapter()
    createInteraction.mockRejectedValue({ statusCode: 429 })

    await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
      code: 'COMPLETION_RATE_LIMITED',
    })
    expect(createInteraction).toHaveBeenCalledTimes(MAX_UPSTREAM_ATTEMPTS)
  })

  // The quota guard exists so an operator can tell "we hit our own cap" from
  // "Google is down". Reporting an outage as rate limiting has them lowering
  // caps that were never the constraint.
  it.each([408, 500, 502, 503])(
    'reports an exhausted HTTP %i retry as a provider failure, not rate limiting',
    async (statusCode) => {
      const { adapter, createInteraction } = buildAdapter()
      createInteraction.mockRejectedValue({ statusCode })

      await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
        code: 'COMPLETION_PROVIDER_FAILURE',
      })
      expect(createInteraction).toHaveBeenCalledTimes(MAX_UPSTREAM_ATTEMPTS)
    },
  )

  it('reports an exhausted transport retry as a provider failure', async () => {
    const { adapter, createInteraction } = buildAdapter()
    createInteraction.mockRejectedValue(new Error('ECONNRESET'))

    await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
      code: 'COMPLETION_PROVIDER_FAILURE',
    })
    expect(createInteraction).toHaveBeenCalledTimes(MAX_UPSTREAM_ATTEMPTS)
  })

  it('does not retry when the provider delay exceeds the remaining deadline', async () => {
    const clock = jest.fn().mockReturnValueOnce(0).mockReturnValue(29_900)
    const { adapter, createInteraction, retryDelay } = buildAdapter({
      timeoutMs: 30_000,
      clock,
    })
    createInteraction.mockRejectedValueOnce({
      statusCode: 503,
      headers: new Headers({ 'retry-after-ms': '250' }),
    })

    await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
      code: 'COMPLETION_PROVIDER_FAILURE',
    })
    expect(createInteraction).toHaveBeenCalledTimes(1)
    expect(retryDelay).not.toHaveBeenCalled()
  })

  it.each(GEMINI_QUOTA_DIMENSIONS)(
    'reports an exhausted %s budget as rate limiting',
    async (dimension) => {
      const warn = jest.spyOn(Logger.prototype, 'warn')
      const { adapter, quota, createInteraction } = buildAdapter()
      quota.reserveRequest.mockRejectedValueOnce(
        new GeminiQuotaReservationError(dimension),
      )

      await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
        code: 'COMPLETION_RATE_LIMITED',
      })
      expect(createInteraction).not.toHaveBeenCalled()
      const logged = JSON.stringify(warn.mock.calls)
      expect(logged).toContain('quota_exhausted')
      expect(logged).toContain(dimension)
    },
  )

  // The pre-generation token debit is admission control and must fail closed,
  // unlike the post-hoc top-up of the same budget below.
  it('never generates when the counted input tokens are denied', async () => {
    const { adapter, quota, createInteraction } = buildAdapter()
    quota.reserveInputTokens.mockRejectedValueOnce(
      new GeminiQuotaReservationError('input_tokens_minute'),
    )

    await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
      code: 'COMPLETION_RATE_LIMITED',
    })
    expect(quota.reserveInputTokens).toHaveBeenCalledWith(12)
    expect(createInteraction).not.toHaveBeenCalled()
    expect(quota.recordInputTokens).not.toHaveBeenCalled()
  })

  it('denies a retry whose second request unit is exhausted', async () => {
    const { adapter, quota, createInteraction } = buildAdapter()
    createInteraction.mockRejectedValueOnce({ statusCode: 503 })
    quota.reserveGeneration.mockRejectedValueOnce(
      new GeminiQuotaReservationError('requests_minute'),
    )

    await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
      code: 'COMPLETION_RATE_LIMITED',
    })
    expect(quota.reserveGeneration).toHaveBeenCalledWith(12)
    expect(createInteraction).toHaveBeenCalledTimes(1)
  })

  // A guard that could not answer is an infrastructure failure, not a spent
  // budget. Reporting Redis as rate limiting hides an outage behind our own
  // caps.
  it.each(GEMINI_QUOTA_UNAVAILABLE_REASONS)(
    'reports an unavailable quota guard (%s) as a provider failure',
    async (reason) => {
      const error = jest.spyOn(Logger.prototype, 'error')
      const { adapter, quota, createInteraction } = buildAdapter()
      quota.reserveRequest.mockRejectedValueOnce(
        new GeminiQuotaUnavailableError(reason),
      )

      await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
        code: 'COMPLETION_PROVIDER_FAILURE',
      })
      expect(createInteraction).not.toHaveBeenCalled()
      const logged = JSON.stringify(error.mock.calls)
      expect(logged).toContain('quota_unavailable')
      expect(logged).toContain(reason)
    },
  )

  it('treats an unclassified quota failure as an unavailable guard', async () => {
    const { adapter, quota } = buildAdapter()
    quota.reserveRequest.mockRejectedValueOnce(new Error('unclassified'))

    await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
      code: 'COMPLETION_PROVIDER_FAILURE',
    })
  })

  // The answer already exists and Google has already billed it. Discarding it
  // because post-hoc bookkeeping failed marks the turn FAILED, the student
  // retries, and the same quota is spent a second time. A record cannot be
  // denied, so only an unavailable guard is left to survive here.
  it.each([
    [
      'an unavailable guard',
      new GeminiQuotaUnavailableError('redis_unavailable'),
    ],
    ['an unclassified failure', new Error('recording blew up')],
  ])('still returns the generated answer after %s', async (_, failure) => {
    const warn = jest.spyOn(Logger.prototype, 'warn')
    const { adapter, quota } = buildAdapter()
    quota.recordInputTokens.mockRejectedValueOnce(failure)

    await expect(adapter.complete(preparedRequest())).resolves.toMatchObject({
      content: 'Grounded answer',
      inputTokens: 13,
      outputTokens: 5,
    })
    expect(JSON.stringify(warn.mock.calls)).toContain('quota_reconcile_failed')
  })

  it('treats an upstream preflight 429 as rate limiting', async () => {
    const { adapter, countTokens } = buildAdapter()
    countTokens.mockRejectedValueOnce({ statusCode: 429 })

    await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
      code: 'COMPLETION_RATE_LIMITED',
    })
  })

  it('treats an upstream preflight outage as a provider failure', async () => {
    const { adapter, countTokens, createInteraction } = buildAdapter()
    countTokens.mockRejectedValueOnce({ statusCode: 503 })

    await expect(adapter.complete(preparedRequest())).rejects.toMatchObject({
      code: 'COMPLETION_PROVIDER_FAILURE',
    })
    expect(createInteraction).not.toHaveBeenCalled()
  })

  // Validation lives in the constructor, so an operational script that builds
  // the adapter directly cannot bypass it.
  it.each([
    [
      'a non-callable retry delay',
      () =>
        new GeminiCompletionAdapter(
          { countTokens: jest.fn(), createInteraction: jest.fn() },
          quotaStub(),
          { model: 'gemini-test-stable', completionTimeoutMs: 30_000 },
          Date.now,
          'not-callable' as unknown as () => Promise<void>,
        ),
    ],
    [
      'a quota guard missing a method',
      () =>
        new GeminiCompletionAdapter(
          { countTokens: jest.fn(), createInteraction: jest.fn() },
          { reserveRequest: jest.fn() } as unknown as ReturnType<
            typeof quotaStub
          >,
          { model: 'gemini-test-stable', completionTimeoutMs: 30_000 },
        ),
    ],
    [
      'a quota guard that cannot record already-billed tokens',
      () =>
        new GeminiCompletionAdapter(
          { countTokens: jest.fn(), createInteraction: jest.fn() },
          {
            ...quotaStub(),
            recordInputTokens: undefined,
          } as unknown as ReturnType<typeof quotaStub>,
          { model: 'gemini-test-stable', completionTimeoutMs: 30_000 },
        ),
    ],
    [
      'an out-of-range timeout',
      () =>
        new GeminiCompletionAdapter(
          { countTokens: jest.fn(), createInteraction: jest.fn() },
          quotaStub(),
          { model: 'gemini-test-stable', completionTimeoutMs: 0 },
        ),
    ],
    [
      'a blank model id',
      () =>
        new GeminiCompletionAdapter(
          { countTokens: jest.fn(), createInteraction: jest.fn() },
          quotaStub(),
          { model: '', completionTimeoutMs: 30_000 },
        ),
    ],
    // Length alone never distinguished these. The adapter has to parse the
    // model through the same shared predicate the startup schema uses, or a
    // model ID rejected at boot could still reach the provider through the
    // factory.
    [
      'an uppercase model id',
      () => buildAdapterWithModel('Gemini-Test-Stable'),
    ],
    ['a model id with a space', () => buildAdapterWithModel('gemini test')],
    [
      'a model id with a leading separator',
      () => buildAdapterWithModel('-gemini-test-stable'),
    ],
  ])('refuses construction with %s', (_, construct) => {
    expect(construct).toThrow(
      expect.objectContaining({
        code: 'COMPLETION_CONFIGURATION_INVALID',
      }) as CompletionProviderError,
    )
  })

  it('emits content-free diagnostics only', async () => {
    const error = jest.spyOn(Logger.prototype, 'error')
    const warn = jest.spyOn(Logger.prototype, 'warn')
    const privateFailure = 'private-upstream-error'
    const { adapter, createInteraction } = buildAdapter()
    createInteraction.mockRejectedValueOnce({
      statusCode: 403,
      message: privateFailure,
    })

    const failure = await captureFailure(adapter.complete(preparedRequest()))

    expect(failure).toBeInstanceOf(CompletionProviderError)
    const serializedLogs = JSON.stringify([
      ...error.mock.calls,
      ...warn.mock.calls,
    ])
    expect(serializedLogs).not.toContain(privateFailure)
    expect(serializedLogs).not.toContain(systemInstruction)
    expect(serializedLogs).not.toContain(untrustedInput)
    expect(serializedLogs).toContain('upstream_failure')
    expect(serializedLogs).toContain('gemini-test-stable')
  })

  // A genuine failure has to be distinguishable by severity alone, so one
  // alerting rule can be written across this adapter and its ITI sibling.
  it('logs a genuine failure at error severity and a spent cap at warn', async () => {
    const error = jest.spyOn(Logger.prototype, 'error')
    const warn = jest.spyOn(Logger.prototype, 'warn')
    const outage = buildAdapter()
    outage.createInteraction.mockRejectedValue({ statusCode: 503 })
    await captureFailure(outage.adapter.complete(preparedRequest()))

    expect(error).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()

    const capped = buildAdapter()
    capped.quota.reserveRequest.mockRejectedValueOnce(
      new GeminiQuotaReservationError('requests_day'),
    )
    await captureFailure(capped.adapter.complete(preparedRequest()))

    expect(warn).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledTimes(1)
  })

  it('logs a successful completion at log severity', async () => {
    const log = jest.spyOn(Logger.prototype, 'log')
    const { adapter } = buildAdapter()

    await adapter.complete(preparedRequest())

    expect(log).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(log.mock.calls)).toContain('outcome=success')
  })
})
