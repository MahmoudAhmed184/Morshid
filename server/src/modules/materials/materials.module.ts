import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { CoursesModule } from '../courses/courses.module'
import { EmbeddingModule } from '../../platform/ai/embedding/embedding.module'
import { PdfStorageModule } from '../../platform/document-storage/pdf-storage.module'
import { PrismaModule } from '../../platform/database/prisma.module'
import {
  DurableMaterialProcessingScheduler,
  MaterialProcessingScheduler,
} from './processing/material-processing.scheduler'
import { MaterialProcessingService } from './processing/material-processing.service'
import { MaterialChunkEmbeddingService } from './processing/material-chunk-embedding.service'
import { MaterialTextChunker } from './processing/material-text-chunker'
import { MaterialUploadConfigurationController } from './upload/material-upload-configuration.controller'
import { MaterialUploadConfigurationService } from './upload/material-upload-configuration.service'
import { MaterialsAuditService } from './catalog/materials.audit.service'
import { MaterialsController } from './catalog/materials.controller'
import {
  MaterialsRepository,
  PrismaMaterialsRepository,
} from './catalog/materials.repository'
import {
  MaterialChunkRepository,
  PrismaMaterialChunkRepository,
} from './processing/material-chunk.repository'
import { MaterialsService } from './catalog/materials.service'
import { PdfUploadValidator } from './upload/pdf-upload.validator'
import {
  PDF_DOCUMENT_LOADER,
  PDF_TEXT_EXTRACTOR,
  PdfJsDocumentLoader,
  PdfJsTextExtractor,
} from './processing/pdf-text-extractor'
import { PdfUploadInterceptor } from './upload/pdf-upload.interceptor'
import { CourseEvidence } from './interface/course-evidence'
import { MaterialsCourseEvidence } from './evidence/materials-course-evidence'
import {
  CourseEvidenceRepository,
  PrismaCourseEvidenceRepository,
} from './evidence/course-evidence.repository'
import { StudentCitationSources } from './interface/student-citation-sources'
import { PrismaStudentCitationSources } from './evidence/student-citation-sources'

@Module({
  imports: [
    PrismaModule,
    CoursesModule,
    PdfStorageModule,
    AuditModule,
    EmbeddingModule,
  ],
  controllers: [MaterialsController, MaterialUploadConfigurationController],
  providers: [
    MaterialsService,
    PdfUploadValidator,
    PdfUploadInterceptor,
    MaterialsAuditService,
    MaterialProcessingService,
    MaterialChunkEmbeddingService,
    MaterialTextChunker,
    MaterialUploadConfigurationService,
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
    {
      provide: MaterialChunkRepository,
      useClass: PrismaMaterialChunkRepository,
    },
    {
      provide: CourseEvidenceRepository,
      useClass: PrismaCourseEvidenceRepository,
    },
    {
      provide: CourseEvidence,
      useClass: MaterialsCourseEvidence,
    },
    {
      provide: StudentCitationSources,
      useClass: PrismaStudentCitationSources,
    },
  ],
  exports: [CourseEvidence, StudentCitationSources],
})
export class MaterialsModule {}
