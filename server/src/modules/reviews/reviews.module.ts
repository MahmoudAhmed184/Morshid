import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { ReviewCaseController } from './review-case.controller'
import { ReviewCaseCreator } from './review-case.creator'
import {
  PrismaReviewCaseRepository,
  ReviewCaseRepository,
} from './review-case.repository'

@Module({
  imports: [AuditModule, AuthModule, PrismaModule],
  controllers: [ReviewCaseController],
  providers: [
    ReviewCaseCreator,
    {
      provide: ReviewCaseRepository,
      useClass: PrismaReviewCaseRepository,
    },
  ],
  exports: [ReviewCaseCreator],
})
export class ReviewsModule {}
