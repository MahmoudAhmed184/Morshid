import { Injectable } from '@nestjs/common'

export abstract class MaterialProcessingScheduler {
  abstract scheduleMaterialProcessing(materialId: string): Promise<void>
}

@Injectable()
export class NoopMaterialProcessingScheduler extends MaterialProcessingScheduler {
  async scheduleMaterialProcessing(_materialId: string): Promise<void> {
    return Promise.resolve()
  }
}
