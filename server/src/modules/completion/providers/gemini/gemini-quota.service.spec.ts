import {
  type GeminiQuotaCaps,
  type GeminiQuotaDimension,
  type GeminiQuotaRedisClient,
  GeminiQuotaService,
} from './gemini-quota.service'
import type { GeminiQuotaReservationError } from './gemini-quota.service'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
interface BucketState {
  tokens: number
  updatedMs: number
}

class AtomicFakeRedis implements GeminiQuotaRedisClient {
  readonly state = new Map<string, Map<string, BucketState>>()
  nowMs = 0

  eval(
    _script: string,
    options: {
      readonly keys: readonly string[]
      readonly arguments: readonly string[]
    },
  ): Promise<unknown> {
    const values = options.arguments.map(Number)
    const requestCost = values[10]
    const inputTokenCost = values[11]
    const definitions = [
      ['requests_minute', values[0], values[1], requestCost],
      ['requests_hour', values[2], values[3], requestCost],
      ['requests_day', values[4], values[5], requestCost],
      ['requests_month', values[6], values[7], requestCost],
      ['input_tokens_minute', values[8], values[9], inputTokenCost],
    ] as const
    const key = options.keys[0]
    const stored = this.state.get(key) ?? new Map<string, BucketState>()
    const next = new Map<string, BucketState>()

    for (const [dimension, capacity, windowMs, cost] of definitions) {
      const prior = stored.get(dimension) ?? {
        tokens: capacity,
        updatedMs: this.nowMs,
      }
      const refilled = Math.min(
        capacity,
        prior.tokens + ((this.nowMs - prior.updatedMs) * capacity) / windowMs,
      )
      if (refilled + Number.EPSILON < cost) {
        return Promise.resolve([0, dimension])
      }
      next.set(dimension, {
        tokens: refilled - cost,
        updatedMs: this.nowMs,
      })
    }

    this.state.set(key, next)
    return Promise.resolve([1, 'ok'])
  }
}

const caps: GeminiQuotaCaps = {
  requestsPerMinute: 2,
  inputTokensPerMinute: 10,
  requestsPerHour: 2,
  requestsPerDay: 2,
  requestsPerMonth: 2,
}

function expectDimension(
  failure: Promise<unknown>,
  dimension: GeminiQuotaDimension,
) {
  return expect(failure).rejects.toMatchObject({
    dimension,
  } satisfies Partial<GeminiQuotaReservationError>)
}

describe('GeminiQuotaService', () => {
  it('enforces concurrent reservations atomically with one Redis operation each', async () => {
    const redis = new AtomicFakeRedis()
    const quota = new GeminiQuotaService(
      redis,
      { ...caps, requestsPerMinute: 1 },
      'gemini-test-model',
    )

    const outcomes = await Promise.allSettled([
      quota.reserveRequest(),
      quota.reserveRequest(),
    ])

    expect(
      outcomes.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1)
    expect(outcomes.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    )
  })

  it.each([
    ['requests_minute', 0],
    ['requests_hour', MINUTE_MS],
    ['requests_day', HOUR_MS],
    ['requests_month', DAY_MS],
  ] as const)('enforces the rolling %s bucket', async (dimension, refillMs) => {
    const redis = new AtomicFakeRedis()
    const quota = new GeminiQuotaService(redis, caps, `gemini-${dimension}`)
    await quota.reserveRequest()
    await quota.reserveRequest()
    redis.nowMs += refillMs

    await expectDimension(quota.reserveRequest(), dimension)
  })

  it('reserves preflight input tokens and refills the rolling TPM bucket', async () => {
    const redis = new AtomicFakeRedis()
    const quota = new GeminiQuotaService(
      redis,
      {
        requestsPerMinute: 100,
        inputTokensPerMinute: 10,
        requestsPerHour: 100,
        requestsPerDay: 100,
        requestsPerMonth: 100,
      },
      'gemini-tpm',
    )
    await quota.reserveGeneration(6)

    await expectDimension(quota.reserveGeneration(5), 'input_tokens_minute')

    redis.nowMs += MINUTE_MS
    await expect(quota.reserveGeneration(10)).resolves.toBeUndefined()
  })

  it('reconciles only additional input tokens without consuming a request', async () => {
    const redis = new AtomicFakeRedis()
    const quota = new GeminiQuotaService(redis, caps, 'gemini-reconcile')
    await quota.reserveRequest()
    await quota.reconcileInputTokens(5)

    await expect(quota.reserveRequest()).resolves.toBeUndefined()
    await expectDimension(quota.reserveRequest(), 'requests_minute')
  })

  it('retains long-window state across service recreation', async () => {
    const redis = new AtomicFakeRedis()
    const first = new GeminiQuotaService(redis, caps, 'gemini-restart')
    await first.reserveRequest()
    await first.reserveRequest()
    redis.nowMs += DAY_MS

    const restarted = new GeminiQuotaService(redis, caps, 'gemini-restart')

    await expectDimension(restarted.reserveRequest(), 'requests_month')
  })

  it('uses only an opaque deployment key and numeric values', async () => {
    const redis = new AtomicFakeRedis()
    const evalSpy = jest.spyOn(redis, 'eval')
    const privateModel = 'gemini-private-model-name'
    const quota = new GeminiQuotaService(redis, caps, privateModel)

    await quota.reserveGeneration(7)

    const options = evalSpy.mock.calls[0][1]
    expect(options.keys).toHaveLength(1)
    expect(options.keys[0]).toMatch(
      /^morshid:completion:gemini:quota:[a-f0-9]{24}$/u,
    )
    expect(JSON.stringify(options)).not.toContain(privateModel)
    expect(options.arguments.every((value) => /^\d+$/u.test(value))).toBe(true)
  })

  it.each([
    ['Redis rejection', () => Promise.reject(new Error('private Redis error'))],
    ['malformed response', () => Promise.resolve({ unexpected: true })],
  ])('fails closed on %s', async (_, evalImplementation) => {
    const redis = {
      eval: jest.fn(evalImplementation),
    } satisfies GeminiQuotaRedisClient
    const quota = new GeminiQuotaService(redis, caps, 'gemini-fail-closed')

    await expectDimension(quota.reserveRequest(), 'redis')
  })
})
