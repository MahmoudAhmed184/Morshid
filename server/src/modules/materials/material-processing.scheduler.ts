import { Injectable } from '@nestjs/common'

import { MaterialProcessingService } from './material-processing.service'

export abstract class MaterialProcessingScheduler {
  abstract scheduleMaterialProcessing(materialId: string): Promise<void>
}

@Injectable()
export class InProcessMaterialProcessingScheduler extends MaterialProcessingScheduler {
  constructor(
    private readonly materialProcessingService: MaterialProcessingService,
  ) {
    super()
  }

  scheduleMaterialProcessing(materialId: string): Promise<void> {
    setImmediate(() => {
      void this.materialProcessingService.processMaterial(materialId)
    })
    return Promise.resolve()
  }
}
