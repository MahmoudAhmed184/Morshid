import { MaterialProcessingScheduler } from '../../src/modules/materials/material-processing.scheduler'

export class NoopMaterialProcessingScheduler extends MaterialProcessingScheduler {
  scheduleMaterialProcessing(_materialId: string): Promise<void> {
    return Promise.resolve()
  }
}
