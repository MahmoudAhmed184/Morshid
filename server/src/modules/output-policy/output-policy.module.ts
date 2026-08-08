import { Module } from '@nestjs/common'

import { ReviewsModule } from '../reviews/reviews.module'
import { AutomaticSafetyRiskDetector } from './automatic-safety-risk.detector'
import { ControlledSourceConflictDetector } from './controlled-source-conflict.detector'
import { OutputPolicyReviewAdapter } from './output-policy-review.adapter'
import { OutputPolicyService } from './output-policy.service'

@Module({
  imports: [ReviewsModule],
  providers: [
    AutomaticSafetyRiskDetector,
    ControlledSourceConflictDetector,
    OutputPolicyService,
    OutputPolicyReviewAdapter,
  ],
  exports: [
    AutomaticSafetyRiskDetector,
    ControlledSourceConflictDetector,
    OutputPolicyService,
    OutputPolicyReviewAdapter,
  ],
})
export class OutputPolicyModule {}
