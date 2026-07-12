import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'

import { AuditModule } from '../audit/audit.module'
import type { AppEnvironment } from '../config/env.schema'
import { PrismaModule } from '../prisma/prisma.module'
import { AuthController } from './auth.controller'
import { AuthGuard } from './auth.guard'
import { AuthService } from './auth.service'
import { RefreshTokenRepository } from './repositories/refresh-token.repository'
import { RolesGuard } from './roles.guard'
import { AccessTokenService } from './services/access-token.service'
import { AuthAuditService } from './services/auth-audit.service'
import { AuthUserService } from './services/auth-user.service'
import { PasswordHasherService } from './services/password-hasher.service'
import { RefreshTokenService } from './services/refresh-token.service'

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
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    RolesGuard,
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    PasswordHasherService,
    AccessTokenService,
    RefreshTokenService,
    RefreshTokenRepository,
    AuthUserService,
    AuthAuditService,
  ],
  exports: [AuthService, AuthUserService, PasswordHasherService],
})
export class AuthModule {}
