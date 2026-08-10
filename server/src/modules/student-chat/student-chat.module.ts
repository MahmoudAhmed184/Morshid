import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { PdfStorageModule } from '../pdf-storage/pdf-storage.module'
import { RetrievalModule } from '../retrieval/retrieval.module'
import { SocraticTutorModule } from '../socratic-tutor/socratic-tutor.module'
import { SocraticChatOrchestrator } from './socratic-chat.orchestrator'
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
import { GroundedChatService } from './grounded-chat.service'
import { CorrectnessSensitiveRequestClassifier } from './correctness-sensitive-request.classifier'

@Module({
  imports: [
    AuditModule,
    AuthModule,
    PdfStorageModule,
    PrismaModule,
    RetrievalModule,
    SocraticTutorModule,
  ],
  controllers: [StudentChatController],
  providers: [
    StudentChatAuditService,
    StudentChatService,
    StudentChatCourseBoundaryAuditFilter,
    StudentChatMessagePresenter,
    CorrectnessSensitiveRequestClassifier,
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
    GroundedChatService,
    SocraticChatOrchestrator,
  ],
  exports: [StudentChatAuditService, StudentChatService],
})
export class StudentChatModule {}
