import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { StudentChatAuditService } from './student-chat.audit.service'

@Module({
  imports: [AuditModule, AuthModule, PrismaModule],
  providers: [StudentChatAuditService],
  exports: [StudentChatAuditService],
})
export class StudentChatModule {}
