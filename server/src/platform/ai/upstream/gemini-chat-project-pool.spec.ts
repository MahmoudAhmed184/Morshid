import {
  GeminiChatProjectPool,
  GeminiChatProjectPoolUnavailableError,
  MAX_GEMINI_CHAT_PROJECTS,
  inspectGeminiChatProjectsJson,
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

function createProjects(count: number) {
  return Object.freeze(
    Array.from({ length: count }, (_, index) =>
      Object.freeze({
        id: `chat-project-${String(index + 1).padStart(3, '0')}`,
        apiKey: `secret-api-key-value-${String(index + 1).padStart(3, '0')}`,
      }),
    ),
  )
}

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

  it('selects normally from a pool larger than the former 32-project cap', async () => {
    const largerPoolProjects = createProjects(64)
    const redis = new RecordingRedis([[1, '47']])
    const pool = new GeminiChatProjectPool(redis, largerPoolProjects)

    await expect(pool.select(new Set())).resolves.toEqual({
      kind: 'selected',
      project: largerPoolProjects[47],
    })

    expect(pool.size).toBe(64)
    const request = JSON.parse(redis.calls[0]?.arguments[0] ?? '{}') as {
      members?: unknown
    }
    expect(request.members).toHaveLength(64)
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

  it('accepts the maximum project count and rejects one item above it', () => {
    expect(
      inspectGeminiChatProjectsJson(
        JSON.stringify(createProjects(MAX_GEMINI_CHAT_PROJECTS)),
        { allowEmpty: true },
      ),
    ).toMatchObject({ success: true })

    expect(
      inspectGeminiChatProjectsJson(
        JSON.stringify(createProjects(MAX_GEMINI_CHAT_PROJECTS + 1)),
        { allowEmpty: true },
      ),
    ).toEqual({
      success: false,
      issues: [
        {
          path: [],
          message: `must contain at most ${String(MAX_GEMINI_CHAT_PROJECTS)} projects`,
        },
      ],
    })
  })

  it('parses JSON through the same strict project validation', () => {
    expect(
      inspectGeminiChatProjectsJson(JSON.stringify(projects)),
    ).toMatchObject({ success: true, projects })
    expect(inspectGeminiChatProjectsJson('{invalid')).toMatchObject({
      success: false,
    })
  })

  it('provides credential-opaque snapshot without mutating pool state or leaking secrets', async () => {
    const redis = new RecordingRedis([
      [
        1,
        JSON.stringify([
          [0, 0, 0],
          [1, 5000, 1724140000000],
        ]),
      ],
    ])
    const pool = new GeminiChatProjectPool(redis, projects)

    const snapshot = await pool.snapshot()
    expect(snapshot).toEqual({
      totalProjects: 2,
      availableProjects: 1,
      cooledDownProjects: 1,
      cooldownDetails: [
        {
          projectIndex: 1,
          cooldownRemainingMs: 5000,
          cooldownUntilMs: 1724140000000,
        },
      ],
      status: 'Pressured',
    })

    const payload = JSON.stringify(redis.calls[0])
    expect(payload).not.toContain(projects[0].id)
    expect(payload).not.toContain(projects[0].apiKey)
    expect(payload).not.toContain(projects[1].id)
    expect(payload).not.toContain(projects[1].apiKey)
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
