import { Module } from '@nestjs/common'

import { EmbeddingModule } from '../embedding/embedding.module'
import { PdfStorageModule } from '../pdf-storage/pdf-storage.module'
import { PrismaModule } from '../prisma/prisma.module'
import {
  CourseRetrievalRepository,
  PrismaCourseRetrievalRepository,
} from './course-retrieval.repository'
import { RetrievalService } from './retrieval.service'

@Module({
  imports: [PrismaModule, EmbeddingModule, PdfStorageModule],
  providers: [
    {
      provide: CourseRetrievalRepository,
      useClass: PrismaCourseRetrievalRepository,
    },
    RetrievalService,
  ],
  // Only the service is exported: the repository stays module-private so no
  // caller can reach the query with limits or predicates the validated
  // configuration does not own.
  exports: [RetrievalService],
})
export class RetrievalModule {}
