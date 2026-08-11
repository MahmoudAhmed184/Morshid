import { Injectable } from '@nestjs/common'

import type { EducationalAnalysisResult } from './educational-analysis.types'

export const ANALYSIS_CONFIDENCE_POLICY = Symbol('AnalysisConfidencePolicy')

export const EDUCATIONAL_ANALYSIS_CONFIDENCE_POLICY_VERSION =
  'educational-analysis-confidence-policy.v1'

// Implementation decision for Phase 2 reliability: model analyses with
// confidence equal to or above 0.6 are accepted; lower confidence uses the
// explicit backend fallback path. The architecture requires a backend-owned
// threshold but intentionally does not prescribe this number.
export const DEFAULT_ANALYSIS_CONFIDENCE_THRESHOLD = 0.6

export interface AnalysisConfidencePolicyOptions {
  readonly threshold: number
}

@Injectable()
export class AnalysisConfidencePolicy {
  readonly version = EDUCATIONAL_ANALYSIS_CONFIDENCE_POLICY_VERSION
  readonly threshold: number

  constructor(
    options: AnalysisConfidencePolicyOptions = {
      threshold: DEFAULT_ANALYSIS_CONFIDENCE_THRESHOLD,
    },
  ) {
    if (!isValidConfidenceThreshold(options.threshold)) {
      throw new TypeError('Invalid analysis confidence threshold')
    }
    this.threshold = options.threshold
  }

  accepts(result: Pick<EducationalAnalysisResult, 'confidence'>): boolean {
    return result.confidence >= this.threshold
  }
}

export function isValidConfidenceThreshold(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  )
}
