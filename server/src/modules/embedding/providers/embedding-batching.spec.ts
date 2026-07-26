import { EmbeddingUpstreamError } from '../embedding-provider'
import {
  createGroupAbortError,
  mapBoundedConcurrency,
  planEmbeddingBatches,
} from './embedding-batching'

describe('planEmbeddingBatches', () => {
  it('returns no ranges for an empty input', () => {
    expect(planEmbeddingBatches(0, 32)).toEqual([])
  })

  it('returns one range when the input fits in a single request', () => {
    expect(planEmbeddingBatches(32, 32)).toEqual([{ start: 0, end: 32 }])
  })

  it('splits into contiguous ranges with a short final range', () => {
    expect(planEmbeddingBatches(70, 32)).toEqual([
      { start: 0, end: 32 },
      { start: 32, end: 64 },
      { start: 64, end: 70 },
    ])
  })

  it('covers every index exactly once', () => {
    const ranges = planEmbeddingBatches(101, 7)
    const covered = ranges.flatMap(({ start, end }) =>
      Array.from({ length: end - start }, (_, offset) => start + offset),
    )

    expect(covered).toEqual(Array.from({ length: 101 }, (_, index) => index))
  })

  it.each([-1, 1.5])('rejects count %p as invalid configuration', (count) => {
    expect(() => planEmbeddingBatches(count, 32)).toThrow(
      EmbeddingUpstreamError,
    )
  })

  it.each([0, -1, 2.5])(
    'rejects batch size %p as invalid configuration',
    (maxPerRequest) => {
      expect(() => planEmbeddingBatches(10, maxPerRequest)).toThrow(
        EmbeddingUpstreamError,
      )
    },
  )
})

describe('mapBoundedConcurrency', () => {
  it('writes results at their own index regardless of settle order', async () => {
    const resolvers: (() => void)[] = []
    const pending = mapBoundedConcurrency(
      [0, 1, 2],
      3,
      (item) =>
        new Promise<string>((resolve) => {
          resolvers.push(() => {
            resolve(`item-${String(item)}`)
          })
        }),
    )

    // Settle in reverse; ordering must not depend on it.
    for (const resolve of [...resolvers].reverse()) {
      resolve()
    }

    await expect(pending).resolves.toEqual(['item-0', 'item-1', 'item-2'])
  })

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0
    let peak = 0

    await mapBoundedConcurrency(
      Array.from({ length: 20 }, (_, index) => index),
      4,
      async (item) => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await Promise.resolve()
        inFlight -= 1
        return item
      },
    )

    expect(peak).toBeLessThanOrEqual(4)
  })

  it('returns an empty array without invoking the worker', async () => {
    const worker = jest.fn()

    await expect(mapBoundedConcurrency([], 4, worker)).resolves.toEqual([])
    expect(worker).not.toHaveBeenCalled()
  })

  // Under concurrency the highest-index task can fail first in wall-clock time.
  // Reporting whichever rejected first would make the surfaced error depend on
  // scheduling rather than on the input.
  it('reports the lowest-index genuine failure, not the first to reject', async () => {
    const order: number[] = []

    await expect(
      mapBoundedConcurrency([0, 1, 2, 3], 4, async (index) => {
        if (index === 3) {
          order.push(index)
          throw new Error('late index failed first')
        }
        if (index === 1) {
          // Rejects after index 3 has already aborted the group.
          await Promise.resolve()
          await Promise.resolve()
          order.push(index)
          throw new Error('low index failed second')
        }
        await Promise.resolve()
        return index
      }),
    ).rejects.toThrow('low index failed second')

    expect(order).toEqual([3, 1])
  })

  it('never selects a cancellation caused by the internal group abort', async () => {
    await expect(
      mapBoundedConcurrency([0, 1], 2, async (index) => {
        if (index === 1) {
          throw new Error('genuine failure')
        }
        // Index 0 only fails because the group tore itself down.
        await Promise.resolve()
        throw createGroupAbortError()
      }),
    ).rejects.toThrow('genuine failure')
  })

  it('awaits every started worker before rethrowing', async () => {
    let settled = 0

    await expect(
      mapBoundedConcurrency([0, 1, 2], 3, async (index) => {
        if (index === 0) {
          settled += 1
          throw new Error('immediate failure')
        }
        await Promise.resolve()
        settled += 1
        return index
      }),
    ).rejects.toThrow('immediate failure')

    expect(settled).toBe(3)
  })

  it('reports external cancellation as EMBEDDING_CANCELLED', async () => {
    const controller = new AbortController()

    const pending = mapBoundedConcurrency(
      [0, 1],
      1,
      async (index, _position, signal) => {
        if (index === 0) {
          controller.abort()
        }
        await Promise.resolve()
        if (signal.aborted) {
          throw createGroupAbortError()
        }
        return index
      },
      controller.signal,
    )

    await expect(pending).rejects.toMatchObject({
      code: 'EMBEDDING_CANCELLED',
    })
  })

  it('reports an already-aborted parent without invoking the worker', async () => {
    const controller = new AbortController()
    controller.abort()
    const worker = jest.fn()

    await expect(
      mapBoundedConcurrency([0, 1], 2, worker, controller.signal),
    ).rejects.toMatchObject({ code: 'EMBEDDING_CANCELLED' })
    expect(worker).not.toHaveBeenCalled()
  })

  // External cancellation outranks whatever the workers reported: the group was
  // torn down because the caller asked, not because upstream failed.
  it('prefers external cancellation over a concurrent worker failure', async () => {
    const controller = new AbortController()

    await expect(
      mapBoundedConcurrency(
        [0],
        1,
        () => {
          controller.abort()
          return Promise.reject(new Error('worker failure'))
        },
        controller.signal,
      ),
    ).rejects.toMatchObject({ code: 'EMBEDDING_CANCELLED' })
  })

  it('propagates an expired whole-call deadline as EMBEDDING_TIMEOUT', async () => {
    await expect(
      mapBoundedConcurrency([0, 1], 2, (index) =>
        index === 0
          ? Promise.reject(new EmbeddingUpstreamError('EMBEDDING_TIMEOUT'))
          : Promise.resolve(index),
      ),
    ).rejects.toMatchObject({ code: 'EMBEDDING_TIMEOUT' })
  })

  it.each([0, -1, 1.5])(
    'rejects concurrency %p as invalid configuration',
    async (concurrency) => {
      await expect(
        mapBoundedConcurrency([0], concurrency, () => Promise.resolve(0)),
      ).rejects.toThrow(EmbeddingUpstreamError)
    },
  )
})
