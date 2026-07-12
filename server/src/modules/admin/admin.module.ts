import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { AdminCoursesAuditService } from './courses/admin-courses.audit.service'
import { AdminCoursesController } from './courses/admin-courses.controller'
import {
  AdminCoursesRepository,
  PrismaAdminCoursesRepository,
} from './courses/admin-courses.repository'
import { AdminCoursesService } from './courses/admin-courses.service'
import { AdminUsersAuditService } from './users/admin-users.audit.service'
import { AdminUsersController } from './users/admin-users.controller'
import {
  AdminUsersRepository,
  PrismaAdminUsersRepository,
} from './users/admin-users.repository'
import { AdminUsersService } from './users/admin-users.service'

@Module({
  imports: [PrismaModule, AuditModule, AuthModule],
  controllers: [AdminUsersController, AdminCoursesController],
  providers: [
    AdminUsersService,
    AdminUsersAuditService,
    {
      provide: AdminUsersRepository,
      useClass: PrismaAdminUsersRepository,
    },
    AdminCoursesService,
    AdminCoursesAuditService,
    {
      provide: AdminCoursesRepository,
      useClass: PrismaAdminCoursesRepository,
    },
  ],
})
export class AdminModule {}
