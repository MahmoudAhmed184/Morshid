import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import {
  PrismaRagPersistenceRepository,
  RagPersistenceRepository,
} from './rag-persistence.repository'

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: RagPersistenceRepository,
      useClass: PrismaRagPersistenceRepository,
    },
  ],
  exports: [RagPersistenceRepository],
})
export class RagPersistenceModule {}
