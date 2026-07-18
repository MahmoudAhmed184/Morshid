import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import {
  MaterialsRepository,
  PrismaMaterialsRepository,
} from './materials.repository'
import { MaterialsService } from './materials.service'

@Module({
  imports: [PrismaModule],
  providers: [
    MaterialsService,
    {
      provide: MaterialsRepository,
      useClass: PrismaMaterialsRepository,
    },
  ],
})
export class MaterialsModule {}
