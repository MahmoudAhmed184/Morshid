// One retry. An upstream call sits behind a hard deadline, so the budget exists
// to absorb one transient blip, not to ride out an
// outage: a second failure is reported rather than queued behind more waiting.
export const MAX_UPSTREAM_ATTEMPTS = 2

// Used whenever the provider gave no usable instruction of its own. Long enough
// that an immediate re-issue cannot hammer an endpoint that just refused, short
// enough to stay well inside a completion deadline.
export const DEFAULT_RETRY_DELAY_MS = 250

// A provider is free to ask for an arbitrarily long wait; honouring it would
// park the caller past its own deadline. Every parsed delay is clamped here so
// provider-controlled metadata can never dictate how long we block.
export const MAX_PROVIDER_RETRY_DELAY_MS = 30_000

/** Injected wall clock, so retry timing is observable under a fake clock. */
export type RetryClock = () => number

/** Injected sleep, so retry timing does not force real waits in tests. */
export type RetryDelay = (delayMs: number, signal: AbortSignal) => Promise<void>

export interface UpstreamFailure {
  /** The HTTP status, when the failure carried one. Absent for transport. */
  readonly status?: number
  readonly retryable: boolean
  readonly retryDelayMs: number
}

/**
 * Classifies an arbitrary thrown value from an HTTP provider call.
 *
 * The value is read reflectively and never trusted: a provider SDK is free to
 * throw a string, a frozen object, or an object with throwing accessors, and
 * none of that may change the bounded retry policy.
 *
 * `now` is supplied by the caller's injected clock rather than read from
 * `Date.now` here, so an HTTP-date `Retry-After` is measured against the same
 * clock the caller uses for its deadline arithmetic.
 */
export function readUpstreamFailure(
  value: unknown,
  now: number,
): UpstreamFailure {
  try {
    if (typeof value !== 'object' || value === null) {
      // Nothing to classify. A provider call that failed without producing an
      // HTTP status did not reach a served response, which is the same
      // connection-level condition handled below, so it is retryable.
      return { retryable: true, retryDelayMs: DEFAULT_RETRY_DELAY_MS }
    }

    const statusCode: unknown = Reflect.get(value, 'statusCode')
    const status: unknown = Reflect.get(value, 'status')
    const headers: unknown = Reflect.get(value, 'headers')
    const normalizedStatus = isHttpStatus(statusCode)
      ? statusCode
      : isHttpStatus(status)
        ? status
        : undefined

    // A failure with no HTTP status never reached a served response: DNS, TLS,
    // a reset socket, or a hang-up mid-flight. Those are exactly the blips the
    // retry budget exists for, and treating them as permanent used to burn a
    // debited attempt and leave the budget unspent. A request the caller
    // cancelled is not classified here — the caller checks its own signal
    // before asking, so an abort can never be turned into a retry.
    const retryable =
      normalizedStatus === undefined ||
      normalizedStatus === 408 ||
      normalizedStatus === 429 ||
      normalizedStatus >= 500

    return {
      ...(normalizedStatus === undefined ? {} : { status: normalizedStatus }),
      retryable,
      retryDelayMs: readRetryDelayMs(headers, now),
    }
  } catch {
    return { retryable: true, retryDelayMs: DEFAULT_RETRY_DELAY_MS }
  }
}

/**
 * Sleeps for a bounded delay, resolving early only through cancellation.
 *
 * Rejecting with the caller's own cancellation error keeps an aborted wait
 * indistinguishable from any other cancelled step in that caller's error model,
 * and the timer and listener are released on every exit so a long delay cannot
 * outlive the request.
 *
 * `createCancellationError` is required rather than defaulted: this module is
 * shared by callers with disjoint error vocabularies, and a default would let
 * one of them silently emit the other's error type from inside a `catch` that
 * cannot recognize it.
 */
export function waitForRetry(
  delayMs: number,
  signal: AbortSignal,
  createCancellationError: () => Error,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createCancellationError())
      return
    }

    let settled = false
    const finish = (settle: () => void) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      signal.removeEventListener('abort', onAbort)
      settle()
    }
    const onAbort = () => {
      finish(() => {
        reject(createCancellationError())
      })
    }
    const timeout = setTimeout(() => {
      finish(resolve)
    }, delayMs)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function isHttpStatus(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 100 &&
    value <= 599
  )
}

function readRetryDelayMs(headers: unknown, now: number): number {
  try {
    if (!(headers instanceof Headers)) {
      return DEFAULT_RETRY_DELAY_MS
    }

    const milliseconds = parseNonNegativeInteger(headers.get('retry-after-ms'))
    if (milliseconds !== null) {
      return Math.min(milliseconds, MAX_PROVIDER_RETRY_DELAY_MS)
    }

    const retryAfter = headers.get('retry-after')
    if (retryAfter !== null && retryAfter.trim() !== '') {
      // `Retry-After` is either delay-seconds or an HTTP-date. A value that
      // looks numeric at all is the first form and is never handed to
      // `Date.parse`, which would otherwise read `-5` as a year and invent a
      // delay out of a malformed header.
      if (!Number.isNaN(Number(retryAfter))) {
        const seconds = parseNonNegativeInteger(retryAfter)
        return seconds === null
          ? DEFAULT_RETRY_DELAY_MS
          : Math.min(seconds * 1000, MAX_PROVIDER_RETRY_DELAY_MS)
      }

      const deadline = Date.parse(retryAfter)
      // An HTTP-date already in the past says nothing about when the provider
      // will accept traffic again; it is stale metadata, not an instruction to
      // re-issue immediately. Only a future instant is honoured.
      if (Number.isFinite(deadline) && deadline > now) {
        return Math.min(deadline - now, MAX_PROVIDER_RETRY_DELAY_MS)
      }
    }
  } catch {
    // Malformed provider metadata cannot alter the bounded retry policy.
  }
  return DEFAULT_RETRY_DELAY_MS
}

// `Number('')` and `Number('   ')` are both `0`, so a blank header would
// otherwise parse as a legitimate "retry immediately" instruction and re-issue
// straight back into the endpoint that just refused. Blank is absent.
function parseNonNegativeInteger(value: string | null): number | null {
  if (value === null || value.trim() === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}
