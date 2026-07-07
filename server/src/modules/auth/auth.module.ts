import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { AuditModule } from '../audit/audit.module'
import { PrismaModule } from '../prisma/prisma.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

@Module({
  imports: [AuditModule, JwtModule.register({}), PrismaModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
