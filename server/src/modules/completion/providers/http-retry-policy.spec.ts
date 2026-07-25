import { CompletionProviderError } from '../completion-provider'
import {
  DEFAULT_RETRY_DELAY_MS,
  MAX_PROVIDER_RETRY_DELAY_MS,
  MAX_UPSTREAM_ATTEMPTS,
  readUpstreamFailure,
  waitForRetry,
} from './http-retry-policy'

const now = 1_000_000

describe('readUpstreamFailure', () => {
  it('keeps the retry budget at one retry', () => {
    expect(MAX_UPSTREAM_ATTEMPTS).toBe(2)
  })

  it.each([408, 429, 500, 502, 503, 599])(
    'classifies HTTP %i as retryable',
    (statusCode) => {
      expect(readUpstreamFailure({ statusCode }, now)).toEqual({
        status: statusCode,
        retryable: true,
        retryDelayMs: DEFAULT_RETRY_DELAY_MS,
      })
    },
  )

  it.each([400, 401, 403, 404, 422])(
    'classifies HTTP %i as permanent',
    (statusCode) => {
      expect(readUpstreamFailure({ statusCode }, now)).toMatchObject({
        status: statusCode,
        retryable: false,
      })
    },
  )

  it('reads a status carried as `status` when `statusCode` is absent', () => {
    expect(readUpstreamFailure({ status: 429 }, now)).toMatchObject({
      status: 429,
    })
  })

  it.each([
    ['an Error with no status', new Error('socket hang up')],
    ['a string', 'ECONNRESET'],
    ['null', null],
    ['an object with a nonsense status', { statusCode: 99 }],
  ])(
    'treats %s as a retryable connection-level failure with no status',
    (_, value) => {
      const failure = readUpstreamFailure(value, now)

      expect(failure.retryable).toBe(true)
      expect(failure.status).toBeUndefined()
    },
  )

  it('survives an error whose properties throw', () => {
    const hostile = Object.defineProperty({}, 'statusCode', {
      get() {
        throw new Error('hostile accessor')
      },
    })

    expect(readUpstreamFailure(hostile, now)).toEqual({
      retryable: true,
      retryDelayMs: DEFAULT_RETRY_DELAY_MS,
    })
  })

  it('prefers an explicit retry-after-ms header', () => {
    const failure = readUpstreamFailure(
      { statusCode: 429, headers: new Headers({ 'retry-after-ms': '1750' }) },
      now,
    )

    expect(failure.retryDelayMs).toBe(1750)
  })

  it('reads retry-after as whole seconds', () => {
    const failure = readUpstreamFailure(
      { statusCode: 429, headers: new Headers({ 'retry-after': '3' }) },
      now,
    )

    expect(failure.retryDelayMs).toBe(3000)
  })

  it('reads retry-after as an HTTP date against the injected clock', () => {
    const deadline = new Date(now + 5000)
    const failure = readUpstreamFailure(
      {
        statusCode: 429,
        headers: new Headers({ 'retry-after': deadline.toUTCString() }),
      },
      now,
    )

    // toUTCString drops sub-second precision, so compare against the same
    // truncation the header carries rather than the raw 5000ms.
    expect(failure.retryDelayMs).toBe(Date.parse(deadline.toUTCString()) - now)
  })

  it.each([
    ['a blank retry-after-ms', { 'retry-after-ms': '' }],
    ['a whitespace retry-after-ms', { 'retry-after-ms': '   ' }],
    ['a blank retry-after', { 'retry-after': '' }],
    ['an unparseable retry-after', { 'retry-after': 'soon' }],
    ['a fractional retry-after', { 'retry-after': '1.5' }],
    ['a negative retry-after', { 'retry-after': '-5' }],
  ])('falls back to the default delay for %s', (_, header) => {
    const failure = readUpstreamFailure(
      { statusCode: 429, headers: new Headers(header) },
      now,
    )

    // `Number('')` is 0, so a blank header used to mean "re-issue immediately"
    // straight back into the endpoint that just refused.
    expect(failure.retryDelayMs).toBe(DEFAULT_RETRY_DELAY_MS)
  })

  it.each([
    ['an HTTP date in the past', new Date(now - 60_000)],
    ['an HTTP date at the current instant', new Date(now)],
  ])('falls back to the default delay for %s', (_, deadline) => {
    const failure = readUpstreamFailure(
      {
        statusCode: 429,
        headers: new Headers({ 'retry-after': deadline.toUTCString() }),
      },
      now,
    )

    expect(failure.retryDelayMs).toBe(DEFAULT_RETRY_DELAY_MS)
  })

  it.each([
    ['retry-after-ms', { 'retry-after-ms': '600000' }],
    ['retry-after seconds', { 'retry-after': '600' }],
    [
      'an HTTP date far in the future',
      { 'retry-after': new Date(now + 600_000).toUTCString() },
    ],
  ])('clamps an oversized %s to the provider ceiling', (_, header) => {
    const failure = readUpstreamFailure(
      { statusCode: 429, headers: new Headers(header) },
      now,
    )

    expect(failure.retryDelayMs).toBe(MAX_PROVIDER_RETRY_DELAY_MS)
  })

  it('ignores headers that are not a Headers instance', () => {
    const failure = readUpstreamFailure(
      { statusCode: 429, headers: { 'retry-after-ms': '5' } },
      now,
    )

    expect(failure.retryDelayMs).toBe(DEFAULT_RETRY_DELAY_MS)
  })
})

describe('waitForRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('resolves after the delay and releases its timer and listener', async () => {
    const controller = new AbortController()
    const removeEventListener = jest.spyOn(
      controller.signal,
      'removeEventListener',
    )
    const pending = waitForRetry(40, controller.signal)

    jest.advanceTimersByTime(40)
    await expect(pending).resolves.toBeUndefined()
    expect(removeEventListener).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      waitForRetry(30_000, controller.signal),
    ).rejects.toBeInstanceOf(CompletionProviderError)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('rejects with a fixed cancellation code when aborted mid-wait', async () => {
    const controller = new AbortController()
    const pending = waitForRetry(30_000, controller.signal)

    controller.abort()

    await expect(pending).rejects.toMatchObject({
      code: 'COMPLETION_CANCELLED',
    })
    // The pending timer is cleared so a long delay cannot outlive the request.
    expect(jest.getTimerCount()).toBe(0)
  })

  it('ignores an abort that arrives after the delay already elapsed', async () => {
    const controller = new AbortController()
    const pending = waitForRetry(10, controller.signal)

    jest.advanceTimersByTime(10)
    await expect(pending).resolves.toBeUndefined()

    expect(() => {
      controller.abort()
    }).not.toThrow()
  })
})
