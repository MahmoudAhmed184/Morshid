import { createHmac } from 'node:crypto'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

// The monthly cap is a Morshid-owned spend budget rather than a published
// Google quota (docs/research/gemini-free-tier-quotas-2026-07-23.md), so there
// is no provider boundary to align to. It is a fixed 30-day window anchored to
// the Unix epoch, not a calendar month, and is named for its length so nobody
// reads it as "resets on the 1st".
const THIRTY_DAY_WINDOW_MS = 30 * DAY_MS

// The hash has to outlive the longest window: if it expired mid-window an idle
// deployment would come back holding a fresh 30-day budget. Two windows of
// slack keeps a partially spent window alive across a long outage while still
// letting a retired deployment's key fall out of Redis on its own.
const QUOTA_KEY_TTL_MS = 2 * THIRTY_DAY_WINDOW_MS

// Token-bucket refill is floating point, so a bucket that logically holds
// exactly `cost` can land a few ULPs below it. A billionth of a token absorbs
// that without ever admitting a request that has not been paid for. It is
// interpolated into the script below so the Lua and any test double read the
// same number.
export const GEMINI_QUOTA_TOKEN_EPSILON = 1e-9

const QUOTA_KEY_PREFIX = 'morshid:completion:gemini:quota:'

// Domain-separation salt for the deployment digest. Deliberately not a secret:
// its only job is to make the stored key a digest that exists nowhere else, so
// a Redis key can never be compared against a digest computed elsewhere from
// the same credential. Bumping the version suffix retires every existing
// bucket, which is exactly what a change to the field layout below requires.
const QUOTA_KEY_SALT = 'morshid:completion:gemini:quota-key:v2'

// 24 hex characters is 96 bits of the HMAC: far out of collision range for the
// handful of deployments that ever share one Redis, and short enough to keep
// the keyspace legible. Truncation also removes any chance of recovering the
// full digest of the credential from a key that leaks into a log.
const QUOTA_KEY_DIGEST_HEX_LENGTH = 24

export interface GeminiQuotaCaps {
  readonly requestsPerMinute: number
  readonly inputTokensPerMinute: number
  readonly requestsPerHour: number
  readonly requestsPerDay: number
  readonly requestsPerMonth: number
}

/**
 * How a dimension meters spend.
 *
 * `token_bucket` refills continuously at capacity/window and is the right shape
 * for smoothing burst rate. `fixed_window` is a counter that resets on a window
 * boundary and is the right shape for a cap an operator reads off a dashboard:
 * a leaky bucket drained just after a reset and again just before the next one
 * yields roughly twice the configured cap inside one accounting day.
 */
type GeminiQuotaMode = 'token_bucket' | 'fixed_window'

type GeminiQuotaCostKind = 'request' | 'input_token'

interface GeminiQuotaDimensionPlan {
  readonly name: string
  readonly mode: GeminiQuotaMode
  readonly capKey: keyof GeminiQuotaCaps
  readonly windowMs: number
  readonly costKind: GeminiQuotaCostKind
}

/**
 * The single ordered description of every metered dimension. The dimension
 * union, the runtime dimension list and the script's argument payload are all
 * derived from this array, so a capacity can no longer be paired with the wrong
 * window by transposing two entries. Order is the denial precedence the caller
 * observes: the first exhausted dimension is the one reported.
 *
 * Day and month use fixed windows aligned to the Unix epoch in UTC. Google
 * resets requests-per-day at midnight Pacific, i.e. 07:00 UTC under PDT and
 * 08:00 UTC under PST, so our day boundary leads the provider's by 7-8 hours.
 * UTC alignment is the deliberate choice: it needs no timezone database inside
 * Lua and no application clock, at the cost of that offset between the two
 * accounting days. Operators comparing against the AI Studio dashboard should
 * expect our counter to roll over that much earlier in the day.
 */
const GEMINI_QUOTA_PLAN = [
  {
    name: 'requests_minute',
    mode: 'token_bucket',
    capKey: 'requestsPerMinute',
    windowMs: MINUTE_MS,
    costKind: 'request',
  },
  {
    name: 'requests_hour',
    mode: 'token_bucket',
    capKey: 'requestsPerHour',
    windowMs: HOUR_MS,
    costKind: 'request',
  },
  {
    name: 'requests_day',
    mode: 'fixed_window',
    capKey: 'requestsPerDay',
    windowMs: DAY_MS,
    costKind: 'request',
  },
  {
    name: 'requests_month',
    mode: 'fixed_window',
    capKey: 'requestsPerMonth',
    windowMs: THIRTY_DAY_WINDOW_MS,
    costKind: 'request',
  },
  {
    name: 'input_tokens_minute',
    mode: 'token_bucket',
    capKey: 'inputTokensPerMinute',
    windowMs: MINUTE_MS,
    costKind: 'input_token',
  },
] as const satisfies readonly GeminiQuotaDimensionPlan[]

/** A genuine metered budget. Never an infrastructure condition. */
export type GeminiQuotaDimension = (typeof GEMINI_QUOTA_PLAN)[number]['name']

export const GEMINI_QUOTA_DIMENSIONS: readonly GeminiQuotaDimension[] =
  GEMINI_QUOTA_PLAN.map((plan) => plan.name)

export const GEMINI_QUOTA_UNAVAILABLE_REASONS = [
  // Caps or costs handed to the guard are not usable numbers.
  'invalid_configuration',
  // The Redis call itself failed.
  'redis_unavailable',
  // A stored bucket field is present but not a number.
  'corrupt_state',
  // The script answered with something this client does not understand.
  'invalid_reply',
] as const

/** Why the guard could not answer. Distinct from a budget being exhausted. */
export type GeminiQuotaUnavailableReason =
  (typeof GEMINI_QUOTA_UNAVAILABLE_REASONS)[number]

export interface GeminiQuotaRedisClient {
  eval(
    script: string,
    options: {
      readonly keys: readonly string[]
      readonly arguments: readonly string[]
    },
  ): Promise<unknown>
}

/**
 * Identity of the metered deployment.
 *
 * Gemini's free-tier limits are applied per Google project, not per model
 * alias, so the bucket is keyed on the credential that identifies the project
 * and deliberately NOT on `GEMINI_MODEL`: rotating the model, or switching
 * between two aliases of the same underlying model, must not mint a fresh day
 * or month budget, and two deployments sharing one Redis with different API
 * keys must not collapse onto one bucket. A deployment that genuinely wants
 * per-model budgets can pass a per-model identity here, because the value is
 * opaque to this service.
 *
 * `credential` never reaches Redis, a log line or an error. Only a salted
 * HMAC-SHA-256 digest of it is stored, truncated to
 * `QUOTA_KEY_DIGEST_HEX_LENGTH` hex characters, so the stored key still
 * discloses nothing about the deployment.
 */
export interface GeminiQuotaDeployment {
  readonly credential: string
}

export interface GeminiQuotaReservationCost {
  readonly requestCost: number
  readonly inputTokenCost: number
}

/**
 * What a write to the guard is for.
 *
 * `reserve` is admission control: the caller is asking permission to spend, so
 * an exhausted dimension denies the whole write and debits nothing.
 *
 * `record` is bookkeeping for spend that has ALREADY happened upstream. There
 * is nothing left to admit or refuse, so it never checks capacity and always
 * writes — a token bucket is allowed to go negative, and that debt is what
 * correctly suppresses subsequent `reserve` calls until it refills. Denying a
 * record instead would write nothing at all and leave the local budget drifting
 * optimistic exactly where it matters most, at the cap.
 */
export type GeminiQuotaWriteMode = 'reserve' | 'record'

// The write is marshalled as one JSON document. There are no positional
// arguments left to transpose: the script reads each dimension's capacity,
// window and cost from the same object that carries its name.
export const GEMINI_QUOTA_RESERVATION_LUA = `
local ok, request = pcall(cjson.decode, ARGV[1])
if not ok or type(request) ~= 'table' or type(request.dimensions) ~= 'table' then
  return { -1, 'invalid_request' }
end
if type(request.ttlMs) ~= 'number' or request.ttlMs < 1 then
  return { -1, 'invalid_request' }
end
-- An unrecognised mode is rejected rather than defaulted, so a client that
-- learns a third mode this script does not implement cannot silently have its
-- write treated as one of these two.
if request.mode ~= 'reserve' and request.mode ~= 'record' then
  return { -1, 'invalid_request' }
end
local admits = request.mode == 'reserve'

-- Redis TIME is authoritative, so application clock skew cannot create
-- additional capacity and cannot move a fixed window boundary. No caller
-- supplied timestamp is read anywhere in this script.
local redis_time = redis.call('TIME')
local now_ms = (tonumber(redis_time[1]) * 1000) + math.floor(tonumber(redis_time[2]) / 1000)
local writes = {}

-- Returns (value, readable). An absent field is (nil, true); a field that is
-- present but not numeric is (nil, false) and must fail the reservation closed
-- rather than falling through to a full bucket.
local function stored_number(field)
  local raw = redis.call('HGET', KEYS[1], field)
  if raw == false then
    return nil, true
  end
  local parsed = tonumber(raw)
  if parsed == nil then
    return nil, false
  end
  return parsed, true
end

for _, dimension in ipairs(request.dimensions) do
  if type(dimension.name) ~= 'string'
    or type(dimension.capacity) ~= 'number'
    or type(dimension.windowMs) ~= 'number'
    or type(dimension.cost) ~= 'number'
    or dimension.capacity <= 0
    or dimension.windowMs <= 0
    or dimension.cost < 0 then
    return { -1, 'invalid_request' }
  end

  if dimension.mode == 'token_bucket' then
    local tokens_field = dimension.name .. ':tokens'
    local updated_field = dimension.name .. ':updated_ms'
    local tokens, tokens_readable = stored_number(tokens_field)
    if not tokens_readable then
      return { -1, 'corrupt_state' }
    end
    local updated_ms, updated_readable = stored_number(updated_field)
    if not updated_readable then
      return { -1, 'corrupt_state' }
    end
    -- An absent bucket seeds full. An absent timestamp refills nothing, which
    -- is the conservative reading of a half-written hash.
    if tokens == nil then
      tokens = dimension.capacity
    end
    if updated_ms == nil then
      updated_ms = now_ms
    end
    local elapsed_ms = math.max(0, now_ms - updated_ms)
    local refilled = math.min(
      dimension.capacity,
      tokens + (elapsed_ms * dimension.capacity / dimension.windowMs)
    )

    -- A record skips the check and lets the difference go below zero.
    if admits and dimension.cost > 0 and refilled + ${String(GEMINI_QUOTA_TOKEN_EPSILON)} < dimension.cost then
      return { 0, dimension.name }
    end

    writes[#writes + 1] = {
      tokens_field,
      tostring(refilled - dimension.cost),
      updated_field,
      string.format('%d', now_ms)
    }
  elseif dimension.mode == 'fixed_window' then
    local used_field = dimension.name .. ':used'
    local start_field = dimension.name .. ':window_start_ms'
    local used, used_readable = stored_number(used_field)
    if not used_readable then
      return { -1, 'corrupt_state' }
    end
    local stored_start, start_readable = stored_number(start_field)
    if not start_readable then
      return { -1, 'corrupt_state' }
    end
    -- A counter with no window to attribute it to cannot be trusted, and
    -- silently restarting it would hand back the whole budget.
    if stored_start == nil and used ~= nil then
      return { -1, 'corrupt_state' }
    end

    local window_start_ms = math.floor(now_ms / dimension.windowMs) * dimension.windowMs
    if stored_start ~= nil and stored_start >= window_start_ms then
      -- Same window, or a window the server clock has since moved behind. Keep
      -- the recorded spend instead of handing out a fresh budget.
      window_start_ms = stored_start
    else
      used = 0
    end
    if used == nil then
      used = 0
    end

    -- A record skips the check and lets the counter exceed the cap.
    if admits and dimension.cost > 0 and used + dimension.cost > dimension.capacity then
      return { 0, dimension.name }
    end

    writes[#writes + 1] = {
      used_field,
      string.format('%d', used + dimension.cost),
      start_field,
      string.format('%d', window_start_ms)
    }
  else
    return { -1, 'invalid_request' }
  end
end

-- Nothing is written until every dimension has been admitted, so a denial
-- debits no budget at all. A record admits unconditionally and so always
-- reaches this loop.
for _, write in ipairs(writes) do
  redis.call('HSET', KEYS[1], write[1], write[2], write[3], write[4])
end
redis.call('PEXPIRE', KEYS[1], math.floor(request.ttlMs))
return { 1, 'ok' }
`

/** Common supertype so one `catch` can still see every guard outcome. */
export abstract class GeminiQuotaError extends Error {
  abstract readonly kind: 'quota_exhausted' | 'quota_unavailable'
}

/**
 * A genuine budget is exhausted. This is the only quota error that means "the
 * caller is being rate limited", and callers should surface it as such.
 */
export class GeminiQuotaReservationError extends GeminiQuotaError {
  readonly kind = 'quota_exhausted'

  constructor(readonly dimension: GeminiQuotaDimension) {
    super('Gemini quota reservation denied')
    Object.defineProperty(this, 'name', {
      configurable: true,
      value: 'GeminiQuotaReservationError',
    })
  }
}

/**
 * The guard could not decide, so the request is refused to stay fail-closed.
 * This is an infrastructure or configuration failure rather than a spent
 * budget, and callers should surface it as a provider failure, not a rate
 * limit.
 */
export class GeminiQuotaUnavailableError extends GeminiQuotaError {
  readonly kind = 'quota_unavailable'

  constructor(readonly reason: GeminiQuotaUnavailableReason) {
    super('Gemini quota guard unavailable')
    Object.defineProperty(this, 'name', {
      configurable: true,
      value: 'GeminiQuotaUnavailableError',
    })
  }
}

/**
 * Marshals one write into the script's single JSON argument. Exported so the
 * integration test can drive `GEMINI_QUOTA_RESERVATION_LUA` against a real Redis
 * through exactly the payload production sends.
 */
export function buildGeminiQuotaReservationArguments(
  caps: GeminiQuotaCaps,
  cost: GeminiQuotaReservationCost,
  writeMode: GeminiQuotaWriteMode,
): readonly string[] {
  const dimensions = GEMINI_QUOTA_PLAN.map((plan) => ({
    name: plan.name,
    mode: plan.mode,
    capacity: caps[plan.capKey],
    windowMs: plan.windowMs,
    cost: plan.costKind === 'request' ? cost.requestCost : cost.inputTokenCost,
  }))

  return [
    JSON.stringify({ ttlMs: QUOTA_KEY_TTL_MS, mode: writeMode, dimensions }),
  ]
}

export class GeminiQuotaService {
  private readonly key: string

  constructor(
    private readonly redis: GeminiQuotaRedisClient,
    private readonly caps: GeminiQuotaCaps,
    deployment: GeminiQuotaDeployment | string,
  ) {
    this.key = deriveQuotaKey(deployment)
  }

  /**
   * The opaque Redis key this guard meters into. Safe to log or assert on: it
   * is a truncated salted digest and discloses nothing about the deployment.
   */
  get quotaKey(): string {
    return this.key
  }

  /** Admission control for one generation call's request unit. */
  reserveRequest(): Promise<void> {
    return this.write('reserve', 1, 0)
  }

  /** Admission control for one generation call and its input tokens at once. */
  reserveGeneration(inputTokens: number): Promise<void> {
    return this.write('reserve', 1, inputTokens)
  }

  /**
   * Admission control for input tokens alone, for a caller whose request unit
   * is already reserved. Rejects with `GeminiQuotaReservationError` when the
   * token budget is spent, and debits nothing when it does.
   */
  reserveInputTokens(inputTokens: number): Promise<void> {
    if (inputTokens === 0) {
      return Promise.resolve()
    }
    return this.write('reserve', 0, inputTokens)
  }

  /**
   * Bookkeeping for input tokens the provider has ALREADY billed.
   *
   * This is not admission control and never reports an exhausted budget: the
   * tokens were spent whatever the guard thinks, so the write always lands and
   * the bucket is allowed to go negative. The resulting debt is what suppresses
   * subsequent reservations until it refills, which is precisely what refusing
   * to record would have thrown away.
   *
   * Only `GeminiQuotaUnavailableError` can come out of it, and only for a
   * genuine infrastructure or configuration fault. Callers past the point of no
   * return may log that and carry on; they must never see a rate limit here.
   */
  recordInputTokens(inputTokens: number): Promise<void> {
    if (inputTokens === 0) {
      return Promise.resolve()
    }
    return this.write('record', 0, inputTokens)
  }

  private async write(
    writeMode: GeminiQuotaWriteMode,
    requestCost: number,
    inputTokenCost: number,
  ): Promise<void> {
    if (
      !isSafeCost(requestCost) ||
      !isSafeCost(inputTokenCost) ||
      !areValidCaps(this.caps)
    ) {
      throw new GeminiQuotaUnavailableError('invalid_configuration')
    }

    let rawResult: unknown
    try {
      rawResult = await this.redis.eval(GEMINI_QUOTA_RESERVATION_LUA, {
        keys: [this.key],
        arguments: buildGeminiQuotaReservationArguments(
          this.caps,
          { requestCost, inputTokenCost },
          writeMode,
        ),
      })
    } catch {
      throw new GeminiQuotaUnavailableError('redis_unavailable')
    }

    const outcome = parseReservationResult(rawResult)
    if (outcome.kind === 'exhausted') {
      // A record asks for no capacity, so a denial cannot be an answer to one.
      // Reporting it as a spent budget would hand a caller that is past the
      // point of no return the one error it must never see, so it is surfaced
      // as the reply-protocol violation it actually is.
      throw writeMode === 'record'
        ? new GeminiQuotaUnavailableError('invalid_reply')
        : new GeminiQuotaReservationError(outcome.dimension)
    }
    if (outcome.kind === 'unavailable') {
      throw new GeminiQuotaUnavailableError(outcome.reason)
    }
  }
}

function deriveQuotaKey(deployment: GeminiQuotaDeployment | string): string {
  // A bare string is the legacy model-only identity, kept so the composition
  // root keeps compiling while it migrates. It carries no deployment identity
  // and should be replaced by `{ credential }`; the prefixes keep the two
  // namespaces from colliding.
  const identity =
    typeof deployment === 'string'
      ? `model:${deployment}`
      : `credential:${deployment.credential}`

  return `${QUOTA_KEY_PREFIX}${createHmac('sha256', QUOTA_KEY_SALT)
    .update(identity)
    .digest('hex')
    .slice(0, QUOTA_KEY_DIGEST_HEX_LENGTH)}`
}

function isSafeCost(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

function areValidCaps(caps: GeminiQuotaCaps): boolean {
  return Object.values(caps).every(
    (cap) => Number.isSafeInteger(cap) && cap > 0,
  )
}

type ReservationOutcome =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'exhausted'; readonly dimension: GeminiQuotaDimension }
  | {
      readonly kind: 'unavailable'
      readonly reason: GeminiQuotaUnavailableReason
    }

function parseReservationResult(value: unknown): ReservationOutcome {
  if (!Array.isArray(value) || value.length !== 2) {
    return { kind: 'unavailable', reason: 'invalid_reply' }
  }

  const status: unknown = value[0]
  const detail: unknown = value[1]
  if (isStatus(status, 1) && detail === 'ok') {
    return { kind: 'allowed' }
  }
  if (isStatus(status, 0) && isGeminiQuotaDimension(detail)) {
    return { kind: 'exhausted', dimension: detail }
  }
  if (isStatus(status, -1)) {
    // The script only ever reports these two, and both mean the guard could not
    // reach a verdict it is willing to stand behind.
    if (detail === 'corrupt_state') {
      return { kind: 'unavailable', reason: 'corrupt_state' }
    }
    if (detail === 'invalid_request') {
      return { kind: 'unavailable', reason: 'invalid_configuration' }
    }
  }

  return { kind: 'unavailable', reason: 'invalid_reply' }
}

// Redis replies integers as numbers, but a client may surface them as strings;
// accept both rather than rejecting an otherwise valid answer.
function isStatus(value: unknown, expected: number): boolean {
  return value === expected || value === String(expected)
}

function isGeminiQuotaDimension(value: unknown): value is GeminiQuotaDimension {
  return (
    typeof value === 'string' &&
    (GEMINI_QUOTA_DIMENSIONS as readonly string[]).includes(value)
  )
}
