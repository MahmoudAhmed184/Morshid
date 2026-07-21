import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { CoursesModule } from '../courses/courses.module'
import { EmbeddingModule } from '../embedding/embedding.module'
import { PdfStorageModule } from '../pdf-storage/pdf-storage.module'
import { PrismaModule } from '../prisma/prisma.module'
import {
  AsyncMaterialProcessingScheduler,
  MaterialProcessingScheduler,
} from './material-processing.scheduler'
import { MaterialProcessingAuditService } from './material-processing.audit.service'
import {
  MaterialProcessingRepository,
  PrismaMaterialProcessingRepository,
} from './material-processing.repository'
import { MaterialProcessingService } from './material-processing.service'
import { MaterialsAuditService } from './materials.audit.service'
import { MaterialsController } from './materials.controller'
import {
  MaterialsRepository,
  PrismaMaterialsRepository,
} from './materials.repository'
import { MaterialsService } from './materials.service'
import { PdfTextExtractor } from './pdf-text.extractor'
import { PdfUploadValidator } from './pdf-upload.validator'

@Module({
  imports: [
    PrismaModule,
    CoursesModule,
    PdfStorageModule,
    AuditModule,
    EmbeddingModule,
  ],
  controllers: [MaterialsController],
  providers: [
    MaterialsService,
    PdfUploadValidator,
    MaterialsAuditService,
    PdfTextExtractor,
    MaterialProcessingService,
    MaterialProcessingAuditService,
    {
      provide: MaterialProcessingScheduler,
      useClass: AsyncMaterialProcessingScheduler,
    },
    {
      provide: MaterialProcessingRepository,
      useClass: PrismaMaterialProcessingRepository,
    },
    {
      provide: MaterialsRepository,
      useClass: PrismaMaterialsRepository,
    },
  ],
})
export class MaterialsModule {}
