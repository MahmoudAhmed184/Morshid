import { Injectable } from '@nestjs/common'

import { MaterialsRepository } from './materials.repository'

@Injectable()
export class MaterialsService {
  constructor(private readonly materialsRepository: MaterialsRepository) {
    void this.materialsRepository
  }
}
