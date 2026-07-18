import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { CoursesModule } from '../courses/courses.module'
import { PdfStorageModule } from '../pdf-storage/pdf-storage.module'
import { PrismaModule } from '../prisma/prisma.module'
import {
  MaterialProcessingScheduler,
  NoopMaterialProcessingScheduler,
} from './material-processing.scheduler'
import { MaterialsAuditService } from './materials.audit.service'
import { MaterialsController } from './materials.controller'
import {
  MaterialsRepository,
  PrismaMaterialsRepository,
} from './materials.repository'
import { MaterialsService } from './materials.service'
import { PdfUploadValidator } from './pdf-upload.validator'

@Module({
  imports: [PrismaModule, CoursesModule, PdfStorageModule, AuditModule],
  controllers: [MaterialsController],
  providers: [
    MaterialsService,
    PdfUploadValidator,
    MaterialsAuditService,
    {
      provide: MaterialProcessingScheduler,
      useClass: NoopMaterialProcessingScheduler,
    },
    {
      provide: MaterialsRepository,
      useClass: PrismaMaterialsRepository,
    },
  ],
})
export class MaterialsModule {}
