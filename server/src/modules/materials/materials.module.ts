import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import {
  MaterialsRepository,
  PrismaMaterialsRepository,
} from './materials.repository'
import { MaterialsService } from './materials.service'
import { PdfUploadValidator } from './pdf-upload.validator'

@Module({
  imports: [PrismaModule],
  providers: [
    MaterialsService,
    PdfUploadValidator,
    {
      provide: MaterialsRepository,
      useClass: PrismaMaterialsRepository,
    },
  ],
})
export class MaterialsModule {}
