import { Module } from '@nestjs/common'

import { IdentityModule } from '../identity/identity.module'
import { PrismaModule } from '../prisma/prisma.module'
import { CourseAccessService } from './course-access.service'
import { CoursesController } from './courses.controller'
import {
  CoursesRepository,
  PrismaCoursesRepository,
} from './courses.repository'
import { CoursesService } from './courses.service'

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [CoursesController],
  providers: [
    CoursesService,
    CourseAccessService,
    {
      provide: CoursesRepository,
      useClass: PrismaCoursesRepository,
    },
  ],
  exports: [CourseAccessService],
})
export class CoursesModule {}
