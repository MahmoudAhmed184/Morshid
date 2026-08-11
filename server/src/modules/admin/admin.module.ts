import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { IdentityModule } from '../identity/identity.module'
import { PrismaModule } from '../prisma/prisma.module'
import { AdminCoursesAuditService } from './courses/admin-courses.audit.service'
import { AdminCoursesController } from './courses/admin-courses.controller'
import {
  AdminCoursesRepository,
  PrismaAdminCoursesRepository,
} from './courses/admin-courses.repository'
import { AdminCoursesService } from './courses/admin-courses.service'
import { AdminAuditController } from './audit/admin-audit.controller'

@Module({
  imports: [PrismaModule, AuditModule, IdentityModule],
  controllers: [AdminCoursesController, AdminAuditController],
  providers: [
    AdminCoursesService,
    AdminCoursesAuditService,
    {
      provide: AdminCoursesRepository,
      useClass: PrismaAdminCoursesRepository,
    },
  ],
})
export class AdminModule {}
