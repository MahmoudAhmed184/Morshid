import { Injectable, Logger } from '@nestjs/common'

import { MaterialProcessingService } from './material-processing.service'

export abstract class MaterialProcessingScheduler {
  abstract scheduleMaterialProcessing(materialId: string): Promise<void>
}

@Injectable()
export class InProcessMaterialProcessingScheduler extends MaterialProcessingScheduler {
  private readonly logger = new Logger(
    InProcessMaterialProcessingScheduler.name,
  )

  constructor(
    private readonly materialProcessingService: MaterialProcessingService,
  ) {
    super()
  }

  scheduleMaterialProcessing(materialId: string): Promise<void> {
    setImmediate(() => {
      void this.materialProcessingService
        .processMaterial(materialId)
        .catch(() => {
          this.logger.error(
            `Material processing task failed materialId=${materialId}`,
          )
        })
    })
    return Promise.resolve()
  }
}
