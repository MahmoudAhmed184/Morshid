import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { PdfStorageModule } from '../pdf-storage/pdf-storage.module'
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
import { StudentChatMessagePresenter } from './student-chat-message.presenter'
import {
  GroundedChatTurnRepository,
  PrismaGroundedChatTurnRepository,
} from './grounded-chat-turn.repository'

@Module({
  imports: [AuditModule, AuthModule, PdfStorageModule, PrismaModule],
  controllers: [StudentChatController],
  providers: [
    StudentChatAuditService,
    StudentChatService,
    StudentChatCourseBoundaryAuditFilter,
    StudentChatMessagePresenter,
    {
      provide: StudentChatSessionRepository,
      useClass: PrismaStudentChatSessionRepository,
    },
    {
      provide: StudentChatMessageRepository,
      useClass: PrismaStudentChatMessageRepository,
    },
    {
      provide: GroundedChatTurnRepository,
      useClass: PrismaGroundedChatTurnRepository,
    },
  ],
  exports: [StudentChatAuditService, StudentChatService],
})
export class StudentChatModule {}
