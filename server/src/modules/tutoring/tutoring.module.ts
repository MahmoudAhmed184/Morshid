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
import { StudentTutoringPreferencesController } from './preferences/student-tutoring-preferences.controller'
import { StudentTutoringPreferencesService } from './preferences/student-tutoring-preferences.service'

import { AllowancesModule } from '../allowances/allowances.module'
import { StudentTutoringAllowanceController } from './allowance/student-tutoring-allowance.controller'

@Module({
  imports: [
    AuditModule,
    ConversationsModule,
    MaterialsModule,
    PrismaModule,
    ResponseGovernanceModule,
    ReviewsModule,
    SocraticWorkflowModule,
    AllowancesModule,
  ],
  providers: [
    StudentTutoringPreferencesService,
    TutoringRuntimeApplication,
    {
      provide: TutoringRuntime,
      useExisting: TutoringRuntimeApplication,
    },
  ],
  controllers: [
    TutoringController,
    StudentTutoringPreferencesController,
    StudentTutoringAllowanceController,
  ],
  exports: [TutoringRuntime, StudentTutoringPreferencesService],
})
export class TutoringModule {}
