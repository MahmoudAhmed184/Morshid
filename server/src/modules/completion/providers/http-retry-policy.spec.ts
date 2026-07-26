import { CompletionProviderError } from '../completion-provider'
import {
  DEFAULT_RETRY_DELAY_MS,
  MAX_PROVIDER_RETRY_DELAY_MS,
  MAX_UPSTREAM_ATTEMPTS,
  readUpstreamFailure,
  waitForRetry,
} from './http-retry-policy'

// The shared policy's own behaviour is covered in
// `common/upstream/upstream-retry-policy.spec.ts`. What is left to prove here
// is the one thing this shim adds: completion's cancellation error is bound, so
// an aborted retry wait is still indistinguishable from any other cancelled
// completion step.
describe('completion retry policy shim', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('rejects an already-aborted wait with COMPLETION_CANCELLED', async () => {
    const controller = new AbortController()
    controller.abort()

    const failure = expect(waitForRetry(30_000, controller.signal)).rejects
    await failure.toBeInstanceOf(CompletionProviderError)
    await failure.toMatchObject({ code: 'COMPLETION_CANCELLED' })
  })

  it('rejects a mid-wait abort with COMPLETION_CANCELLED', async () => {
    const controller = new AbortController()
    const pending = waitForRetry(30_000, controller.signal)

    controller.abort()

    await expect(pending).rejects.toMatchObject({
      code: 'COMPLETION_CANCELLED',
    })
    expect(jest.getTimerCount()).toBe(0)
  })

  it('resolves a completed wait without an error', async () => {
    const controller = new AbortController()
    const pending = waitForRetry(40, controller.signal)

    jest.advanceTimersByTime(40)

    await expect(pending).resolves.toBeUndefined()
  })

  it('re-exports the shared classification surface unchanged', () => {
    expect(MAX_UPSTREAM_ATTEMPTS).toBe(2)
    expect(readUpstreamFailure({ statusCode: 429 }, 0)).toEqual({
      status: 429,
      retryable: true,
      retryDelayMs: DEFAULT_RETRY_DELAY_MS,
    })
    expect(MAX_PROVIDER_RETRY_DELAY_MS).toBe(30_000)
  })
})
