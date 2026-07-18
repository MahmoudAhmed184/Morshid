import { Injectable } from '@nestjs/common'

import { PrismaService } from '../prisma/prisma.service'

export abstract class MaterialsRepository {
  protected abstract readonly repositoryName: string
}

@Injectable()
export class PrismaMaterialsRepository extends MaterialsRepository {
  protected readonly repositoryName = PrismaMaterialsRepository.name

  constructor(private readonly prismaService: PrismaService) {
    super()
    void this.prismaService
  }
}
