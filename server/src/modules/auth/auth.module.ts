import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'

import { AuditModule } from '../audit/audit.module'
import type { AppEnvironment } from '../config/env.schema'
import { PrismaModule } from '../prisma/prisma.module'
import { RedisModule } from '../redis/redis.module'
import { AuthController } from './auth.controller'
import { AuthGuard } from './auth.guard'
import { AuthService } from './auth.service'
import { ActiveUserGuard } from './guards/active-user.guard'

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    RedisModule,
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
  providers: [AuthService, AuthGuard, ActiveUserGuard],
  exports: [AuthService, AuthGuard, ActiveUserGuard],
})
export class AuthModule {}
