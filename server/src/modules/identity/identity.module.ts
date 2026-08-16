import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'

import { AuditModule } from '../audit/audit.module'
import type { AppEnvironment } from '../../platform/config/env.schema'
import { PrismaModule } from '../../platform/database/prisma.module'
import { IdentityController } from './identity.controller'
import { IdentityGuard } from './identity.guard'
import { IdentityService } from './identity.service'
import { RefreshSessionRepository } from './refresh-session.repository'
import { RolesGuard } from './identity.roles.guard'
import { AccessToken } from './access-token'
import { IdentityAudit } from './identity-audit'
import { IdentityUser } from './identity-user'
import { PasswordHasher } from './password-hasher'
import { RefreshSession } from './refresh-session'
import { UserAdministrationController } from './user-administration/user-administration.controller'
import {
  PrismaUserAdministrationRepository,
  UserAdministrationRepository,
} from './user-administration/user-administration.repository'
import { UserAdministrationService } from './user-administration/user-administration.service'
import { UserAdministrationAuditService } from './user-administration/user-administration-audit'
import { UserImportRepository } from './user-administration/user-import.repository'
import { UserImportService } from './user-administration/user-import.service'

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnvironment, true>) => ({
        secret: configService.get('AUTH_ACCESS_TOKEN_SECRET', {
          infer: true,
        }),
        signOptions: {
          expiresIn: configService.get('AUTH_ACCESS_TOKEN_TTL_SECONDS', {
            infer: true,
          }),
        },
      }),
    }),
  ],
  controllers: [IdentityController, UserAdministrationController],
  providers: [
    IdentityService,
    IdentityGuard,
    RolesGuard,
    { provide: APP_GUARD, useExisting: IdentityGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    PasswordHasher,
    AccessToken,
    RefreshSession,
    RefreshSessionRepository,
    IdentityUser,
    IdentityAudit,
    UserAdministrationService,
    UserAdministrationAuditService,
    UserImportRepository,
    UserImportService,
    {
      provide: UserAdministrationRepository,
      useClass: PrismaUserAdministrationRepository,
    },
  ],
})
export class IdentityModule {}
