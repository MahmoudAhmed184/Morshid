import { CompletionProviderError } from '../completion-provider'
import { waitForRetry as waitForUpstreamRetry } from '../../../common/upstream/upstream-retry-policy'

// The policy itself now lives in `common/upstream`, because embedding retries
// against the same providers and a second copy of the `Retry-After` parsing
// could drift from this one. This file stays the completion module's entry
// point and binds completion's cancellation error, so no call site here has to
// know which error vocabulary the shared helper was given.
export {
  DEFAULT_RETRY_DELAY_MS,
  MAX_PROVIDER_RETRY_DELAY_MS,
  MAX_UPSTREAM_ATTEMPTS,
  readUpstreamFailure,
} from '../../../common/upstream/upstream-retry-policy'
export type {
  RetryClock,
  RetryDelay,
  UpstreamFailure,
} from '../../../common/upstream/upstream-retry-policy'

/**
 * Sleeps for a bounded delay, rejecting with `COMPLETION_CANCELLED` on abort.
 *
 * Binding the error here rather than at each call site is what keeps an aborted
 * retry wait indistinguishable from every other cancelled completion step.
 */
export function waitForRetry(
  delayMs: number,
  signal: AbortSignal,
): Promise<void> {
  return waitForUpstreamRetry(
    delayMs,
    signal,
    () => new CompletionProviderError('COMPLETION_CANCELLED'),
  )
}
