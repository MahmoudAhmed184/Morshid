import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { CoursesModule } from '../courses/courses.module'
import { IdentityModule } from '../identity/identity.module'
import { PrismaModule } from '../../platform/database/prisma.module'
import { AllowancesModule } from '../allowances/allowances.module'
import { ReviewCaseController } from './intake/review-case.controller'
import { StudentReviewAllowanceController } from './intake/student-review-allowance.controller'
import { StudentReviewDetailController } from './student-detail/student-review-detail.controller'
import { ReviewCaseCreator } from './intake/review-case.creator'
import { PrismaReviewCaseIntake } from './intake/prisma-review-case-intake'
import { ReviewCaseIntake } from './interface/review-case-intake'
import { InstructorReviewQueueController } from './instructor-queue/instructor-review-queue.controller'
import {
  InstructorReviewDetailRepository,
  PrismaInstructorReviewDetailRepository,
} from './instructor-queue/instructor-review-detail.repository'
import { InstructorReviewDetailService } from './instructor-queue/instructor-review-detail.service'
import {
  InstructorReviewActionRepository,
  PrismaInstructorReviewActionRepository,
} from './instructor-resolution/instructor-review-action.repository'
import { InstructorReviewActionService } from './instructor-resolution/instructor-review-action.service'
import { InstructorReviewResolutionController } from './instructor-resolution/instructor-review-resolution.controller'
import {
  InstructorReviewQueueRepository,
  PrismaInstructorReviewQueueRepository,
} from './instructor-queue/instructor-review-queue.repository'
import { InstructorReviewQueueService } from './instructor-queue/instructor-review-queue.service'
import {
  PrismaReviewCaseRepository,
  ReviewCaseRepository,
} from './intake/review-case.repository'
import {
  PrismaStudentReviewDetailRepository,
  StudentReviewDetailRepository,
} from './student-detail/student-review-detail.repository'
import { StudentReviewDetailService } from './student-detail/student-review-detail.service'
import { StudentReviewInboxController } from './student-inbox/student-review-inbox.controller'
import { StudentReviewInboxService } from './student-inbox/student-review-inbox.service'
import {
  PrismaStudentReviewInboxRepository,
  StudentReviewInboxRepository,
} from './student-inbox/student-review-inbox.repository'
import { StudentReviewSummaries } from './interface/student-review-summaries'
import { PrismaStudentReviewSummaries } from './student-detail/prisma-student-review-summaries'

@Module({
  imports: [
    AuditModule,
    CoursesModule,
    IdentityModule,
    PrismaModule,
    AllowancesModule,
  ],
  controllers: [
    ReviewCaseController,
    StudentReviewAllowanceController,
    InstructorReviewQueueController,
    InstructorReviewResolutionController,
    StudentReviewDetailController,
    StudentReviewInboxController,
  ],
  providers: [
    ReviewCaseCreator,
    {
      provide: ReviewCaseIntake,
      useClass: PrismaReviewCaseIntake,
    },
    InstructorReviewQueueService,
    InstructorReviewDetailService,
    InstructorReviewActionService,
    StudentReviewDetailService,
    StudentReviewInboxService,
    {
      provide: ReviewCaseRepository,
      useClass: PrismaReviewCaseRepository,
    },
    {
      provide: InstructorReviewQueueRepository,
      useClass: PrismaInstructorReviewQueueRepository,
    },
    {
      provide: InstructorReviewDetailRepository,
      useClass: PrismaInstructorReviewDetailRepository,
    },
    {
      provide: InstructorReviewActionRepository,
      useClass: PrismaInstructorReviewActionRepository,
    },
    {
      provide: StudentReviewDetailRepository,
      useClass: PrismaStudentReviewDetailRepository,
    },
    {
      provide: StudentReviewInboxRepository,
      useClass: PrismaStudentReviewInboxRepository,
    },
    {
      provide: StudentReviewSummaries,
      useClass: PrismaStudentReviewSummaries,
    },
  ],
  exports: [ReviewCaseIntake, StudentReviewSummaries],
})
export class ReviewsModule {}
