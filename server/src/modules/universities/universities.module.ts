import { Module } from '@nestjs/common'

import { PrismaModule } from '../../platform/database/prisma.module'
import { IdentityModule } from '../identity/identity.module'
import { UniversitiesController } from './universities.controller'
import {
  PrismaUniversitiesRepository,
  UniversitiesRepository,
} from './universities.repository'
import { UniversitiesService } from './universities.service'

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [UniversitiesController],
  providers: [
    UniversitiesService,
    {
      provide: UniversitiesRepository,
      useClass: PrismaUniversitiesRepository,
    },
  ],
  exports: [UniversitiesService, UniversitiesRepository],
})
export class UniversitiesModule {}
