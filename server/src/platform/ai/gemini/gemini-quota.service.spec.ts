import {
  GeminiQuotaService,
  type GeminiQuotaCaps,
  type GeminiQuotaNamespace,
  type GeminiQuotaRedisClient,
} from './gemini-quota.service'

const caps: GeminiQuotaCaps = {
  requestsPerMinute: 5,
  inputTokensPerMinute: 500,
  requestsPerHour: 10,
  requestsPerDay: 20,
  requestsPerMonth: 40,
}

const EMBEDDING_NAMESPACE: GeminiQuotaNamespace = Object.freeze({
  keyPrefix: 'morshid:embedding:gemini:quota:',
  keySalt: 'morshid:embedding:gemini:quota-key:v1',
})

class RecordingFakeRedis implements GeminiQuotaRedisClient {
  readonly hashes = new Map<string, Map<string, string>>()
  readonly keys: string[] = []

  eval(
    _script: string,
    options: {
      readonly keys: readonly string[]
      readonly arguments: readonly string[]
    },
  ): Promise<unknown> {
    const key = options.keys[0]
    this.keys.push(key)
    const request = JSON.parse(options.arguments[0]) as {
      readonly dimensions: readonly {
        readonly name: string
        readonly mode: string
        readonly capacity: number
        readonly cost: number
      }[]
    }
    const hash = this.hashes.get(key) ?? new Map<string, string>()

    for (const dimension of request.dimensions) {
      if (dimension.mode === 'token_bucket') {
        const field = `${dimension.name}:tokens`
        const tokens = Number(hash.get(field) ?? String(dimension.capacity))
        if (tokens < dimension.cost) {
          return Promise.resolve([0, dimension.name])
        }
        hash.set(field, String(tokens - dimension.cost))
        continue
      }

      const field = `${dimension.name}:used`
      const used = Number(hash.get(field) ?? '0')
      if (used + dimension.cost > dimension.capacity) {
        return Promise.resolve([0, dimension.name])
      }
      hash.set(field, String(used + dimension.cost))
    }

    this.hashes.set(key, hash)
    return Promise.resolve([1, 'ok'])
  }
}

describe('Gemini embedding quota namespacing', () => {
  it('shares one project budget across replicas', () => {
    const redis = new RecordingFakeRedis()
    const first = new GeminiQuotaService(
      redis,
      caps,
      { project: 'embedding-project-01' },
      EMBEDDING_NAMESPACE,
    )
    const second = new GeminiQuotaService(
      redis,
      caps,
      { project: 'embedding-project-01' },
      EMBEDDING_NAMESPACE,
    )

    expect(first.quotaKey).toBe(second.quotaKey)
  })

  it('separates projects and identity kinds', () => {
    const redis = new RecordingFakeRedis()
    const first = new GeminiQuotaService(
      redis,
      caps,
      { project: 'embedding-project-01' },
      EMBEDDING_NAMESPACE,
    )
    const second = new GeminiQuotaService(
      redis,
      caps,
      { project: 'embedding-project-02' },
      EMBEDDING_NAMESPACE,
    )
    const credential = new GeminiQuotaService(
      redis,
      caps,
      { credential: 'embedding-project-01' },
      EMBEDDING_NAMESPACE,
    )

    expect(first.quotaKey).not.toBe(second.quotaKey)
    expect(first.quotaKey).not.toBe(credential.quotaKey)
    expect(first.quotaKey).not.toContain('embedding-project-01')
  })

  it('records a reservation in the shared Redis key', async () => {
    const redis = new RecordingFakeRedis()
    const quota = new GeminiQuotaService(
      redis,
      caps,
      { project: 'embedding-project-01' },
      EMBEDDING_NAMESPACE,
    )

    await quota.reserveGeneration(100)

    expect(redis.keys).toEqual([quota.quotaKey])
    const hash = redis.hashes.get(quota.quotaKey)
    expect(hash?.get('requests_day:used')).toBe('1')
    expect(hash?.get('input_tokens_minute:tokens')).toBe('400')
  })

  it('provides read-only snapshot without mutating state', async () => {
    const redis: GeminiQuotaRedisClient = {
      eval: jest.fn().mockResolvedValue([
        1,
        JSON.stringify([
          {
            name: 'requests_minute',
            mode: 'token_bucket',
            capacity: 5,
            value: 5,
            windowMs: 60000,
          },
          {
            name: 'requests_hour',
            mode: 'token_bucket',
            capacity: 10,
            value: 10,
            windowMs: 3600000,
          },
          {
            name: 'requests_day',
            mode: 'fixed_window',
            capacity: 20,
            value: 2,
            windowMs: 86400000,
          },
          {
            name: 'requests_month',
            mode: 'fixed_window',
            capacity: 40,
            value: 5,
            windowMs: 2592000000,
          },
          {
            name: 'input_tokens_minute',
            mode: 'token_bucket',
            capacity: 500,
            value: 500,
            windowMs: 60000,
          },
        ]),
      ]),
    }

    const quota = new GeminiQuotaService(
      redis,
      caps,
      { project: 'embedding-project-01' },
      EMBEDDING_NAMESPACE,
    )

    const snapshot = await quota.snapshot()
    expect(snapshot.status).toBe('Ready')
    expect(snapshot.dimensions).toHaveLength(5)
    expect(snapshot.dimensions[0]).toMatchObject({
      name: 'requests_minute',
      capacity: 5,
      availableOrUsed: 5,
      status: 'Ready',
    })
  })
})
