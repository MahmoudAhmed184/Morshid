import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { StudentChatAuditService } from './student-chat.audit.service'
import { StudentChatController } from './student-chat.controller'
import { StudentChatCourseBoundaryAuditFilter } from './student-chat-course-boundary-audit.filter'
import {
  PrismaStudentChatMessageRepository,
  StudentChatMessageRepository,
} from './student-chat-message.repository'
import {
  PrismaStudentChatSessionRepository,
  StudentChatSessionRepository,
} from './student-chat-session.repository'
import { StudentChatService } from './student-chat.service'

@Module({
  imports: [AuditModule, AuthModule, PrismaModule],
  controllers: [StudentChatController],
  providers: [
    StudentChatAuditService,
    StudentChatService,
    StudentChatCourseBoundaryAuditFilter,
    {
      provide: StudentChatSessionRepository,
      useClass: PrismaStudentChatSessionRepository,
    },
    {
      provide: StudentChatMessageRepository,
      useClass: PrismaStudentChatMessageRepository,
    },
  ],
  exports: [StudentChatAuditService, StudentChatService],
})
export class StudentChatModule {}
