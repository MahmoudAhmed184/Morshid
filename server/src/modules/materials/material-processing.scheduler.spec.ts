/* eslint-disable @typescript-eslint/unbound-method */

import { Logger } from '@nestjs/common'

import { AsyncMaterialProcessingScheduler } from './material-processing.scheduler'
import type { MaterialProcessingService } from './material-processing.service'

describe('AsyncMaterialProcessingScheduler', () => {
  const materialId = '00000000-0000-4000-8000-000000000701'

  function buildScheduler() {
    const processingService = {
      processMaterial: jest.fn().mockResolvedValue('READY'),
    } as unknown as jest.Mocked<MaterialProcessingService>

    return {
      processingService,
      scheduler: new AsyncMaterialProcessingScheduler(processingService),
    }
  }

  it('resolves scheduling before processing runs', async () => {
    const { processingService, scheduler } = buildScheduler()

    await expect(
      scheduler.scheduleMaterialProcessing(materialId),
    ).resolves.toBeUndefined()
    expect(processingService.processMaterial).not.toHaveBeenCalled()

    await waitForImmediate()
    expect(processingService.processMaterial).toHaveBeenCalledWith(materialId)
  })

  it('logs scheduled processing failures without rejecting scheduling', async () => {
    const { processingService, scheduler } = buildScheduler()
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined)
    processingService.processMaterial.mockRejectedValueOnce(
      new Error('processing unavailable'),
    )

    await expect(
      scheduler.scheduleMaterialProcessing(materialId),
    ).resolves.toBeUndefined()
    await waitForImmediate()

    expect(loggerSpy).toHaveBeenCalledWith(
      'Scheduled material processing failed',
      expect.any(String),
    )
    loggerSpy.mockRestore()
  })
})

function waitForImmediate(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve)
  })
}
