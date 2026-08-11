import { Module } from '@nestjs/common'

import { IdentityModule } from '../identity/identity.module'
import { PrismaModule } from '../prisma/prisma.module'
import { AuditModule } from '../audit/audit.module'
import { CourseAccessService } from './course-access.service'
import { CourseAudit } from './course-audit'
import { CourseAdministrationController } from './course-administration.controller'
import { CourseAdministrationService } from './course-administration.service'
import { CoursesController } from './courses.controller'
import {
  CoursesRepository,
  PrismaCoursesRepository,
} from './courses.repository'
import { CoursesService } from './courses.service'

@Module({
  imports: [PrismaModule, IdentityModule, AuditModule],
  controllers: [CoursesController, CourseAdministrationController],
  providers: [
    CoursesService,
    CourseAccessService,
    CourseAdministrationService,
    CourseAudit,
    {
      provide: CoursesRepository,
      useClass: PrismaCoursesRepository,
    },
  ],
  exports: [CourseAccessService, CoursesRepository],
})
export class CoursesModule {}
