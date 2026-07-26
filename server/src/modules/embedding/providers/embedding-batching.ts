import { EmbeddingUpstreamError } from '../embedding-provider'

export interface EmbeddingBatchRange {
  readonly start: number
  /** Exclusive, so a range is directly usable with `slice`. */
  readonly end: number
}

/**
 * Splits `count` items into contiguous ranges of at most `maxPerRequest`.
 *
 * Ranges rather than copied slices: the caller owns the items and the ordering
 * is expressed by the indices themselves, so nothing downstream has to
 * reconstruct which result belonged to which input.
 */
export function planEmbeddingBatches(
  count: number,
  maxPerRequest: number,
): readonly EmbeddingBatchRange[] {
  if (
    !Number.isSafeInteger(count) ||
    count < 0 ||
    !Number.isSafeInteger(maxPerRequest) ||
    maxPerRequest < 1
  ) {
    throw new EmbeddingUpstreamError('EMBEDDING_CONFIGURATION_INVALID')
  }

  const ranges: EmbeddingBatchRange[] = []
  for (let start = 0; start < count; start += maxPerRequest) {
    ranges.push({ start, end: Math.min(start + maxPerRequest, count) })
  }
  return ranges
}

/**
 * Internal marker for "this worker was aborted by the group, not by anything
 * of its own". It never escapes `mapBoundedConcurrency`.
 */
class GroupAbortError extends Error {
  constructor() {
    super('Embedding batch group aborted')
    this.name = 'GroupAbortError'
  }
}

interface IndexedFailure {
  readonly index: number
  readonly error: unknown
}

/**
 * Runs `worker` over `items` with at most `concurrency` in flight, writing each
 * result into a pre-allocated slot.
 *
 * Ordering is structural — a result is stored at its own index and is never
 * sorted afterwards — so a worker that resolves out of order cannot reorder the
 * output.
 *
 * Failure selection is deliberate. Under concurrency the highest-index task can
 * fail first in wall-clock time and abort lower-index tasks that were still
 * running, so "first rejection wins" would report an arbitrary worker chosen by
 * scheduling. Instead: after every started worker has settled, throw the
 * **lowest-index genuine failure**, ignoring cancellations that this group's own
 * abort caused. Awaiting every started promise before rethrowing is also what
 * keeps a late rejection from surfacing as an unhandled rejection.
 */
export async function mapBoundedConcurrency<Item, Result>(
  items: readonly Item[],
  concurrency: number,
  worker: (item: Item, index: number, signal: AbortSignal) => Promise<Result>,
  parentSignal?: AbortSignal,
): Promise<Result[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new EmbeddingUpstreamError('EMBEDDING_CONFIGURATION_INVALID')
  }
  if (isAborted(parentSignal)) {
    throw new EmbeddingUpstreamError('EMBEDDING_CANCELLED')
  }
  if (items.length === 0) {
    return []
  }

  const results = new Array<Result>(items.length)
  const failures: IndexedFailure[] = []
  const group = new AbortController()
  const onParentAbort = () => {
    group.abort()
  }
  parentSignal?.addEventListener('abort', onParentAbort, { once: true })

  let nextIndex = 0
  const runners: Promise<void>[] = []

  const runNext = async (): Promise<void> => {
    for (;;) {
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length || group.signal.aborted) {
        return
      }

      try {
        results[index] = await worker(items[index], index, group.signal)
      } catch (error) {
        failures.push({ index, error })
        group.abort()
        return
      }
    }
  }

  try {
    for (let slot = 0; slot < Math.min(concurrency, items.length); slot += 1) {
      runners.push(runNext())
    }
    // `runNext` never rejects — it records failures instead — so this cannot
    // leave a started promise floating.
    await Promise.all(runners)
  } finally {
    parentSignal?.removeEventListener('abort', onParentAbort)
  }

  // External cancellation outranks whatever the workers reported: the group was
  // torn down because the caller asked, not because the upstream failed.
  if (isAborted(parentSignal)) {
    throw new EmbeddingUpstreamError('EMBEDDING_CANCELLED')
  }

  const genuine = failures
    .filter(({ error }) => !isGroupAbort(error))
    .sort((left, right) => left.index - right.index)

  if (genuine.length > 0) {
    throw genuine[0].error
  }

  return results
}

/** Raised by a worker that observed this group's own abort. */
export function createGroupAbortError(): Error {
  return new GroupAbortError()
}

// A function rather than an inline check: an `AbortSignal` is mutable external
// state, so narrowing the first read would wrongly convince the compiler the
// second read cannot observe an abort that happened in between.
function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted ?? false
}

function isGroupAbort(error: unknown): boolean {
  return error instanceof GroupAbortError
}
