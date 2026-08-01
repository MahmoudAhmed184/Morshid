import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { ReviewCaseController } from './review-case.controller'
import { StudentReviewDetailController } from './student-review-detail.controller'
import { ReviewCaseCreator } from './review-case.creator'
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

@Module({
  imports: [AuditModule, AuthModule, PrismaModule],
  controllers: [
    ReviewCaseController,
    InstructorReviewQueueController,
    StudentReviewDetailController,
  ],
  providers: [
    ReviewCaseCreator,
    InstructorReviewQueueService,
    InstructorReviewDetailService,
    InstructorReviewActionService,
    StudentReviewDetailService,
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
  ],
  exports: [ReviewCaseCreator],
})
export class ReviewsModule {}
