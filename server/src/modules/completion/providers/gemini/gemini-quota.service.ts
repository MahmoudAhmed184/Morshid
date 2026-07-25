import { createHash } from 'node:crypto'

export type GeminiQuotaDimension =
  | 'requests_minute'
  | 'input_tokens_minute'
  | 'requests_hour'
  | 'requests_day'
  | 'requests_month'
  | 'redis'

export interface GeminiQuotaCaps {
  readonly requestsPerMinute: number
  readonly inputTokensPerMinute: number
  readonly requestsPerHour: number
  readonly requestsPerDay: number
  readonly requestsPerMonth: number
}

export interface GeminiQuotaRedisClient {
  eval(
    script: string,
    options: {
      readonly keys: readonly string[]
      readonly arguments: readonly string[]
    },
  ): Promise<unknown>
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const MONTH_MS = 30 * DAY_MS
const QUOTA_KEY_PREFIX = 'morshid:completion:gemini:quota:'

// All dimensions are checked and debited in one Redis operation. Redis TIME is
// authoritative, so application clock skew cannot create additional capacity.
// State contains only numeric bucket data under an opaque model deployment key.
export const GEMINI_QUOTA_RESERVATION_LUA = `
local redis_time = redis.call('TIME')
local now_ms = (tonumber(redis_time[1]) * 1000) + math.floor(tonumber(redis_time[2]) / 1000)
local request_cost = tonumber(ARGV[11])
local input_token_cost = tonumber(ARGV[12])
local buckets = {
  { name = 'requests_minute', capacity = tonumber(ARGV[1]), window = tonumber(ARGV[2]), cost = request_cost },
  { name = 'requests_hour', capacity = tonumber(ARGV[3]), window = tonumber(ARGV[4]), cost = request_cost },
  { name = 'requests_day', capacity = tonumber(ARGV[5]), window = tonumber(ARGV[6]), cost = request_cost },
  { name = 'requests_month', capacity = tonumber(ARGV[7]), window = tonumber(ARGV[8]), cost = request_cost },
  { name = 'input_tokens_minute', capacity = tonumber(ARGV[9]), window = tonumber(ARGV[10]), cost = input_token_cost }
}
local next_state = {}

for index, bucket in ipairs(buckets) do
  local tokens_field = bucket.name .. ':tokens'
  local updated_field = bucket.name .. ':updated_ms'
  local stored_tokens = redis.call('HGET', KEYS[1], tokens_field)
  local stored_updated = redis.call('HGET', KEYS[1], updated_field)
  local tokens = stored_tokens and tonumber(stored_tokens) or bucket.capacity
  local updated_ms = stored_updated and tonumber(stored_updated) or now_ms
  local elapsed_ms = math.max(0, now_ms - updated_ms)
  local refilled = math.min(bucket.capacity, tokens + (elapsed_ms * bucket.capacity / bucket.window))

  if bucket.cost > 0 and refilled + 0.000000001 < bucket.cost then
    return { 0, bucket.name }
  end

  next_state[index] = {
    tokens_field,
    tostring(refilled - bucket.cost),
    updated_field,
    tostring(now_ms)
  }
end

for _, state in ipairs(next_state) do
  redis.call('HSET', KEYS[1], state[1], state[2], state[3], state[4])
end
redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[13]))
return { 1, 'ok' }
`

export class GeminiQuotaReservationError extends Error {
  constructor(readonly dimension: GeminiQuotaDimension) {
    super('Gemini quota reservation denied')
    Object.defineProperty(this, 'name', {
      configurable: true,
      value: 'GeminiQuotaReservationError',
    })
  }
}

export class GeminiQuotaService {
  private readonly redisKey: string

  constructor(
    private readonly redis: GeminiQuotaRedisClient,
    private readonly caps: GeminiQuotaCaps,
    model: string,
  ) {
    this.redisKey = `${QUOTA_KEY_PREFIX}${createHash('sha256')
      .update(`morshid-gemini-deployment:${model}`)
      .digest('hex')
      .slice(0, 24)}`
  }

  reserveRequest(): Promise<void> {
    return this.reserve(1, 0)
  }

  reserveGeneration(inputTokens: number): Promise<void> {
    return this.reserve(1, inputTokens)
  }

  reconcileInputTokens(inputTokens: number): Promise<void> {
    if (inputTokens === 0) {
      return Promise.resolve()
    }
    return this.reserve(0, inputTokens)
  }

  private async reserve(
    requestCost: number,
    inputTokenCost: number,
  ): Promise<void> {
    if (
      !isSafeCost(requestCost) ||
      !isSafeCost(inputTokenCost) ||
      !areValidCaps(this.caps)
    ) {
      throw new GeminiQuotaReservationError('redis')
    }

    let rawResult: unknown
    try {
      rawResult = await this.redis.eval(GEMINI_QUOTA_RESERVATION_LUA, {
        keys: [this.redisKey],
        arguments: [
          String(this.caps.requestsPerMinute),
          String(MINUTE_MS),
          String(this.caps.requestsPerHour),
          String(HOUR_MS),
          String(this.caps.requestsPerDay),
          String(DAY_MS),
          String(this.caps.requestsPerMonth),
          String(MONTH_MS),
          String(this.caps.inputTokensPerMinute),
          String(MINUTE_MS),
          String(requestCost),
          String(inputTokenCost),
          String(MONTH_MS * 2),
        ],
      })
    } catch {
      throw new GeminiQuotaReservationError('redis')
    }

    const result = parseReservationResult(rawResult)
    if (!result.allowed) {
      throw new GeminiQuotaReservationError(result.dimension)
    }
  }
}

function isSafeCost(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

function areValidCaps(caps: GeminiQuotaCaps): boolean {
  return Object.values(caps).every(
    (cap) => Number.isSafeInteger(cap) && cap > 0,
  )
}

function parseReservationResult(
  value: unknown,
):
  | { readonly allowed: true }
  | { readonly allowed: false; readonly dimension: GeminiQuotaDimension } {
  if (!Array.isArray(value) || value.length !== 2) {
    return { allowed: false, dimension: 'redis' }
  }

  const allowed: unknown = value[0]
  const dimension: unknown = value[1]
  if ((allowed === 1 || allowed === '1') && dimension === 'ok') {
    return { allowed: true }
  }
  if ((allowed === 0 || allowed === '0') && isGeminiQuotaDimension(dimension)) {
    return { allowed: false, dimension }
  }

  return { allowed: false, dimension: 'redis' }
}

function isGeminiQuotaDimension(
  value: unknown,
): value is Exclude<GeminiQuotaDimension, 'redis'> {
  return [
    'requests_minute',
    'input_tokens_minute',
    'requests_hour',
    'requests_day',
    'requests_month',
  ].includes(value as string)
}
