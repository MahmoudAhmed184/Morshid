import {
  GeminiChatProjectPool,
  GeminiChatProjectPoolUnavailableError,
  isGeminiOpenAICompatibleBaseUrl,
  type GeminiChatProjectPoolRedisClient,
} from './gemini-chat-project-pool'

const geminiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai'

const projects = Object.freeze([
  Object.freeze({
    id: 'chat-project-01',
    apiKey: 'first-secret-api-key-value',
  }),
  Object.freeze({
    id: 'chat-project-02',
    apiKey: 'second-secret-api-key-value',
  }),
])

describe('GeminiChatProjectPool', () => {
  it('maps an atomic Redis selection back to the in-memory credential', async () => {
    const redis = new RecordingRedis([[1, '1']])
    const pool = new GeminiChatProjectPool(redis, projects)

    await expect(pool.select(new Set())).resolves.toEqual({
      kind: 'selected',
      project: projects[1],
    })

    expect(redis.calls[0]?.keys).toHaveLength(1)
    expect(JSON.stringify(redis.calls[0])).not.toContain(projects[0].id)
    expect(JSON.stringify(redis.calls[0])).not.toContain(projects[0].apiKey)
  })

  it('returns the shared retry delay when every project is cooling down', async () => {
    const pool = new GeminiChatProjectPool(
      new RecordingRedis([[0, '1750']]),
      projects,
    )

    await expect(pool.select(new Set())).resolves.toEqual({
      kind: 'exhausted',
      retryAfterMs: 1750,
    })
  })

  it('records a rate-limit cooldown without sending project identity or secrets to Redis', async () => {
    const redis = new RecordingRedis([[1, '1250']])
    const pool = new GeminiChatProjectPool(redis, projects, () => 0.5)

    await expect(pool.markRateLimited(projects[0].id, 750)).resolves.toBe(1250)

    expect(JSON.stringify(redis.calls[0])).not.toContain(projects[0].id)
    expect(JSON.stringify(redis.calls[0])).not.toContain(projects[0].apiKey)
    expect(JSON.parse(redis.calls[0]?.arguments[0] ?? '{}')).toMatchObject({
      providerDelayMs: 750,
      jitterMs: 125,
    })
  })

  it('fails closed when Redis rejects or replies with an invalid selection', async () => {
    const rejectingPool = new GeminiChatProjectPool(
      new RecordingRedis([new Error('redis unavailable')]),
      projects,
    )
    const invalidPool = new GeminiChatProjectPool(
      new RecordingRedis([[1, '99']]),
      projects,
    )

    await expect(rejectingPool.select(new Set())).rejects.toBeInstanceOf(
      GeminiChatProjectPoolUnavailableError,
    )
    await expect(invalidPool.select(new Set())).rejects.toBeInstanceOf(
      GeminiChatProjectPoolUnavailableError,
    )
  })
})

describe('Gemini chat project configuration', () => {
  it('accepts the pinned Gemini OpenAI-compatible endpoint with an optional trailing slash', () => {
    expect(isGeminiOpenAICompatibleBaseUrl(geminiBaseUrl)).toBe(true)
    expect(isGeminiOpenAICompatibleBaseUrl(`${geminiBaseUrl}/`)).toBe(true)
    expect(
      isGeminiOpenAICompatibleBaseUrl('https://models.example.test/v1'),
    ).toBe(false)
  })

  it('rejects duplicate projects, duplicate credentials, and malformed entries', () => {
    expect(
      () =>
        new GeminiChatProjectPool(new RecordingRedis([]), [
          projects[0],
          { ...projects[1], id: projects[0].id },
        ]),
    ).toThrow(TypeError)
    expect(
      () =>
        new GeminiChatProjectPool(new RecordingRedis([]), [
          projects[0],
          { ...projects[1], apiKey: projects[0].apiKey },
        ]),
    ).toThrow(TypeError)
    expect(() => new GeminiChatProjectPool(new RecordingRedis([]), [])).toThrow(
      TypeError,
    )
  })
})

interface RedisCall {
  readonly keys: readonly string[]
  readonly arguments: readonly string[]
}

class RecordingRedis implements GeminiChatProjectPoolRedisClient {
  readonly calls: RedisCall[] = []

  constructor(private readonly replies: unknown[]) {}

  eval(
    _script: string,
    options: {
      readonly keys: readonly string[]
      readonly arguments: readonly string[]
    },
  ): Promise<unknown> {
    this.calls.push(options)
    const reply = this.replies.shift()
    return reply instanceof Error
      ? Promise.reject(reply)
      : Promise.resolve(reply)
  }
}
