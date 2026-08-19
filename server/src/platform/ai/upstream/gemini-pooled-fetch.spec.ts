import {
  type GeminiChatProjectPoolPort,
  GeminiChatProjectPoolUnavailableError,
  type GeminiChatProjectSelection,
} from './gemini-chat-project-pool'
import {
  createGeminiPooledFetch,
  resolveChatTransport,
} from './gemini-pooled-fetch'
import {
  STRUCTURED_CHAT_ERROR_CODE,
  type StructuredChatTransportError,
} from './structured-chat.transport'

const geminiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai'

const firstProject = Object.freeze({
  id: 'chat-project-01',
  apiKey: 'first-secret-api-key-value',
})
const secondProject = Object.freeze({
  id: 'chat-project-02',
  apiKey: 'second-secret-api-key-value',
})

describe('createGeminiPooledFetch', () => {
  it.each([
    'gemini-3.6-flash',
    'gemini-3.6-flash-001',
    'gemini-3.7-flash',
    'gemini-3.7-flash-preview',
  ])('removes unsupported sampling parameters for %s', async (model) => {
    const pool = new FakePool([{ kind: 'selected', project: firstProject }])
    const upstream = jest.fn<
      Promise<Response>,
      [string | URL | Request, RequestInit?]
    >(() => Promise.resolve(new Response('ok', { status: 200 })))
    const body = JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 0,
      top_p: 1,
      max_completion_tokens: 256,
      response_format: { type: 'json_object' },
    })

    await createGeminiPooledFetch(pool, upstream)(
      `${geminiBaseUrl}/chat/completions`,
      { method: 'POST', body },
    )

    expect(readJsonBody(upstream.mock.calls[0]?.[1])).toEqual({
      model,
      messages: [{ role: 'user', content: 'hello' }],
      max_completion_tokens: 256,
      response_format: { type: 'json_object' },
    })
  })

  it('preserves sampling parameters for the unchanged Gemini 3.5 analysis model', async () => {
    const pool = new FakePool([{ kind: 'selected', project: firstProject }])
    const upstream = jest.fn<
      Promise<Response>,
      [string | URL | Request, RequestInit?]
    >(() => Promise.resolve(new Response('ok', { status: 200 })))
    const body = JSON.stringify({
      model: 'gemini-3.5-flash',
      temperature: 0,
      top_p: 1,
    })

    await createGeminiPooledFetch(pool, upstream)(
      `${geminiBaseUrl}/chat/completions`,
      { method: 'POST', body },
    )

    expect(readJsonBody(upstream.mock.calls[0]?.[1])).toEqual({
      model: 'gemini-3.5-flash',
      temperature: 0,
      top_p: 1,
    })
  })

  it('switches immediately to the next project after a 429', async () => {
    const pool = new FakePool([
      { kind: 'selected', project: firstProject },
      { kind: 'selected', project: secondProject },
    ])
    const upstream = jest
      .fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
      .mockResolvedValueOnce(
        new Response('{}', {
          status: 429,
          headers: { 'retry-after-ms': '1750' },
        }),
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    const pooledFetch = createGeminiPooledFetch(pool, upstream, () => 0)

    await expect(
      pooledFetch('https://example.test/chat', {
        headers: { Authorization: 'Bearer unused-role-key' },
      }).then((response) => response.text()),
    ).resolves.toBe('ok')

    expect(upstream).toHaveBeenCalledTimes(2)
    expect(readAuthorization(upstream.mock.calls[0]?.[1])).toBe(
      `Bearer ${firstProject.apiKey}`,
    )
    expect(readAuthorization(upstream.mock.calls[1]?.[1])).toBe(
      `Bearer ${secondProject.apiKey}`,
    )
    expect(pool.marked).toEqual([
      { projectId: firstProject.id, providerDelayMs: 1750 },
    ])
    expect([...pool.exclusions[1]]).toEqual([firstProject.id])
  })

  it('switches immediately to the next project after a 401 unauthenticated response', async () => {
    const pool = new FakePool([
      { kind: 'selected', project: firstProject },
      { kind: 'selected', project: secondProject },
    ])
    const upstream = jest
      .fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
      .mockResolvedValueOnce(new Response('unauthenticated', { status: 401 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    const pooledFetch = createGeminiPooledFetch(pool, upstream, () => 0)

    await expect(
      pooledFetch('https://example.test/chat').then((response) =>
        response.text(),
      ),
    ).resolves.toBe('ok')

    expect(upstream).toHaveBeenCalledTimes(2)
    expect(pool.marked).toEqual([
      { projectId: firstProject.id, providerDelayMs: 30000 },
    ])
    expect([...pool.exclusions[1]]).toEqual([firstProject.id])
  })

  it('switches immediately to the next project after a 503 service unavailable response', async () => {
    const pool = new FakePool([
      { kind: 'selected', project: firstProject },
      { kind: 'selected', project: secondProject },
    ])
    const upstream = jest
      .fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    const pooledFetch = createGeminiPooledFetch(pool, upstream, () => 0)

    await expect(
      pooledFetch('https://example.test/chat').then((response) =>
        response.text(),
      ),
    ).resolves.toBe('ok')

    expect(upstream).toHaveBeenCalledTimes(2)
    expect(pool.marked).toEqual([
      { projectId: firstProject.id, providerDelayMs: 250 },
    ])
    expect([...pool.exclusions[1]]).toEqual([firstProject.id])
  })

  it('switches immediately to the next project after a 500 internal server error response', async () => {
    const pool = new FakePool([
      { kind: 'selected', project: firstProject },
      { kind: 'selected', project: secondProject },
    ])
    const upstream = jest
      .fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    const pooledFetch = createGeminiPooledFetch(pool, upstream, () => 0)

    await expect(
      pooledFetch('https://example.test/chat').then((response) =>
        response.text(),
      ),
    ).resolves.toBe('ok')

    expect(upstream).toHaveBeenCalledTimes(2)
    expect(pool.marked).toEqual([
      { projectId: firstProject.id, providerDelayMs: 250 },
    ])
    expect([...pool.exclusions[1]]).toEqual([firstProject.id])
  })

  it('returns one bounded 429 after every configured project refuses', async () => {
    const pool = new FakePool(
      [
        { kind: 'selected', project: firstProject },
        { kind: 'selected', project: secondProject },
      ],
      [2200, 4100],
    )
    const upstream = jest.fn(() =>
      Promise.resolve(new Response('{}', { status: 429 })),
    )

    const response = await createGeminiPooledFetch(
      pool,
      upstream,
    )('https://example.test/chat')

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after-ms')).toBe('2200')
    expect(upstream).toHaveBeenCalledTimes(2)
  })

  it('returns the earliest shared cooldown without calling Gemini', async () => {
    const pool = new FakePool([{ kind: 'exhausted', retryAfterMs: 3200 }])
    const upstream = jest.fn<Promise<Response>, [string | URL | Request]>()

    const response = await createGeminiPooledFetch(
      pool,
      upstream,
    )('https://example.test/chat')

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after-ms')).toBe('3200')
    expect(upstream).not.toHaveBeenCalled()
  })

  it('maps unavailable shared state to a provider-unavailable transport error', async () => {
    const pool: GeminiChatProjectPoolPort = {
      size: 1,
      select: () => Promise.reject(new GeminiChatProjectPoolUnavailableError()),
      markRateLimited: () => Promise.resolve(1),
    }

    await expect(
      createGeminiPooledFetch(pool)('https://example.test/chat'),
    ).rejects.toMatchObject({
      code: STRUCTURED_CHAT_ERROR_CODE.PROVIDER_UNAVAILABLE,
    } satisfies Partial<StructuredChatTransportError>)
  })
})

describe('resolveChatTransport', () => {
  it('uses the pool without retaining a stale role key for Gemini', () => {
    const pooledFetch = jest.fn<Promise<Response>, [string | URL | Request]>()
    const defaultFetch = jest.fn<Promise<Response>, [string | URL | Request]>()

    expect(
      resolveChatTransport(
        geminiBaseUrl,
        'stale-single-gemini-key',
        pooledFetch,
        defaultFetch,
      ),
    ).toEqual({
      apiKey: null,
      fetchImplementation: pooledFetch,
    })
  })

  it('preserves the role key and ordinary fetch for non-Gemini gateways', () => {
    const pooledFetch = jest.fn<Promise<Response>, [string | URL | Request]>()
    const defaultFetch = jest.fn<Promise<Response>, [string | URL | Request]>()

    expect(
      resolveChatTransport(
        'https://models.example.test/v1',
        'gateway-role-key',
        pooledFetch,
        defaultFetch,
      ),
    ).toEqual({
      apiKey: 'gateway-role-key',
      fetchImplementation: defaultFetch,
    })
  })

  it('fails closed when Gemini is selected without a composed pool', () => {
    expect(() => resolveChatTransport(geminiBaseUrl, '', null)).toThrow(
      'Gemini chat project pool was not composed',
    )
  })
})

function readAuthorization(init: RequestInit | undefined): string | null {
  return new Headers(init?.headers).get('Authorization')
}

function readJsonBody(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== 'string') {
    throw new TypeError('Expected a JSON request body')
  }
  return JSON.parse(init.body) as unknown
}

class FakePool implements GeminiChatProjectPoolPort {
  readonly exclusions: ReadonlySet<string>[] = []
  readonly marked: { projectId: string; providerDelayMs: number }[] = []
  readonly size: number

  constructor(
    private readonly selections: GeminiChatProjectSelection[],
    private readonly cooldowns: number[] = [1750],
  ) {
    this.size = Math.max(
      1,
      selections.filter((selection) => selection.kind === 'selected').length,
    )
  }

  select(
    excludedProjectIds: ReadonlySet<string>,
  ): Promise<GeminiChatProjectSelection> {
    this.exclusions.push(new Set(excludedProjectIds))
    const selection = this.selections.shift()
    return selection === undefined
      ? Promise.resolve({ kind: 'exhausted', retryAfterMs: 1 })
      : Promise.resolve(selection)
  }

  markRateLimited(projectId: string, providerDelayMs: number): Promise<number> {
    this.marked.push({ projectId, providerDelayMs })
    return Promise.resolve(this.cooldowns.shift() ?? 1)
  }
}
