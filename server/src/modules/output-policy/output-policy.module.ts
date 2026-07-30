import { Module } from '@nestjs/common'

import { ReviewsModule } from '../reviews/reviews.module'
import { OutputPolicyReviewAdapter } from './output-policy-review.adapter'
import { OutputPolicyService } from './output-policy.service'

@Module({
  imports: [ReviewsModule],
  providers: [OutputPolicyService, OutputPolicyReviewAdapter],
  exports: [OutputPolicyService, OutputPolicyReviewAdapter],
})
export class OutputPolicyModule {}
