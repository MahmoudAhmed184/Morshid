import { Module } from '@nestjs/common'

import { IdentityModule } from '../identity/identity.module'
import { PrismaModule } from '../../platform/database/prisma.module'
import { AuditModule } from '../audit/audit.module'
import { CourseAccessService } from './course-access.service'
import { PrismaActiveCourseMembership } from './active-course-membership'
import { ActiveCourseMembership } from './interface/active-course-membership'
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
      provide: ActiveCourseMembership,
      useClass: PrismaActiveCourseMembership,
    },
    {
      provide: CoursesRepository,
      useClass: PrismaCoursesRepository,
    },
  ],
  exports: [ActiveCourseMembership, CourseAccessService, CoursesRepository],
})
export class CoursesModule {}
