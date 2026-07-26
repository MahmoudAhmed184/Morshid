import {
  GEMINI_QUOTA_DIMENSIONS,
  GEMINI_QUOTA_TOKEN_EPSILON,
  type GeminiQuotaCaps,
  type GeminiQuotaDimension,
  type GeminiQuotaRedisClient,
  GeminiQuotaService,
  type GeminiQuotaUnavailableReason,
} from './gemini-quota.service'
import type {
  GeminiQuotaReservationError,
  GeminiQuotaUnavailableError,
} from './gemini-quota.service'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const THIRTY_DAY_WINDOW_MS = 30 * DAY_MS

interface MarshalledDimension {
  readonly name: string
  readonly mode: string
  readonly capacity: number
  readonly windowMs: number
  readonly cost: number
}

interface MarshalledReservation {
  readonly ttlMs: number
  readonly mode: string
  readonly dimensions: readonly MarshalledDimension[]
}

/**
 * A stand-in for Redis that re-derives the reservation from the JSON payload
 * the service marshals.
 *
 * It exists to exercise THIS FILE: that the service marshals every capacity,
 * window and cost into the payload the script expects, and that it maps the
 * script's reply onto the right error. It is NOT a model of
 * `GEMINI_QUOTA_RESERVATION_LUA` and proves nothing about it. The script's own
 * behaviour — Redis TIME as the clock, atomicity, PEXPIRE, the refill and
 * window arithmetic, corrupt-field handling — is covered against a real Redis
 * in `server/test/gemini-quota-script.e2e-spec.ts`. Any claim about the Lua
 * belongs there, not here.
 *
 * The epsilon is imported from the service rather than restated so this double
 * and the script cannot silently disagree about it.
 */
class MarshallingFakeRedis implements GeminiQuotaRedisClient {
  readonly hashes = new Map<string, Map<string, string>>()
  readonly ttlMs = new Map<string, number>()
  nowMs = 0

  eval(
    _script: string,
    options: {
      readonly keys: readonly string[]
      readonly arguments: readonly string[]
    },
  ): Promise<unknown> {
    const request = JSON.parse(options.arguments[0]) as MarshalledReservation
    const key = options.keys[0]
    const hash = this.hashes.get(key) ?? new Map<string, string>()
    const writes = new Map<string, string>()
    // A record asks for no capacity, so the double must not deny one either.
    const admits = request.mode === 'reserve'

    for (const dimension of request.dimensions) {
      if (dimension.mode === 'token_bucket') {
        const tokens = readNumber(
          hash,
          `${dimension.name}:tokens`,
          dimension.capacity,
        )
        const updatedMs = readNumber(
          hash,
          `${dimension.name}:updated_ms`,
          this.nowMs,
        )
        const refilled = Math.min(
          dimension.capacity,
          tokens +
            ((this.nowMs - updatedMs) * dimension.capacity) /
              dimension.windowMs,
        )
        if (
          admits &&
          dimension.cost > 0 &&
          refilled + GEMINI_QUOTA_TOKEN_EPSILON < dimension.cost
        ) {
          return Promise.resolve([0, dimension.name])
        }
        writes.set(
          `${dimension.name}:tokens`,
          String(refilled - dimension.cost),
        )
        writes.set(`${dimension.name}:updated_ms`, String(this.nowMs))
        continue
      }

      const windowStartMs =
        Math.floor(this.nowMs / dimension.windowMs) * dimension.windowMs
      const storedStartMs = readNumber(
        hash,
        `${dimension.name}:window_start_ms`,
        windowStartMs,
      )
      const sameWindow = storedStartMs >= windowStartMs
      const used = sameWindow
        ? readNumber(hash, `${dimension.name}:used`, 0)
        : 0
      if (
        admits &&
        dimension.cost > 0 &&
        used + dimension.cost > dimension.capacity
      ) {
        return Promise.resolve([0, dimension.name])
      }
      writes.set(`${dimension.name}:used`, String(used + dimension.cost))
      writes.set(
        `${dimension.name}:window_start_ms`,
        String(sameWindow ? storedStartMs : windowStartMs),
      )
    }

    for (const [field, value] of writes) {
      hash.set(field, value)
    }
    this.hashes.set(key, hash)
    this.ttlMs.set(key, request.ttlMs)
    return Promise.resolve([1, 'ok'])
  }
}

function readNumber(
  hash: Map<string, string>,
  field: string,
  fallback: number,
): number {
  const stored = hash.get(field)
  return stored === undefined ? fallback : Number(stored)
}

const caps: GeminiQuotaCaps = {
  requestsPerMinute: 2,
  inputTokensPerMinute: 10,
  requestsPerHour: 2,
  requestsPerDay: 2,
  requestsPerMonth: 2,
}

function buildQuota(
  redis: GeminiQuotaRedisClient,
  overrides: Partial<GeminiQuotaCaps> = {},
  credential = 'test-credential',
): GeminiQuotaService {
  return new GeminiQuotaService(
    redis,
    { ...caps, ...overrides },
    { credential },
  )
}

function expectExhausted(
  failure: Promise<unknown>,
  dimension: GeminiQuotaDimension,
) {
  return expect(failure).rejects.toMatchObject({
    kind: 'quota_exhausted',
    dimension,
  } satisfies Partial<GeminiQuotaReservationError>)
}

function expectUnavailable(
  failure: Promise<unknown>,
  reason: GeminiQuotaUnavailableReason,
) {
  return expect(failure).rejects.toMatchObject({
    kind: 'quota_unavailable',
    reason,
  } satisfies Partial<GeminiQuotaUnavailableError>)
}

// Every way the guard can be unable to answer, and the reason it must report.
// None of these is a spent budget: the adapter has to be able to tell them
// apart from a genuine rate limit.
const unavailableCases: readonly [
  label: string,
  evalImplementation: () => Promise<unknown>,
  reason: GeminiQuotaUnavailableReason,
][] = [
  [
    'a Redis rejection',
    () => Promise.reject(new Error('private Redis error')),
    'redis_unavailable',
  ],
  [
    'a malformed response',
    () => Promise.resolve({ unexpected: true }),
    'invalid_reply',
  ],
  [
    'an unknown denial dimension',
    () => Promise.resolve([0, 'redis']),
    'invalid_reply',
  ],
  [
    'corrupt stored state',
    () => Promise.resolve([-1, 'corrupt_state']),
    'corrupt_state',
  ],
  [
    'a payload the script rejected',
    () => Promise.resolve([-1, 'invalid_request']),
    'invalid_configuration',
  ],
]

describe('GeminiQuotaService', () => {
  it('exposes exactly the five metered budgets', () => {
    expect(GEMINI_QUOTA_DIMENSIONS).toEqual([
      'requests_minute',
      'requests_hour',
      'requests_day',
      'requests_month',
      'input_tokens_minute',
    ])
  })

  it('enforces concurrent reservations with one Redis operation each', async () => {
    const redis = new MarshallingFakeRedis()
    const quota = buildQuota(redis, { requestsPerMinute: 1 })

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
  ] as const)(
    'marshals the rolling %s token bucket',
    async (dimension, refillMs) => {
      const redis = new MarshallingFakeRedis()
      const quota = buildQuota(redis, {}, `credential-${dimension}`)
      await quota.reserveRequest()
      await quota.reserveRequest()
      redis.nowMs += refillMs

      await expectExhausted(quota.reserveRequest(), dimension)
    },
  )

  it.each([
    ['requests_day', HOUR_MS],
    ['requests_month', DAY_MS],
  ] as const)('marshals the fixed %s window', async (dimension, elapsedMs) => {
    const redis = new MarshallingFakeRedis()
    const quota = buildQuota(redis, {}, `credential-${dimension}`)
    await quota.reserveRequest()
    await quota.reserveRequest()
    redis.nowMs += elapsedMs

    await expectExhausted(quota.reserveRequest(), dimension)
  })

  it('grants a fresh day budget only once the window boundary passes', async () => {
    const redis = new MarshallingFakeRedis()
    const quota = buildQuota(
      redis,
      { requestsPerMonth: 100 },
      'credential-day-rollover',
    )
    await quota.reserveRequest()
    await quota.reserveRequest()

    redis.nowMs += DAY_MS - 1
    await expectExhausted(quota.reserveRequest(), 'requests_day')

    redis.nowMs += 1
    await expect(quota.reserveRequest()).resolves.toBeUndefined()
  })

  it('reserves preflight input tokens and refills the rolling TPM bucket', async () => {
    const redis = new MarshallingFakeRedis()
    const quota = buildQuota(
      redis,
      {
        requestsPerMinute: 100,
        requestsPerHour: 100,
        requestsPerDay: 100,
        requestsPerMonth: 100,
      },
      'credential-tpm',
    )
    await quota.reserveGeneration(6)

    await expectExhausted(quota.reserveGeneration(5), 'input_tokens_minute')

    redis.nowMs += MINUTE_MS
    await expect(quota.reserveGeneration(10)).resolves.toBeUndefined()
  })

  it('records only additional input tokens without consuming a request', async () => {
    const redis = new MarshallingFakeRedis()
    const quota = buildQuota(redis, {}, 'credential-reconcile')
    await quota.reserveRequest()
    await quota.recordInputTokens(5)

    await expect(quota.reserveRequest()).resolves.toBeUndefined()
    await expectExhausted(quota.reserveRequest(), 'requests_minute')
  })

  it('denies input tokens alone once the TPM budget is spent', async () => {
    const redis = new MarshallingFakeRedis()
    const quota = buildQuota(
      redis,
      { requestsPerMinute: 100, inputTokensPerMinute: 4 },
      'credential-reserve-tokens',
    )
    await quota.reserveGeneration(4)

    await expectExhausted(quota.reserveInputTokens(1), 'input_tokens_minute')
  })

  // Admission control and bookkeeping share one script but never one policy,
  // and the mode is the only thing in the payload that tells them apart.
  it('marshals admission control and bookkeeping as different write modes', async () => {
    const redis = new MarshallingFakeRedis()
    const evalSpy = jest.spyOn(redis, 'eval')
    const quota = buildQuota(
      redis,
      { inputTokensPerMinute: 100 },
      'credential-modes',
    )

    await quota.reserveInputTokens(3)
    await quota.recordInputTokens(3)

    expect(
      evalSpy.mock.calls.map(
        ([, options]) =>
          (JSON.parse(options.arguments[0]) as MarshalledReservation).mode,
      ),
    ).toEqual(['reserve', 'record'])
  })

  // The tokens were billed whatever the guard thinks. Refusing to write them
  // would leave the local budget optimistic exactly at the cap.
  it('records already-billed tokens past a spent budget and goes negative', async () => {
    const redis = new MarshallingFakeRedis()
    const quota = buildQuota(
      redis,
      { requestsPerMinute: 100, inputTokensPerMinute: 4 },
      'credential-record-overdraw',
    )
    await quota.reserveGeneration(4)

    await expect(quota.recordInputTokens(3)).resolves.toBeUndefined()

    expect(
      Number(
        redis.hashes.get(quota.quotaKey)?.get('input_tokens_minute:tokens'),
      ),
    ).toBeCloseTo(-3, 6)
  })

  it('lets a recorded debt suppress admission until the bucket refills', async () => {
    const redis = new MarshallingFakeRedis()
    const quota = buildQuota(
      redis,
      { requestsPerMinute: 100, inputTokensPerMinute: 4 },
      'credential-record-debt',
    )
    await quota.reserveGeneration(4)
    await quota.recordInputTokens(3)

    await expectExhausted(quota.reserveGeneration(1), 'input_tokens_minute')

    // A full window refills 4 tokens, which clears the 3-token debt and leaves
    // exactly enough to admit again.
    redis.nowMs += MINUTE_MS
    await expect(quota.reserveGeneration(1)).resolves.toBeUndefined()
  })

  it('skips Redis entirely when there is nothing to record', async () => {
    const redis = new MarshallingFakeRedis()
    const evalSpy = jest.spyOn(redis, 'eval')
    const quota = buildQuota(redis, {}, 'credential-record-zero')

    await expect(quota.recordInputTokens(0)).resolves.toBeUndefined()

    expect(evalSpy).not.toHaveBeenCalled()
  })

  it('retains long-window state across service recreation', async () => {
    const redis = new MarshallingFakeRedis()
    const first = buildQuota(redis, {}, 'credential-restart')
    await first.reserveRequest()
    await first.reserveRequest()
    redis.nowMs += DAY_MS

    const restarted = buildQuota(redis, {}, 'credential-restart')

    await expectExhausted(restarted.reserveRequest(), 'requests_month')
  })

  it('marshals a key lifetime that outlives the longest window', async () => {
    const redis = new MarshallingFakeRedis()
    const quota = buildQuota(redis, {}, 'credential-ttl')

    await quota.reserveRequest()

    expect(redis.ttlMs.get(quota.quotaKey)).toBe(2 * THIRTY_DAY_WINDOW_MS)
  })

  it('keys the bucket on the deployment credential, never on the model', () => {
    const redis = new MarshallingFakeRedis()
    const deployment = new GeminiQuotaService(redis, caps, {
      credential: 'shared-credential',
    })
    const sameDeployment = new GeminiQuotaService(redis, caps, {
      credential: 'shared-credential',
    })
    const otherDeployment = new GeminiQuotaService(redis, caps, {
      credential: 'other-credential',
    })

    expect(sameDeployment.quotaKey).toBe(deployment.quotaKey)
    expect(otherDeployment.quotaKey).not.toBe(deployment.quotaKey)
  })

  it('uses only an opaque deployment key and numeric bucket values', async () => {
    const redis = new MarshallingFakeRedis()
    const evalSpy = jest.spyOn(redis, 'eval')
    const credential = 'private-google-api-key'
    const quota = buildQuota(redis, {}, credential)

    await quota.reserveGeneration(7)

    const options = evalSpy.mock.calls[0][1]
    expect(options.keys).toEqual([quota.quotaKey])
    expect(quota.quotaKey).toMatch(
      /^morshid:completion:gemini:quota:[a-f0-9]{24}$/u,
    )
    expect(JSON.stringify(options)).not.toContain(credential)

    const request = JSON.parse(options.arguments[0]) as MarshalledReservation
    expect(request.dimensions.map((dimension) => dimension.name)).toEqual([
      ...GEMINI_QUOTA_DIMENSIONS,
    ])
    for (const dimension of request.dimensions) {
      expect(Number.isFinite(dimension.capacity)).toBe(true)
      expect(Number.isFinite(dimension.windowMs)).toBe(true)
      expect(Number.isFinite(dimension.cost)).toBe(true)
    }
    // The script takes its clock from Redis TIME, so no timestamp is marshalled.
    expect(options.arguments[0]).not.toContain('now')
  })

  it.each(unavailableCases)(
    'reports %s as guard unavailability rather than a spent budget',
    async (_, evalImplementation, reason) => {
      const redis = {
        eval: jest.fn(evalImplementation),
      } satisfies GeminiQuotaRedisClient
      const quota = buildQuota(redis, {}, 'credential-fail-closed')

      await expectUnavailable(quota.reserveRequest(), reason)
    },
  )

  // Bookkeeping never rejects on exhaustion, but a broken guard is still a
  // broken guard: the caller has to be able to see that nothing was recorded.
  it.each(unavailableCases)(
    'still reports %s from the record path rather than swallowing it',
    async (_, evalImplementation, reason) => {
      const redis = {
        eval: jest.fn(evalImplementation),
      } satisfies GeminiQuotaRedisClient
      const quota = buildQuota(redis, {}, 'credential-record-fail-closed')

      await expectUnavailable(quota.recordInputTokens(3), reason)
    },
  )

  // The script cannot deny a record, so a denial reaching this client is a
  // reply-protocol violation — never the rate limit the caller must not see.
  it('never reports a denied record as a spent budget', async () => {
    const redis = {
      eval: jest.fn(() => Promise.resolve([0, 'input_tokens_minute'])),
    } satisfies GeminiQuotaRedisClient
    const quota = buildQuota(redis, {}, 'credential-record-denied')

    await expectUnavailable(quota.recordInputTokens(3), 'invalid_reply')
  })

  it('fails closed without touching Redis when caps are unusable', async () => {
    const redis = new MarshallingFakeRedis()
    const evalSpy = jest.spyOn(redis, 'eval')
    const quota = buildQuota(redis, { requestsPerDay: 0 }, 'credential-caps')

    await expectUnavailable(quota.reserveRequest(), 'invalid_configuration')
    expect(evalSpy).not.toHaveBeenCalled()
  })
})
