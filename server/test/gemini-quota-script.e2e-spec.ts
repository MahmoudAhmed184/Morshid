import { randomUUID } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import {
  buildGeminiQuotaReservationArguments,
  GEMINI_QUOTA_RESERVATION_LUA,
  type GeminiQuotaCaps,
  GeminiQuotaService,
} from '../src/modules/completion/providers/gemini/gemini-quota.service'
import type { AppEnvironment } from '../src/modules/config/env.schema'
import { RedisService } from '../src/modules/redis/redis.service'

/**
 * Executes the real `GEMINI_QUOTA_RESERVATION_LUA` against a live Redis.
 *
 * The unit spec next to the service only proves the service marshals its
 * arguments and reads the reply; every claim about the script itself — Redis
 * TIME as the clock, atomicity under concurrency, refill and fixed-window
 * arithmetic, the key lifetime, failing closed on corrupt state, and the
 * overdraw the record mode deliberately permits — has to be proven here,
 * because a Lua syntax error or a mis-shaped payload would
 * otherwise pass the whole unit suite and turn every completion into a spurious
 * rate limit at runtime.
 *
 * Requires `npm run infra:up`; it runs under `npm run test:e2e`, never under
 * `npm test`.
 */

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
const THIRTY_DAY_WINDOW_MS = 30 * DAY_MS
const EXPECTED_KEY_TTL_MS = 2 * THIRTY_DAY_WINDOW_MS

const caps: GeminiQuotaCaps = {
  requestsPerMinute: 5,
  inputTokensPerMinute: 100,
  requestsPerHour: 50,
  requestsPerDay: 200,
  requestsPerMonth: 1000,
}

describe('GEMINI_QUOTA_RESERVATION_LUA (e2e)', () => {
  let redisService: RedisService
  let client: ReturnType<RedisService['getClient']>
  let createdKeys: string[]

  beforeAll(async () => {
    redisService = new RedisService(
      new ConfigService<AppEnvironment, true>({
        REDIS_URL: process.env.REDIS_URL,
      }),
    )
    await redisService.onModuleInit()
    client = redisService.getClient()
  })

  afterAll(async () => {
    await redisService.onModuleDestroy()
  })

  beforeEach(() => {
    createdKeys = []
  })

  afterEach(async () => {
    for (const key of createdKeys) {
      await client.del(key)
    }
  })

  function buildQuota(
    overrides: Partial<GeminiQuotaCaps> = {},
  ): GeminiQuotaService {
    const quota = new GeminiQuotaService(
      {
        eval: (script, options) =>
          client.eval(script, {
            keys: [...options.keys],
            arguments: [...options.arguments],
          }),
      },
      { ...caps, ...overrides },
      { credential: `e2e-credential-${randomUUID()}` },
    )
    createdKeys.push(quota.quotaKey)
    return quota
  }

  async function readServerNowMs(): Promise<number> {
    const reply = await client.eval(
      "local t = redis.call('TIME') return string.format('%d', (tonumber(t[1]) * 1000) + math.floor(tonumber(t[2]) / 1000))",
      { keys: [], arguments: [] },
    )
    return Number(reply)
  }

  async function readHash(key: string): Promise<Record<string, string>> {
    return client.hGetAll(key)
  }

  it('seeds a fresh key to capacity and debits exactly one request', async () => {
    const quota = buildQuota()

    await quota.reserveRequest()

    const hash = await readHash(quota.quotaKey)
    expect(Number(hash['requests_minute:tokens'])).toBeCloseTo(
      caps.requestsPerMinute - 1,
      6,
    )
    expect(Number(hash['requests_hour:tokens'])).toBeCloseTo(
      caps.requestsPerHour - 1,
      6,
    )
    // A request costs no input tokens, so that bucket seeds full and stays full.
    expect(Number(hash['input_tokens_minute:tokens'])).toBe(
      caps.inputTokensPerMinute,
    )
    expect(hash['requests_day:used']).toBe('1')
    expect(hash['requests_month:used']).toBe('1')
  })

  it('anchors fixed windows to the Redis clock, not the caller', async () => {
    const quota = buildQuota()

    await quota.reserveRequest()

    const serverNowMs = await readServerNowMs()
    const hash = await readHash(quota.quotaKey)
    expect(Number(hash['requests_day:window_start_ms'])).toBe(
      Math.floor(serverNowMs / DAY_MS) * DAY_MS,
    )
    expect(Number(hash['requests_month:window_start_ms'])).toBe(
      Math.floor(serverNowMs / THIRTY_DAY_WINDOW_MS) * THIRTY_DAY_WINDOW_MS,
    )
    expect(Number(hash['requests_minute:updated_ms'])).toBeGreaterThan(
      serverNowMs - MINUTE_MS,
    )
  })

  it('debits nothing when a later dimension denies the reservation', async () => {
    const quota = buildQuota({ inputTokensPerMinute: 1 })
    await quota.reserveGeneration(1)
    const before = await readHash(quota.quotaKey)

    await expect(quota.reserveGeneration(1)).rejects.toMatchObject({
      kind: 'quota_exhausted',
      dimension: 'input_tokens_minute',
    })

    expect(await readHash(quota.quotaKey)).toEqual(before)
  })

  it('never refills a token bucket past capacity from a stale timestamp', async () => {
    const quota = buildQuota()
    await quota.reserveRequest()
    // The Unix epoch: decades of elapsed time at capacity/window per ms.
    await client.hSet(quota.quotaKey, {
      'requests_minute:tokens': '0',
      'requests_minute:updated_ms': '0',
    })

    await quota.reserveRequest()

    const hash = await readHash(quota.quotaKey)
    expect(Number(hash['requests_minute:tokens'])).toBeCloseTo(
      caps.requestsPerMinute - 1,
      6,
    )
  })

  it('does not oversell a bucket under concurrent reservations', async () => {
    const quota = buildQuota({ requestsPerMinute: 3 })

    const outcomes = await Promise.allSettled(
      Array.from({ length: 20 }, () => quota.reserveRequest()),
    )

    expect(
      outcomes.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(3)
    const hash = await readHash(quota.quotaKey)
    expect(hash['requests_day:used']).toBe('3')
  })

  it('applies a key lifetime that outlives the longest window', async () => {
    const quota = buildQuota()

    await quota.reserveRequest()

    const ttlMs = await client.pTTL(quota.quotaKey)
    expect(ttlMs).toBeGreaterThan(EXPECTED_KEY_TTL_MS - MINUTE_MS)
    expect(ttlMs).toBeLessThanOrEqual(EXPECTED_KEY_TTL_MS)
  })

  it('debits only the token bucket when recording already-billed tokens', async () => {
    const quota = buildQuota()
    await quota.reserveRequest()
    const before = await readHash(quota.quotaKey)

    await quota.recordInputTokens(4)

    const after = await readHash(quota.quotaKey)
    expect(after['requests_day:used']).toBe(before['requests_day:used'])
    expect(after['requests_month:used']).toBe(before['requests_month:used'])
    // The request buckets only refill; the record takes nothing from them.
    expect(Number(after['requests_minute:tokens'])).toBeGreaterThanOrEqual(
      Number(before['requests_minute:tokens']),
    )
    expect(Number(after['input_tokens_minute:tokens'])).toBeGreaterThanOrEqual(
      caps.inputTokensPerMinute - 4,
    )
    expect(Number(after['input_tokens_minute:tokens'])).toBeLessThan(
      caps.inputTokensPerMinute - 3,
    )
  })

  // Google bills what it bills. If the guard could refuse to write tokens that
  // are already spent, the deficit would vanish and the local budget would stay
  // optimistic exactly at the cap. The bucket goes negative instead, and that
  // debt is what stops the next request.
  it('records past a spent budget, goes negative, and suppresses admission until refill', async () => {
    const quota = buildQuota({ inputTokensPerMinute: 10 })
    await quota.reserveGeneration(10)

    await expect(quota.recordInputTokens(6)).resolves.toBeUndefined()

    const hash = await readHash(quota.quotaKey)
    // Real elapsed time refills at 10 tokens per minute, so a few milliseconds
    // of test latency leaves the balance a hair above -6 and nowhere near -5.
    expect(Number(hash['input_tokens_minute:tokens'])).toBeGreaterThanOrEqual(
      -6,
    )
    expect(Number(hash['input_tokens_minute:tokens'])).toBeLessThan(-5)

    await expect(quota.reserveGeneration(1)).rejects.toMatchObject({
      kind: 'quota_exhausted',
      dimension: 'input_tokens_minute',
    })

    // Backdating the bucket's own timestamp is exactly what waiting would do:
    // one full window refills 10 tokens, clearing the debt with room to spend.
    const serverNowMs = await readServerNowMs()
    await client.hSet(
      quota.quotaKey,
      'input_tokens_minute:updated_ms',
      String(serverNowMs - MINUTE_MS),
    )

    await expect(quota.reserveGeneration(1)).resolves.toBeUndefined()
  })

  it.each([
    'requests_minute:tokens',
    'requests_minute:updated_ms',
    'requests_month:used',
    'requests_month:window_start_ms',
  ])('fails closed when %s holds a non-numeric value', async (field) => {
    const quota = buildQuota()
    await quota.reserveRequest()
    await client.hSet(quota.quotaKey, field, 'restored-by-hand')

    await expect(quota.reserveRequest()).rejects.toMatchObject({
      kind: 'quota_unavailable',
      reason: 'corrupt_state',
    })

    // Failing closed also means failing without spending anything.
    const hash = await readHash(quota.quotaKey)
    expect(hash['requests_day:used']).toBe('1')
  })

  it('fails closed when a window counter has no window to belong to', async () => {
    const quota = buildQuota()
    await client.hSet(quota.quotaKey, 'requests_day:used', '3')

    await expect(quota.reserveRequest()).rejects.toMatchObject({
      kind: 'quota_unavailable',
      reason: 'corrupt_state',
    })
  })

  it('resets a fixed window only once its boundary has passed', async () => {
    const quota = buildQuota({ requestsPerDay: 1 })
    await quota.reserveRequest()

    await expect(quota.reserveRequest()).rejects.toMatchObject({
      kind: 'quota_exhausted',
      dimension: 'requests_day',
    })

    const serverNowMs = await readServerNowMs()
    const previousWindowStartMs =
      Math.floor(serverNowMs / DAY_MS) * DAY_MS - DAY_MS
    await client.hSet(
      quota.quotaKey,
      'requests_day:window_start_ms',
      String(previousWindowStartMs),
    )

    await expect(quota.reserveRequest()).resolves.toBeUndefined()
    const hash = await readHash(quota.quotaKey)
    expect(hash['requests_day:used']).toBe('1')
    expect(Number(hash['requests_day:window_start_ms'])).toBe(
      Math.floor(serverNowMs / DAY_MS) * DAY_MS,
    )
  })

  it('keeps recorded spend when the stored window is ahead of the server clock', async () => {
    const quota = buildQuota({ requestsPerDay: 1 })
    await quota.reserveRequest()
    const serverNowMs = await readServerNowMs()
    await client.hSet(quota.quotaKey, {
      'requests_day:window_start_ms': String(
        Math.floor(serverNowMs / DAY_MS) * DAY_MS + DAY_MS,
      ),
      'requests_day:used': '1',
    })

    await expect(quota.reserveRequest()).rejects.toMatchObject({
      kind: 'quota_exhausted',
      dimension: 'requests_day',
    })
  })

  it('answers the documented reply protocol when evaluated directly', async () => {
    const key = `morshid:completion:gemini:quota:e2e-${randomUUID()}`
    createdKeys.push(key)
    const reserveArgv = [
      ...buildGeminiQuotaReservationArguments(
        { ...caps, requestsPerMinute: 1 },
        { requestCost: 1, inputTokenCost: 0 },
        'reserve',
      ),
    ]
    const recordArgv = [
      ...buildGeminiQuotaReservationArguments(
        { ...caps, requestsPerMinute: 1 },
        { requestCost: 1, inputTokenCost: 0 },
        'record',
      ),
    ]

    await expect(
      client.eval(GEMINI_QUOTA_RESERVATION_LUA, {
        keys: [key],
        arguments: reserveArgv,
      }),
    ).resolves.toEqual([1, 'ok'])
    await expect(
      client.eval(GEMINI_QUOTA_RESERVATION_LUA, {
        keys: [key],
        arguments: reserveArgv,
      }),
    ).resolves.toEqual([0, 'requests_minute'])
    // The same exhausted key, the same cost: a record has no capacity check to
    // fail, so it is admitted where the reservation above was refused.
    await expect(
      client.eval(GEMINI_QUOTA_RESERVATION_LUA, {
        keys: [key],
        arguments: recordArgv,
      }),
    ).resolves.toEqual([1, 'ok'])
    await expect(
      client.eval(GEMINI_QUOTA_RESERVATION_LUA, {
        keys: [key],
        arguments: ['{ not json'],
      }),
    ).resolves.toEqual([-1, 'invalid_request'])
    // An unrecognised mode is rejected rather than defaulted to either policy.
    await expect(
      client.eval(GEMINI_QUOTA_RESERVATION_LUA, {
        keys: [key],
        arguments: [
          JSON.stringify({ ttlMs: 1_000, mode: 'audit', dimensions: [] }),
        ],
      }),
    ).resolves.toEqual([-1, 'invalid_request'])
  })
})
