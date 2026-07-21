import { Injectable } from '@nestjs/common'

import { PrismaService } from '../prisma/prisma.service'

export abstract class MaterialProcessingScheduler {
  abstract scheduleMaterialProcessing(materialId: string): Promise<void>
}

@Injectable()
export class DurableMaterialProcessingScheduler extends MaterialProcessingScheduler {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  async scheduleMaterialProcessing(materialId: string): Promise<void> {
    await this.prismaService.materialProcessingCommand.upsert({
      where: { materialId },
      create: { materialId },
      update: {},
    })
  }
}
