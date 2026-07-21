import { Injectable, Logger } from '@nestjs/common'

import { MaterialProcessingService } from './material-processing.service'

export abstract class MaterialProcessingScheduler {
  abstract scheduleMaterialProcessing(materialId: string): Promise<void>
}

@Injectable()
export class AsyncMaterialProcessingScheduler extends MaterialProcessingScheduler {
  private readonly logger = new Logger(AsyncMaterialProcessingScheduler.name)

  constructor(
    private readonly materialProcessingService: MaterialProcessingService,
  ) {
    super()
  }

  scheduleMaterialProcessing(materialId: string): Promise<void> {
    setImmediate(() => {
      void this.processScheduledMaterial(materialId)
    })

    return Promise.resolve()
  }

  private async processScheduledMaterial(materialId: string): Promise<void> {
    try {
      await this.materialProcessingService.processMaterial(materialId)
    } catch (error) {
      this.logger.error(
        'Scheduled material processing failed',
        error instanceof Error ? error.stack : undefined,
      )
    }
  }
}
