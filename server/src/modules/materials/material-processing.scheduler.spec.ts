import { Logger } from '@nestjs/common'

import type { PrismaService } from '../prisma/prisma.service'
import type { MaterialProcessingService } from './material-processing.service'
import { DurableMaterialProcessingScheduler } from './material-processing.scheduler'

describe('DurableMaterialProcessingScheduler', () => {
  let findMany: jest.Mock
  let upsert: jest.Mock
  let processMaterial: jest.Mock
  let scheduler: DurableMaterialProcessingScheduler

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([])
    upsert = jest.fn().mockResolvedValue(undefined)
    processMaterial = jest.fn().mockResolvedValue(undefined)
    scheduler = new DurableMaterialProcessingScheduler(
      {
        materialProcessingCommand: { findMany, upsert },
      } as unknown as PrismaService,
      { processMaterial } as unknown as MaterialProcessingService,
    )
  })

  afterEach(async () => {
    await scheduler.onModuleDestroy()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('durably schedules a command and wakes processing', async () => {
    findMany.mockResolvedValueOnce([{ materialId: 'material-80' }])

    await scheduler.scheduleMaterialProcessing('material-80')
    await flushImmediate()

    expect(upsert).toHaveBeenCalledWith({
      where: { materialId: 'material-80' },
      create: { materialId: 'material-80' },
      update: {},
    })
    expect(processMaterial).toHaveBeenCalledWith('material-80')
  })

  it('drains recoverable persisted commands when the module starts', async () => {
    findMany.mockResolvedValueOnce([{ materialId: 'restarted-material' }])

    scheduler.onModuleInit()
    await flushImmediate()

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { processingAttemptId: null },
            { leaseExpiresAt: { lte: expect.any(Date) as Date } },
          ],
        },
      }),
    )
    expect(processMaterial).toHaveBeenCalledWith('restarted-material')
  })

  it('contains a rejected background processing promise', async () => {
    findMany.mockResolvedValueOnce([{ materialId: 'material-80' }])
    processMaterial.mockRejectedValue(
      new Error('lookup failed before processing'),
    )
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined)

    scheduler.onModuleInit()
    await flushImmediate()

    expect(logger).toHaveBeenCalledWith(
      'Material processing task failed materialId=material-80',
    )
  })

  it('contains command lookup failures for later polling retries', async () => {
    findMany.mockRejectedValueOnce(new Error('database unavailable'))
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined)

    scheduler.onModuleInit()
    await flushImmediate()

    expect(logger).toHaveBeenCalledWith(
      'Material processing command drain failed',
    )
  })

  it('cancels pending wakes and polling when the module is destroyed', async () => {
    jest.useFakeTimers()

    scheduler.onModuleInit()
    await scheduler.onModuleDestroy()
    await jest.advanceTimersByTimeAsync(5_000)

    await scheduler.scheduleMaterialProcessing('after-shutdown')
    await jest.runOnlyPendingTimersAsync()

    expect(upsert).toHaveBeenCalledWith({
      where: { materialId: 'after-shutdown' },
      create: { materialId: 'after-shutdown' },
      update: {},
    })
    expect(findMany).not.toHaveBeenCalled()
    expect(processMaterial).not.toHaveBeenCalled()
  })

  it('does not start processing work returned after module destruction', async () => {
    const commands = deferredCommands()
    findMany.mockReturnValueOnce(commands.promise)

    scheduler.onModuleInit()
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(findMany).toHaveBeenCalledTimes(1)

    const shutdown = scheduler.onModuleDestroy()
    commands.resolve([{ materialId: 'pending-at-shutdown' }])
    await shutdown

    expect(processMaterial).not.toHaveBeenCalled()
  })

  it('waits for an in-flight processing job during shutdown', async () => {
    const processing = deferredProcessing()
    findMany.mockResolvedValueOnce([{ materialId: 'active-at-shutdown' }])
    processMaterial.mockReturnValueOnce(processing.promise)
    scheduler.onModuleInit()
    await waitForCalls(processMaterial, 1)

    let shutdownComplete = false
    const shutdown = scheduler.onModuleDestroy().then(() => {
      shutdownComplete = true
    })
    await flushImmediate()

    expect(shutdownComplete).toBe(false)
    processing.resolve()
    await shutdown
    expect(shutdownComplete).toBe(true)
  })
})

function deferredCommands() {
  let resolve!: (commands: { materialId: string }[]) => void
  const promise = new Promise<{ materialId: string }[]>((done) => {
    resolve = done
  })

  return { promise, resolve }
}

function deferredProcessing() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })

  return { promise, resolve }
}

async function waitForCalls(mock: jest.Mock, count: number): Promise<void> {
  while (mock.mock.calls.length < count) {
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
}

async function flushImmediate(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve))
  await new Promise<void>((resolve) => setImmediate(resolve))
}
