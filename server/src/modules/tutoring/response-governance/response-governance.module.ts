import { Module } from '@nestjs/common'

import { AutomaticSafetyRiskDetector } from './automatic-safety-risk.detector'
import { ControlledSourceConflictDetector } from './controlled-source-conflict.detector'
import { CorrectnessSensitiveRequestClassifier } from './correctness-sensitive-request.classifier'
import { ResponseGovernance } from './response-governance'

@Module({
  providers: [
    AutomaticSafetyRiskDetector,
    ControlledSourceConflictDetector,
    CorrectnessSensitiveRequestClassifier,
    ResponseGovernance,
  ],
  exports: [
    AutomaticSafetyRiskDetector,
    ControlledSourceConflictDetector,
    CorrectnessSensitiveRequestClassifier,
    ResponseGovernance,
  ],
})
export class ResponseGovernanceModule {}
