import { Injectable } from '@nestjs/common'

import {
  ANALYSIS_MODEL_ERROR_CODE,
  type AnalysisModelErrorCode,
} from './analysis-model.port'

export const ANALYSIS_RETRY_POLICY = Symbol('AnalysisRetryPolicy')

export const DEFAULT_ANALYSIS_MODEL_MAX_RETRIES = 1
export const MAX_ANALYSIS_MODEL_MAX_RETRIES = 2

const RETRYABLE_PROVIDER_ERROR_CODES = new Set<AnalysisModelErrorCode>([
  ANALYSIS_MODEL_ERROR_CODE.TIMEOUT,
  ANALYSIS_MODEL_ERROR_CODE.RATE_LIMITED,
  ANALYSIS_MODEL_ERROR_CODE.TRANSPORT_FAILURE,
  ANALYSIS_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE,
  ANALYSIS_MODEL_ERROR_CODE.MALFORMED_OUTPUT,
  ANALYSIS_MODEL_ERROR_CODE.UNSUPPORTED_RESPONSE,
])

@Injectable()
export class AnalysisRetryPolicy {
  readonly maxRetries: number

  constructor(maxRetries = DEFAULT_ANALYSIS_MODEL_MAX_RETRIES) {
    if (!isValidAnalysisRetryLimit(maxRetries)) {
      throw new TypeError('Invalid analysis retry limit')
    }
    this.maxRetries = maxRetries
  }

  canRetryProviderError(
    errorCode: AnalysisModelErrorCode,
    retriesAlreadyUsed: number,
  ): boolean {
    return (
      retriesAlreadyUsed < this.maxRetries &&
      RETRYABLE_PROVIDER_ERROR_CODES.has(errorCode)
    )
  }

  canRetryInvalidStructuredOutput(retriesAlreadyUsed: number): boolean {
    return retriesAlreadyUsed < this.maxRetries
  }
}

export function isValidAnalysisRetryLimit(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_ANALYSIS_MODEL_MAX_RETRIES
  )
}
