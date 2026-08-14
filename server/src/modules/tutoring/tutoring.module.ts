import { Module } from '@nestjs/common'

import { ConversationsModule } from '../conversations/conversations.module'
import { PrismaModule } from '../../platform/database/prisma.module'
import { ReviewsModule } from '../reviews/reviews.module'
import { AuditModule } from '../audit/audit.module'
import { MaterialsModule } from '../materials/materials.module'
import { ResponseGovernanceModule } from './response-governance/response-governance.module'
import { SocraticWorkflowModule } from './socratic-workflow/socratic-workflow.module'
import { TutoringRuntime } from './interface/tutoring-runtime'
import { TutoringRuntimeApplication } from './tutoring-runtime.application'
import { TutoringController } from './tutoring.controller'

@Module({
  imports: [
    AuditModule,
    ConversationsModule,
    MaterialsModule,
    PrismaModule,
    ResponseGovernanceModule,
    ReviewsModule,
    SocraticWorkflowModule,
  ],
  providers: [
    TutoringRuntimeApplication,
    {
      provide: TutoringRuntime,
      useExisting: TutoringRuntimeApplication,
    },
  ],
  controllers: [TutoringController],
  exports: [TutoringRuntime],
})
export class TutoringModule {}
