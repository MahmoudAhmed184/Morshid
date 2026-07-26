import { EMBEDDING_DIMENSIONS } from '../../embedding-provider'
import {
  EmbeddingConfigurationError,
  EmbeddingUpstreamError,
} from '../../embedding-provider'
import {
  GeminiEmbeddingAdapter,
  estimateInputUnits,
  validateGeminiEmbeddingConfiguration,
  type GeminiEmbeddingConfiguration,
  type GeminiEmbeddingRequest,
} from './gemini-embedding.adapter'
import {
  GEMINI_EMBEDDING_BATCH_SIZE,
  GEMINI_EMBEDDING_DOCUMENT_PROFILE,
  GEMINI_EMBEDDING_QUERY_PROTOCOL,
} from './gemini-embedding.constants'

function buildVectorValues(fill = 0.1): number[] {
  return new Array<number>(EMBEDDING_DIMENSIONS).fill(fill)
}

function buildResponse(count: number): unknown {
  return {
    embeddings: Array.from({ length: count }, () => ({
      values: buildVectorValues(),
    })),
  }
}

interface Harness {
  configuration: GeminiEmbeddingConfiguration
  embedContent: jest.Mock
  reserveGeneration: jest.Mock
  requests: GeminiEmbeddingRequest[]
  advanceClock: (ms: number) => void
  timeoutSignals: number[]
}

function buildHarness(
  overrides: {
    embedContent?: jest.Mock
    reserveGeneration?: jest.Mock
    queryTimeoutMs?: number
    documentTimeoutMs?: number
    requestTimeoutMs?: number
    createTimeoutSignal?: (timeoutMs: number) => AbortSignal
  } = {},
): Harness {
  const requests: GeminiEmbeddingRequest[] = []
  const embedContent =
    overrides.embedContent ??
    jest.fn((request: GeminiEmbeddingRequest) =>
      Promise.resolve(buildResponse((request.contents as unknown[]).length)),
    )
  const reserveGeneration =
    overrides.reserveGeneration ?? jest.fn(() => Promise.resolve())

  let nowMs = 1_000_000
  const timeoutSignals: number[] = []

  const configuration: GeminiEmbeddingConfiguration = {
    client: {
      // The single recording point: pushing in both the stub and the wrapper
      // would double-count every request.
      embedContent: (request) => {
        requests.push(request)
        return embedContent(request) as Promise<unknown>
      },
    },
    quota: {
      reserveGeneration: (units) => reserveGeneration(units) as Promise<void>,
    },
    options: {
      queryTimeoutMs: overrides.queryTimeoutMs ?? 10_000,
      documentTimeoutMs: overrides.documentTimeoutMs ?? 120_000,
      requestTimeoutMs: overrides.requestTimeoutMs ?? 30_000,
    },
    clock: () => nowMs,
    createTimeoutSignal: (timeoutMs) => {
      timeoutSignals.push(timeoutMs)
      return (
        overrides.createTimeoutSignal?.(timeoutMs) ??
        new AbortController().signal
      )
    },
  }

  return {
    configuration,
    embedContent,
    reserveGeneration,
    requests,
    advanceClock: (ms: number) => {
      nowMs += ms
    },
    timeoutSignals,
  }
}

describe('GeminiEmbeddingAdapter', () => {
  it('reports the pinned document profile and query protocol', () => {
    const adapter = new GeminiEmbeddingAdapter(buildHarness().configuration)

    expect(adapter.model).toBe(GEMINI_EMBEDDING_DOCUMENT_PROFILE)
    expect(adapter.model).toBe('gemini/gemini-embedding-2/1536/document-v1')
    expect(adapter.queryProtocol).toBe(GEMINI_EMBEDDING_QUERY_PROTOCOL)
    expect(adapter.queryProtocol).toBe(
      'gemini/gemini-embedding-2/question-answering-v1',
    )
  })

  describe('request shape', () => {
    it('pins the model, dimensionality, and API version', async () => {
      const harness = buildHarness()
      await new GeminiEmbeddingAdapter(harness.configuration).embedQuery('q')

      const [request] = harness.requests
      expect(request.model).toBe('gemini-embedding-2')
      expect(request.config.outputDimensionality).toBe(1_536)
      // The embeddings route lives under v1beta; completion pins v1. Neither
      // may be inherited by accident.
      expect(request.config.httpOptions?.apiVersion).toBe('v1beta')
    })

    it('disables the SDK-level retry so the adapter owns its own policy', async () => {
      const harness = buildHarness()
      await new GeminiEmbeddingAdapter(harness.configuration).embedQuery('q')

      expect(harness.requests[0].config.httpOptions?.retryOptions).toEqual({
        attempts: 1,
      })
    })

    // Passing a bare string[] makes the SDK's tContents() fold the array into
    // ONE Content with several parts, returning a single aggregated vector.
    it('sends each input as its own Content, never a bare string array', async () => {
      const harness = buildHarness()
      await new GeminiEmbeddingAdapter(harness.configuration).embedDocuments([
        { text: 'first', title: 'Week 1' },
        { text: 'second', title: 'Week 1' },
      ])

      expect(harness.requests[0].contents).toEqual([
        { parts: [{ text: 'title: Week 1 | text: first' }] },
        { parts: [{ text: 'title: Week 1 | text: second' }] },
      ])
    })

    it('sends the query envelope for a query', async () => {
      const harness = buildHarness()
      await new GeminiEmbeddingAdapter(harness.configuration).embedQuery(
        'what is a variable?',
      )

      expect(harness.requests[0].contents).toEqual([
        {
          parts: [
            {
              text: 'task: question answering | query: what is a variable?',
            },
          ],
        },
      ])
    })

    it('never sends taskType, which this model does not support', async () => {
      const harness = buildHarness()
      await new GeminiEmbeddingAdapter(harness.configuration).embedQuery('q')

      expect(Object.keys(harness.requests[0].config)).not.toContain('taskType')
    })
  })

  describe('batching', () => {
    it('splits documents into batches of the configured size', async () => {
      const harness = buildHarness()
      const documents = Array.from(
        { length: GEMINI_EMBEDDING_BATCH_SIZE + 5 },
        (_, index) => ({ text: `chunk ${String(index)}` }),
      )

      const vectors = await new GeminiEmbeddingAdapter(
        harness.configuration,
      ).embedDocuments(documents)

      expect(vectors).toHaveLength(GEMINI_EMBEDDING_BATCH_SIZE + 5)
      expect(harness.requests).toHaveLength(2)
      expect((harness.requests[0].contents as unknown[]).length).toBe(
        GEMINI_EMBEDDING_BATCH_SIZE,
      )
      expect((harness.requests[1].contents as unknown[]).length).toBe(5)
    })

    it('returns vectors in input order across batches', async () => {
      const harness = buildHarness({
        embedContent: jest.fn(),
      })
      let call = 0
      harness.embedContent.mockImplementation(
        (request: GeminiEmbeddingRequest) => {
          const size = (request.contents as unknown[]).length
          const fill = call === 0 ? 0.1 : 0.2
          call += 1
          return Promise.resolve({
            embeddings: Array.from({ length: size }, () => ({
              values: buildVectorValues(fill),
            })),
          })
        },
      )

      const documents = Array.from(
        { length: GEMINI_EMBEDDING_BATCH_SIZE + 1 },
        (_, index) => ({ text: `chunk ${String(index)}` }),
      )
      const vectors = await new GeminiEmbeddingAdapter(
        harness.configuration,
      ).embedDocuments(documents)

      expect(vectors[0][0]).toBe(0.1)
      expect(vectors[GEMINI_EMBEDDING_BATCH_SIZE][0]).toBe(0.2)
    })
  })

  describe('quota', () => {
    // The reservation is atomic and happens before the upstream call, so an
    // exhausted budget makes zero calls to Google.
    it('reserves before calling upstream', async () => {
      const harness = buildHarness()
      await new GeminiEmbeddingAdapter(harness.configuration).embedQuery('q')

      expect(
        harness.reserveGeneration.mock.invocationCallOrder[0],
      ).toBeLessThan(harness.embedContent.mock.invocationCallOrder[0])
    })

    it('makes no upstream call when the budget is exhausted', async () => {
      const harness = buildHarness({
        reserveGeneration: jest.fn(() =>
          Promise.reject(
            Object.assign(new Error('denied'), { kind: 'quota_exhausted' }),
          ),
        ),
      })

      await expect(
        new GeminiEmbeddingAdapter(harness.configuration).embedQuery('q'),
      ).rejects.toMatchObject({ code: 'EMBEDDING_RATE_LIMITED' })
      expect(harness.embedContent).not.toHaveBeenCalled()
    })

    // A guard that cannot decide is an infrastructure fault, not a spent
    // budget: reporting it as a rate limit would tell the caller to back off
    // from something that is not throttling it.
    it('reports an undecidable guard as a provider failure, not a rate limit', async () => {
      const harness = buildHarness({
        reserveGeneration: jest.fn(() =>
          Promise.reject(
            Object.assign(new Error('unavailable'), {
              kind: 'quota_unavailable',
            }),
          ),
        ),
      })

      await expect(
        new GeminiEmbeddingAdapter(harness.configuration).embedQuery('q'),
      ).rejects.toMatchObject({ code: 'EMBEDDING_PROVIDER_FAILURE' })
    })

    it('reserves once per upstream request', async () => {
      const harness = buildHarness()
      const documents = Array.from(
        { length: GEMINI_EMBEDDING_BATCH_SIZE + 1 },
        (_, index) => ({ text: `chunk ${String(index)}` }),
      )

      await new GeminiEmbeddingAdapter(harness.configuration).embedDocuments(
        documents,
      )

      expect(harness.reserveGeneration).toHaveBeenCalledTimes(2)
    })

    // The estimate covers the FINAL formatted input, prefix and framing
    // included: what is sent upstream is what is debited.
    it('estimates the formatted input, not the raw text', async () => {
      const harness = buildHarness()
      await new GeminiEmbeddingAdapter(harness.configuration).embedQuery('abc')

      expect(harness.reserveGeneration).toHaveBeenCalledWith(
        Buffer.byteLength('task: question answering | query: abc', 'utf8'),
      )
    })
  })

  describe('response parsing', () => {
    // One embedding for one input is valid; one embedding for MANY inputs is
    // the SDK aggregation trap, and would persist one averaged vector against
    // every chunk.
    it('rejects an aggregated response for a multi-input request', async () => {
      const harness = buildHarness({ embedContent: jest.fn() })
      harness.embedContent.mockImplementation(() =>
        Promise.resolve(buildResponse(1)),
      )

      await expect(
        new GeminiEmbeddingAdapter(harness.configuration).embedDocuments([
          { text: 'a' },
          { text: 'b' },
        ]),
      ).rejects.toMatchObject({ code: 'EMBEDDING_PROVIDER_FAILURE' })
    })

    it('accepts one embedding for one input', async () => {
      const harness = buildHarness()

      await expect(
        new GeminiEmbeddingAdapter(harness.configuration).embedDocuments([
          { text: 'a' },
        ]),
      ).resolves.toHaveLength(1)
    })

    it.each([
      ['a non-object response', 'not an object'],
      ['a missing embeddings array', { embeddings: undefined }],
      ['a non-array embeddings field', { embeddings: 'nope' }],
    ])('rejects %s', async (_, response) => {
      const harness = buildHarness({ embedContent: jest.fn() })
      harness.embedContent.mockImplementation(() => Promise.resolve(response))

      await expect(
        new GeminiEmbeddingAdapter(harness.configuration).embedQuery('q'),
      ).rejects.toBeInstanceOf(EmbeddingUpstreamError)
    })

    it('rejects a wrong vector count', async () => {
      const harness = buildHarness({ embedContent: jest.fn() })
      harness.embedContent.mockImplementation(() =>
        Promise.resolve(buildResponse(3)),
      )

      await expect(
        new GeminiEmbeddingAdapter(harness.configuration).embedDocuments([
          { text: 'a' },
          { text: 'b' },
        ]),
      ).rejects.toMatchObject({ code: 'EMBEDDING_PROVIDER_FAILURE' })
    })

    it('rejects a vector with the wrong dimensionality', async () => {
      const harness = buildHarness({ embedContent: jest.fn() })
      harness.embedContent.mockImplementation(() =>
        Promise.resolve({ embeddings: [{ values: [0.1, 0.2] }] }),
      )

      await expect(
        new GeminiEmbeddingAdapter(harness.configuration).embedQuery('q'),
      ).rejects.toMatchObject({ code: 'EMBEDDING_PROVIDER_FAILURE' })
    })

    it('rejects a vector with a non-finite component', async () => {
      const harness = buildHarness({ embedContent: jest.fn() })
      const values = buildVectorValues()
      values[5] = Number.NaN
      harness.embedContent.mockImplementation(() =>
        Promise.resolve({ embeddings: [{ values }] }),
      )

      await expect(
        new GeminiEmbeddingAdapter(harness.configuration).embedQuery('q'),
      ).rejects.toMatchObject({ code: 'EMBEDDING_PROVIDER_FAILURE' })
    })
  })

  describe('deadlines', () => {
    it('caps a request by the per-request budget', async () => {
      const harness = buildHarness({ requestTimeoutMs: 5_000 })
      await new GeminiEmbeddingAdapter(harness.configuration).embedQuery('q')

      // The whole-call signal bounds quota admission; the second signal bounds
      // the upstream request by the configured per-request budget.
      expect(harness.timeoutSignals).toEqual([10_000, 5_000])
    })

    // Checking the whole-call budget only BETWEEN sub-batches would leave the
    // final request unbounded.
    it('caps a request by the remaining whole-call budget', async () => {
      const harness = buildHarness({
        queryTimeoutMs: 2_000,
        requestTimeoutMs: 30_000,
      })
      await new GeminiEmbeddingAdapter(harness.configuration).embedQuery('q')

      expect(harness.timeoutSignals).toEqual([2_000, 2_000])
    })

    it('recomputes the deadline after quota admission and makes no late upstream call', async () => {
      const harness = buildHarness({ documentTimeoutMs: 1_000 })
      const adapter = new GeminiEmbeddingAdapter(harness.configuration)
      harness.reserveGeneration.mockImplementation(() => {
        harness.advanceClock(5_000)
        return Promise.resolve()
      })

      // First batch consumes the budget; the second must not be issued.
      const documents = Array.from(
        { length: GEMINI_EMBEDDING_BATCH_SIZE + 1 },
        (_, index) => ({ text: `chunk ${String(index)}` }),
      )

      await expect(adapter.embedDocuments(documents)).rejects.toMatchObject({
        code: 'EMBEDDING_TIMEOUT',
      })
      expect(harness.embedContent).not.toHaveBeenCalled()
    })

    it('bounds a quota reservation that never settles', async () => {
      const controllers: AbortController[] = []
      const harness = buildHarness({
        reserveGeneration: jest.fn(() => new Promise<void>(() => undefined)),
        createTimeoutSignal: () => {
          const controller = new AbortController()
          controllers.push(controller)
          return controller.signal
        },
      })
      const embedding = new GeminiEmbeddingAdapter(
        harness.configuration,
      ).embedQuery('q')

      await Promise.resolve()
      controllers[0].abort()

      await expect(embedding).rejects.toMatchObject({
        code: 'EMBEDDING_TIMEOUT',
      })
      expect(harness.embedContent).not.toHaveBeenCalled()
    })

    it('reports an upstream abort as cancellation', async () => {
      const harness = buildHarness({ embedContent: jest.fn() })
      harness.embedContent.mockImplementation(() =>
        Promise.reject(
          Object.assign(new Error('aborted'), { name: 'AbortError' }),
        ),
      )

      await expect(
        new GeminiEmbeddingAdapter(harness.configuration).embedQuery('q'),
      ).rejects.toMatchObject({ code: 'EMBEDDING_CANCELLED' })
    })

    it('reports an upstream timeout as a timeout', async () => {
      const harness = buildHarness({ embedContent: jest.fn() })
      harness.embedContent.mockImplementation(() =>
        Promise.reject(
          Object.assign(new Error('timed out'), { name: 'TimeoutError' }),
        ),
      )

      await expect(
        new GeminiEmbeddingAdapter(harness.configuration).embedQuery('q'),
      ).rejects.toMatchObject({ code: 'EMBEDDING_TIMEOUT' })
    })

    // A provider-side throttle tells the caller to back off; a generic provider
    // failure does not. The pinned SDK throws a plain Error carrying the status
    // only in its message, so message shape is the only available signal.
    it.each([
      ['the SDK rate-limit message', 'Retryable HTTP Error: Too Many Requests'],
      ['a RESOURCE_EXHAUSTED message', 'RESOURCE_EXHAUSTED: quota exceeded'],
      ['a bare 429 message', 'request failed with 429'],
    ])('reports %s as rate limited', async (_, message) => {
      const harness = buildHarness({ embedContent: jest.fn() })
      harness.embedContent.mockImplementation(() =>
        Promise.reject(new Error(message)),
      )

      await expect(
        new GeminiEmbeddingAdapter(harness.configuration).embedQuery('q'),
      ).rejects.toMatchObject({ code: 'EMBEDDING_RATE_LIMITED' })
    })

    it('reports a reflective 429 status as rate limited', async () => {
      const harness = buildHarness({ embedContent: jest.fn() })
      harness.embedContent.mockImplementation(() =>
        Promise.reject(Object.assign(new Error('throttled'), { status: 429 })),
      )

      await expect(
        new GeminiEmbeddingAdapter(harness.configuration).embedQuery('q'),
      ).rejects.toMatchObject({ code: 'EMBEDDING_RATE_LIMITED' })
    })

    it('keeps a non-429 status a provider failure', async () => {
      const harness = buildHarness({ embedContent: jest.fn() })
      harness.embedContent.mockImplementation(() =>
        Promise.reject(Object.assign(new Error('boom'), { status: 500 })),
      )

      await expect(
        new GeminiEmbeddingAdapter(harness.configuration).embedQuery('q'),
      ).rejects.toMatchObject({ code: 'EMBEDDING_PROVIDER_FAILURE' })
    })

    it('reports any other upstream failure as a provider failure', async () => {
      const harness = buildHarness({ embedContent: jest.fn() })
      harness.embedContent.mockImplementation(() =>
        Promise.reject(new Error('internal error from Google')),
      )

      await expect(
        new GeminiEmbeddingAdapter(harness.configuration).embedQuery('q'),
      ).rejects.toMatchObject({ code: 'EMBEDDING_PROVIDER_FAILURE' })
    })
  })

  describe('errors carry nothing from upstream', () => {
    it('never attaches a cause', async () => {
      const harness = buildHarness({ embedContent: jest.fn() })
      const upstream = new Error('secret-bearing upstream message')
      harness.embedContent.mockImplementation(() => Promise.reject(upstream))

      const failure = await new GeminiEmbeddingAdapter(harness.configuration)
        .embedQuery('q')
        .catch((error: unknown) => error)

      expect(failure).toBeInstanceOf(EmbeddingUpstreamError)
      expect((failure as { cause?: unknown }).cause).toBeUndefined()
    })

    it('uses a fixed message per code', async () => {
      const harness = buildHarness({ embedContent: jest.fn() })
      harness.embedContent.mockImplementation(() =>
        Promise.reject(new Error('AIzaSy-leaked-key in message')),
      )

      const failure = await new GeminiEmbeddingAdapter(harness.configuration)
        .embedQuery('q')
        .catch((error: unknown) => error)

      expect((failure as Error).message).toBe('Embedding provider failed')
    })
  })
})

describe('validateGeminiEmbeddingConfiguration', () => {
  it('accepts a complete configuration', () => {
    expect(() =>
      validateGeminiEmbeddingConfiguration(buildHarness().configuration),
    ).not.toThrow()
  })

  it.each([
    ['a non-object', 'nope'],
    ['null', null],
    ['a missing client', { quota: { reserveGeneration: () => undefined } }],
  ])('rejects %s', (_, configuration) => {
    expect(() => validateGeminiEmbeddingConfiguration(configuration)).toThrow(
      EmbeddingConfigurationError,
    )
  })

  it.each(['queryTimeoutMs', 'documentTimeoutMs', 'requestTimeoutMs'] as const)(
    'rejects a non-positive %s',
    (key) => {
      const { configuration } = buildHarness()

      expect(() =>
        validateGeminiEmbeddingConfiguration({
          ...configuration,
          options: { ...configuration.options, [key]: 0 },
        }),
      ).toThrow(EmbeddingConfigurationError)
    },
  )

  // The adapter validates again in its own constructor: the factory is not the
  // only construction path.
  it('is re-applied by the adapter constructor', () => {
    expect(() => new GeminiEmbeddingAdapter('nope' as never)).toThrow(
      EmbeddingConfigurationError,
    )
  })
})

describe('estimateInputUnits', () => {
  it('debits UTF-8 byte length', () => {
    expect(estimateInputUnits(['abc'])).toBe(3)
  })

  it('counts multi-byte scripts by their byte cost', () => {
    // Arabic costs two UTF-8 bytes per code point; the estimate is deliberately
    // conservative rather than a code-point count.
    expect(estimateInputUnits(['مرحبا'])).toBe(10)
  })

  it('sums across a batch', () => {
    expect(estimateInputUnits(['ab', 'cde'])).toBe(5)
  })
})
