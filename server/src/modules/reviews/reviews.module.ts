import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { CoursesModule } from '../courses/courses.module'
import { IdentityModule } from '../identity/identity.module'
import { PrismaModule } from '../../platform/database/prisma.module'
import { ReviewCaseController } from './review-case.controller'
import { StudentReviewDetailController } from './student-review-detail.controller'
import { ReviewCaseCreator } from './review-case.creator'
import { PrismaReviewCaseIntake, ReviewCaseIntake } from './review-case-intake'
import { InstructorReviewQueueController } from './instructor-review-queue.controller'
import {
  InstructorReviewDetailRepository,
  PrismaInstructorReviewDetailRepository,
} from './instructor-review-detail.repository'
import { InstructorReviewDetailService } from './instructor-review-detail.service'
import {
  InstructorReviewActionRepository,
  PrismaInstructorReviewActionRepository,
} from './instructor-review-action.repository'
import { InstructorReviewActionService } from './instructor-review-action.service'
import {
  InstructorReviewQueueRepository,
  PrismaInstructorReviewQueueRepository,
} from './instructor-review-queue.repository'
import { InstructorReviewQueueService } from './instructor-review-queue.service'
import {
  PrismaReviewCaseRepository,
  ReviewCaseRepository,
} from './review-case.repository'
import {
  PrismaStudentReviewDetailRepository,
  StudentReviewDetailRepository,
} from './student-review-detail.repository'
import { StudentReviewDetailService } from './student-review-detail.service'
import { StudentReviewInboxController } from './student-inbox/student-review-inbox.controller'
import { StudentReviewInboxService } from './student-inbox/student-review-inbox.service'
import {
  PrismaStudentReviewInboxRepository,
  StudentReviewInboxRepository,
} from './student-inbox/student-review-inbox.repository'

@Module({
  imports: [AuditModule, CoursesModule, IdentityModule, PrismaModule],
  controllers: [
    ReviewCaseController,
    InstructorReviewQueueController,
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
  ],
  exports: [ReviewCaseCreator, ReviewCaseIntake],
})
export class ReviewsModule {}
