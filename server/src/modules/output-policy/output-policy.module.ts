import { Module } from '@nestjs/common'

import { AutomaticSafetyRiskDetector } from './automatic-safety-risk.detector'
import { ControlledSourceConflictDetector } from './controlled-source-conflict.detector'
import { OutputPolicyService } from './output-policy.service'

@Module({
  providers: [
    AutomaticSafetyRiskDetector,
    ControlledSourceConflictDetector,
    OutputPolicyService,
  ],
  exports: [
    AutomaticSafetyRiskDetector,
    ControlledSourceConflictDetector,
    OutputPolicyService,
  ],
})
export class OutputPolicyModule {}
