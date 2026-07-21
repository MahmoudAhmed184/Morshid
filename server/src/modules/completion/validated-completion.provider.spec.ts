import { Logger } from '@nestjs/common'

import type {
  CompletionProvider,
  CompletionRequest,
  CompletionResult,
} from './completion-provider'
import { CompletionProviderError } from './completion-provider'
import { DeterministicCompletionProvider } from './deterministic-completion.provider'
import {
  DEFAULT_COMPLETION_TIMEOUT_MS,
  ValidatedCompletionProvider,
} from './validated-completion.provider'

const validResult = (): CompletionResult => ({
  content: 'Grounded result',
  provider: 'fake-provider',
  model: 'fake-model',
  promptVersion: 'grounded-completion-v1',
  inputTokens: 12,
  outputTokens: 8,
})

const validRequest = (
  overrides: Partial<CompletionRequest> = {},
): CompletionRequest => ({
  studentQuestion: 'What does this topic mean?',
  context: [
    {
      sourceTitle: 'Lecture notes',
      chunkIndex: 0,
      content: 'The supplied explanation.',
    },
  ],
  ...overrides,
})

class FakeCompletionProvider implements CompletionProvider {
  readonly complete = jest.fn(
    (_request: CompletionRequest): Promise<CompletionResult> =>
      Promise.resolve(validResult()),
  )
}

function buildProvider(
  options: {
    timeoutMs?: number
    timeoutController?: AbortController
  } = {},
) {
  const inner = new FakeCompletionProvider()
  const timeoutController = options.timeoutController ?? new AbortController()
  const timeoutSignalFactory = jest.fn(() => timeoutController.signal)
  const provider = new ValidatedCompletionProvider(
    inner,
    options.timeoutMs,
    timeoutSignalFactory,
  )

  return { inner, provider, timeoutController, timeoutSignalFactory }
}

async function captureFailure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

function expectSafeFailure(
  failure: unknown,
  code: CompletionProviderError['code'],
  privateSentinels: readonly string[] = [],
) {
  expect(failure).toBeInstanceOf(CompletionProviderError)
  const completionError = failure as CompletionProviderError
  expect(completionError.code).toBe(code)
  expect(Object.keys(completionError)).toEqual(['code'])

  const inspectable = `${completionError.message}\n${JSON.stringify(completionError)}`
  for (const sentinel of privateSentinels) {
    expect(inspectable).not.toContain(sentinel)
  }
}

function rejectUnknownForProviderTest(reason: unknown): Promise<never> {
  // Deliberately violates the normal promise convention to prove the provider
  // boundary safely handles hostile libraries that reject with arbitrary data.
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
  return Promise.reject(reason)
}

describe('ValidatedCompletionProvider request validation', () => {
  it('passes a minimized request and composed signal to the adapter', async () => {
    const { inner, provider, timeoutSignalFactory } = buildProvider()
    const callerController = new AbortController()
    const requestWithOrchestrationData = {
      ...validRequest({
        context: [
          {
            sourceTitle: 'Lecture notes',
            chunkIndex: 3,
            content: 'Authorized content',
          },
        ],
        signal: callerController.signal,
      }),
      requestId: 'must-not-reach-adapter',
    }

    await provider.complete(requestWithOrchestrationData)

    expect(timeoutSignalFactory).toHaveBeenCalledWith(
      DEFAULT_COMPLETION_TIMEOUT_MS,
    )
    expect(inner.complete).toHaveBeenCalledTimes(1)
    const adapterRequest = inner.complete.mock.calls[0][0]
    expect(adapterRequest).toEqual({
      studentQuestion: 'What does this topic mean?',
      context: [
        {
          sourceTitle: 'Lecture notes',
          chunkIndex: 3,
          content: 'Authorized content',
        },
      ],
      signal: expect.any(AbortSignal) as AbortSignal,
    })
    expect(adapterRequest.signal).not.toBe(callerController.signal)
    expect(Object.isFrozen(adapterRequest)).toBe(true)
    expect(Object.isFrozen(adapterRequest.context)).toBe(true)
  })

  it('rejects empty context with its explicit code before invoking the adapter', async () => {
    const { inner, provider, timeoutSignalFactory } = buildProvider()

    const failure = await captureFailure(
      provider.complete(validRequest({ context: [] as never })),
    )

    expectSafeFailure(failure, 'COMPLETION_EMPTY_CONTEXT')
    expect(inner.complete).not.toHaveBeenCalled()
    expect(timeoutSignalFactory).not.toHaveBeenCalled()
  })

  it.each([
    ['blank question', validRequest({ studentQuestion: ' \n\t ' })],
    [
      'blank source title',
      validRequest({
        context: [{ sourceTitle: ' ', chunkIndex: 0, content: 'valid' }],
      }),
    ],
    [
      'blank content',
      validRequest({
        context: [{ sourceTitle: 'valid', chunkIndex: 0, content: '\t' }],
      }),
    ],
    [
      'extra context field',
      validRequest({
        context: [
          {
            sourceTitle: 'valid',
            chunkIndex: 0,
            content: 'valid',
            apiKey: 'private-key-sentinel',
          },
        ] as unknown as CompletionRequest['context'],
      }),
    ],
    [
      'invalid signal',
      validRequest({ signal: 'not-a-signal' as unknown as AbortSignal }),
    ],
    ['malformed request', null as unknown as CompletionRequest],
    [
      'non-array context',
      validRequest({ context: {} as CompletionRequest['context'] }),
    ],
  ])('rejects a %s as an invalid request', async (_, malformedRequest) => {
    const { inner, provider } = buildProvider()

    const failure = await captureFailure(provider.complete(malformedRequest))

    expectSafeFailure(failure, 'COMPLETION_INVALID_REQUEST', [
      'private-key-sentinel',
    ])
    expect(inner.complete).not.toHaveBeenCalled()
  })

  it.each([
    ['negative', -1],
    ['fractional', 1.5],
    ['NaN', Number.NaN],
    ['infinite', Number.POSITIVE_INFINITY],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects a %s chunk index', async (_, chunkIndex) => {
    const { inner, provider } = buildProvider()

    const failure = await captureFailure(
      provider.complete(
        validRequest({
          context: [{ sourceTitle: 'valid', chunkIndex, content: 'valid' }],
        }),
      ),
    )

    expectSafeFailure(failure, 'COMPLETION_INVALID_REQUEST')
    expect(inner.complete).not.toHaveBeenCalled()
  })
})

describe('ValidatedCompletionProvider result validation', () => {
  it('returns a minimized valid result with optional token counts', async () => {
    const { inner, provider } = buildProvider()
    inner.complete.mockResolvedValueOnce({
      ...validResult(),
      privateRawResponse: 'must-not-reach-caller',
    } as CompletionResult)

    const failure = await captureFailure(provider.complete(validRequest()))

    expectSafeFailure(failure, 'COMPLETION_INVALID_RESULT', [
      'must-not-reach-caller',
    ])

    inner.complete.mockResolvedValueOnce(validResult())
    await expect(provider.complete(validRequest())).resolves.toEqual(
      validResult(),
    )
  })

  it.each([
    ['blank content', { ...validResult(), content: ' ' }],
    ['blank provider', { ...validResult(), provider: '' }],
    ['blank model', { ...validResult(), model: '\t' }],
    ['blank prompt version', { ...validResult(), promptVersion: ' ' }],
    [
      'wrong prompt version',
      { ...validResult(), promptVersion: 'grounded-completion-v2' },
    ],
    ['oversized provider', { ...validResult(), provider: 'p'.repeat(81) }],
    ['oversized model', { ...validResult(), model: 'm'.repeat(121) }],
    ['missing fields', { content: 'partial' } as CompletionResult],
    ['non-object result', null as unknown as CompletionResult],
  ])('rejects a %s result', async (_, malformedResult) => {
    const { inner, provider } = buildProvider()
    inner.complete.mockResolvedValueOnce(malformedResult)

    const failure = await captureFailure(provider.complete(validRequest()))

    expectSafeFailure(failure, 'COMPLETION_INVALID_RESULT')
  })

  it.each([
    ['negative input', { inputTokens: -1 }],
    ['fractional input', { inputTokens: 1.5 }],
    ['NaN output', { outputTokens: Number.NaN }],
    ['infinite output', { outputTokens: Number.POSITIVE_INFINITY }],
    ['string input', { inputTokens: '12' }],
  ])('rejects %s token counts', async (_, invalidCounts) => {
    const { inner, provider } = buildProvider()
    inner.complete.mockResolvedValueOnce({
      ...validResult(),
      ...invalidCounts,
    } as CompletionResult)

    const failure = await captureFailure(provider.complete(validRequest()))

    expectSafeFailure(failure, 'COMPLETION_INVALID_RESULT')
  })

  it('does not copy a malformed raw result into the safe error', async () => {
    const privateResult = 'private-provider-result-sentinel'
    const { inner, provider } = buildProvider()
    inner.complete.mockResolvedValueOnce({
      content: privateResult,
      provider: '',
      model: '',
      promptVersion: '',
    })

    const failure = await captureFailure(provider.complete(validRequest()))

    expectSafeFailure(failure, 'COMPLETION_INVALID_RESULT', [privateResult])
  })
})

describe('ValidatedCompletionProvider execution safety', () => {
  it('rejects a pre-aborted caller without constructing a timeout or calling the adapter', async () => {
    const privateReason = 'private-pre-abort-reason'
    const callerController = new AbortController()
    callerController.abort(privateReason)
    const { inner, provider, timeoutSignalFactory } = buildProvider()

    const failure = await captureFailure(
      provider.complete(validRequest({ signal: callerController.signal })),
    )

    expectSafeFailure(failure, 'COMPLETION_CANCELLED', [privateReason])
    expect(timeoutSignalFactory).not.toHaveBeenCalled()
    expect(inner.complete).not.toHaveBeenCalled()
  })

  it('propagates in-flight caller cancellation through a one-shot composed signal', async () => {
    const privateReason = 'private-in-flight-abort-reason'
    const callerController = new AbortController()
    const { inner, provider } = buildProvider()
    inner.complete.mockImplementationOnce(
      (request) =>
        new Promise((_, reject) => {
          expect(request.signal).toBeDefined()
          request.signal?.addEventListener(
            'abort',
            () => {
              reject(new Error(privateReason))
            },
            {
              once: true,
            },
          )
        }),
    )

    const pending = provider.complete(
      validRequest({ signal: callerController.signal }),
    )
    callerController.abort(privateReason)
    const failure = await captureFailure(pending)

    expectSafeFailure(failure, 'COMPLETION_CANCELLED', [privateReason])
  })

  it('rejects on timeout even when the adapter ignores cancellation', async () => {
    const privateReason = 'private-timeout-reason'
    const timeoutController = new AbortController()
    const { inner, provider } = buildProvider({
      timeoutMs: 321,
      timeoutController,
    })
    inner.complete.mockImplementationOnce(() => new Promise(() => undefined))

    const pending = provider.complete(validRequest())
    timeoutController.abort(privateReason)
    const failure = await captureFailure(pending)

    expectSafeFailure(failure, 'COMPLETION_TIMEOUT', [privateReason])
  })

  it('uses one-shot abort listeners and removes them after completion', async () => {
    const addListener = jest.spyOn(AbortSignal.prototype, 'addEventListener')
    const removeListener = jest.spyOn(
      AbortSignal.prototype,
      'removeEventListener',
    )
    const { provider } = buildProvider()

    await provider.complete(validRequest())

    expect(addListener).toHaveBeenCalledWith(
      'abort',
      expect.any(Function) as EventListener,
      { once: true },
    )
    expect(removeListener).toHaveBeenCalledWith(
      'abort',
      expect.any(Function) as EventListener,
    )
    addListener.mockRestore()
    removeListener.mockRestore()
  })

  it('normalizes synchronous, asynchronous, and non-Error provider failures', async () => {
    const privateFailure = 'private-upstream-error-sentinel'
    const cases: (() => unknown)[] = [
      () => {
        throw new Error(privateFailure)
      },
      () => Promise.reject(new Error(privateFailure)),
      () => rejectUnknownForProviderTest({ privateFailure }),
      () => rejectUnknownForProviderTest(privateFailure),
    ]

    for (const fail of cases) {
      const { inner, provider } = buildProvider()
      inner.complete.mockImplementationOnce(
        fail as CompletionProvider['complete'],
      )

      const failure = await captureFailure(provider.complete(validRequest()))

      expectSafeFailure(failure, 'COMPLETION_PROVIDER_FAILURE', [
        privateFailure,
      ])
    }
  })

  it('normalizes the deterministic adapter controlled failure', async () => {
    const timeoutController = new AbortController()
    const provider = new ValidatedCompletionProvider(
      new DeterministicCompletionProvider('fail'),
      DEFAULT_COMPLETION_TIMEOUT_MS,
      () => timeoutController.signal,
    )

    const failure = await captureFailure(provider.complete(validRequest()))

    expectSafeFailure(failure, 'COMPLETION_PROVIDER_FAILURE', [
      'deterministic controlled failure',
    ])
  })

  it('does not emit prompt, result, or failure logs', async () => {
    const privateSentinels = [
      'private-student-question',
      'private-source-title',
      'private-chunk-content',
      'private-upstream-failure',
    ]
    const loggerSpies = [
      jest.spyOn(Logger.prototype, 'log'),
      jest.spyOn(Logger.prototype, 'warn'),
      jest.spyOn(Logger.prototype, 'error'),
    ]
    const { inner, provider } = buildProvider()
    inner.complete.mockRejectedValueOnce(new Error(privateSentinels[3]))

    await captureFailure(
      provider.complete({
        studentQuestion: privateSentinels[0],
        context: [
          {
            sourceTitle: privateSentinels[1],
            chunkIndex: 0,
            content: privateSentinels[2],
          },
        ],
      }),
    )

    for (const spy of loggerSpies) {
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    }
  })
})
