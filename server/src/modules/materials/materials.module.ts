import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { CoursesModule } from '../courses/courses.module'
import { PdfStorageModule } from '../pdf-storage/pdf-storage.module'
import { PrismaModule } from '../prisma/prisma.module'
import { RagPersistenceModule } from '../rag-persistence/rag-persistence.module'
import {
  DurableMaterialProcessingScheduler,
  MaterialProcessingScheduler,
} from './material-processing.scheduler'
import { MaterialProcessingService } from './material-processing.service'
import { MaterialTextChunker } from './material-text-chunker'
import { MaterialsAuditService } from './materials.audit.service'
import { MaterialsController } from './materials.controller'
import {
  MaterialsRepository,
  PrismaMaterialsRepository,
} from './materials.repository'
import { MaterialsService } from './materials.service'
import { PdfUploadValidator } from './pdf-upload.validator'
import {
  PDF_DOCUMENT_LOADER,
  PDF_TEXT_EXTRACTOR,
  PdfJsDocumentLoader,
  PdfJsTextExtractor,
} from './pdf-text-extractor'
import { PdfUploadInterceptor } from './pdf-upload.interceptor'

@Module({
  imports: [
    PrismaModule,
    CoursesModule,
    PdfStorageModule,
    AuditModule,
    RagPersistenceModule,
  ],
  controllers: [MaterialsController],
  providers: [
    MaterialsService,
    PdfUploadValidator,
    PdfUploadInterceptor,
    MaterialsAuditService,
    MaterialProcessingService,
    MaterialTextChunker,
    {
      provide: PDF_DOCUMENT_LOADER,
      useClass: PdfJsDocumentLoader,
    },
    {
      provide: PDF_TEXT_EXTRACTOR,
      useClass: PdfJsTextExtractor,
    },
    {
      provide: MaterialProcessingScheduler,
      useClass: DurableMaterialProcessingScheduler,
    },
    {
      provide: MaterialsRepository,
      useClass: PrismaMaterialsRepository,
    },
  ],
  exports: [MaterialProcessingService, PDF_TEXT_EXTRACTOR],
})
export class MaterialsModule {}
