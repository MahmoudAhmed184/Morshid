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

  afterEach(() => {
    scheduler.onModuleDestroy()
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
})

async function flushImmediate(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve))
  await new Promise<void>((resolve) => setImmediate(resolve))
}
