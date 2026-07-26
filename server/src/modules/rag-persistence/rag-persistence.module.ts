import { Module } from '@nestjs/common'

import { EmbeddingModule } from '../embedding/embedding.module'
import { PrismaModule } from '../prisma/prisma.module'
import { MaterialChunkEmbeddingService } from './material-chunk-embedding.service'
import {
  PrismaRagPersistenceRepository,
  RagPersistenceRepository,
} from './rag-persistence.repository'

@Module({
  imports: [PrismaModule, EmbeddingModule],
  providers: [
    {
      provide: RagPersistenceRepository,
      useClass: PrismaRagPersistenceRepository,
    },
    MaterialChunkEmbeddingService,
  ],
  exports: [RagPersistenceRepository, MaterialChunkEmbeddingService],
})
export class RagPersistenceModule {}
