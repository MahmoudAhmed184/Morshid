import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { AdminUsersAuditService } from './users/admin-users.audit.service'
import { AdminUsersController } from './users/admin-users.controller'
import {
  AdminUsersRepository,
  PrismaAdminUsersRepository,
} from './users/admin-users.repository'
import { AdminUsersService } from './users/admin-users.service'

@Module({
  imports: [PrismaModule, AuditModule, AuthModule],
  controllers: [AdminUsersController],
  providers: [
    AdminUsersService,
    AdminUsersAuditService,
    {
      provide: AdminUsersRepository,
      useClass: PrismaAdminUsersRepository,
    },
  ],
})
export class AdminModule {}
