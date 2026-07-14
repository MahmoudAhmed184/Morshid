import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { StudentChatAuditService } from './student-chat.audit.service'
import { StudentChatController } from './student-chat.controller'
import {
  PrismaStudentChatRepository,
  StudentChatRepository,
} from './student-chat.repository'
import { StudentChatService } from './student-chat.service'

@Module({
  imports: [AuditModule, AuthModule, PrismaModule],
  controllers: [StudentChatController],
  providers: [
    StudentChatAuditService,
    StudentChatService,
    {
      provide: StudentChatRepository,
      useClass: PrismaStudentChatRepository,
    },
  ],
  exports: [StudentChatAuditService, StudentChatService],
})
export class StudentChatModule {}
