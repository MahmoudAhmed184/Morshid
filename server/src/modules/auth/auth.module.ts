import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { AuditModule } from '../audit/audit.module'
import { PrismaModule } from '../prisma/prisma.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtAccessGuard } from './guards/jwt-access.guard'

@Module({
  imports: [AuditModule, JwtModule.register({}), PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessGuard],
  exports: [AuthService],
})
export class AuthModule {}
