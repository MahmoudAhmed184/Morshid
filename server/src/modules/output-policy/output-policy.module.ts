import { Module } from '@nestjs/common'

import { ReviewsModule } from '../reviews/reviews.module'
import { ControlledSourceConflictDetector } from './controlled-source-conflict.detector'
import { OutputPolicyReviewAdapter } from './output-policy-review.adapter'
import { OutputPolicyService } from './output-policy.service'

@Module({
  imports: [ReviewsModule],
  providers: [
    ControlledSourceConflictDetector,
    OutputPolicyService,
    OutputPolicyReviewAdapter,
  ],
  exports: [
    ControlledSourceConflictDetector,
    OutputPolicyService,
    OutputPolicyReviewAdapter,
  ],
})
export class OutputPolicyModule {}
