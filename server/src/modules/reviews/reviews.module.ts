import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { ReviewCaseController } from './review-case.controller'
import { ReviewCaseCreator } from './review-case.creator'
import { InstructorReviewQueueController } from './instructor-review-queue.controller'
import {
  InstructorReviewDetailRepository,
  PrismaInstructorReviewDetailRepository,
} from './instructor-review-detail.repository'
import { InstructorReviewDetailService } from './instructor-review-detail.service'
import {
  InstructorReviewQueueRepository,
  PrismaInstructorReviewQueueRepository,
} from './instructor-review-queue.repository'
import { InstructorReviewQueueService } from './instructor-review-queue.service'
import {
  PrismaReviewCaseRepository,
  ReviewCaseRepository,
} from './review-case.repository'

@Module({
  imports: [AuditModule, AuthModule, PrismaModule],
  controllers: [ReviewCaseController, InstructorReviewQueueController],
  providers: [
    ReviewCaseCreator,
    InstructorReviewQueueService,
    InstructorReviewDetailService,
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
  ],
  exports: [ReviewCaseCreator],
})
export class ReviewsModule {}
