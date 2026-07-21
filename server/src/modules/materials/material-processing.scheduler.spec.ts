import { Logger } from '@nestjs/common'

import type { MaterialProcessingService } from './material-processing.service'
import { InProcessMaterialProcessingScheduler } from './material-processing.scheduler'

describe('InProcessMaterialProcessingScheduler', () => {
  it('contains a rejected background processing promise', async () => {
    const processingService = {
      processMaterial: jest
        .fn()
        .mockRejectedValue(new Error('lookup failed before processing')),
    }
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined)
    const scheduler = new InProcessMaterialProcessingScheduler(
      processingService as unknown as MaterialProcessingService,
    )

    await scheduler.scheduleMaterialProcessing('material-80')
    await new Promise<void>((resolve) => setImmediate(resolve))

    expect(processingService.processMaterial).toHaveBeenCalledWith(
      'material-80',
    )
    expect(logger).toHaveBeenCalledWith(
      'Material processing task failed materialId=material-80',
    )
    logger.mockRestore()
  })
})
