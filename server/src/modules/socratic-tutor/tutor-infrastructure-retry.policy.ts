import { Injectable } from '@nestjs/common'

import {
  TUTOR_MODEL_ERROR_CODE,
  TutorModelError,
  type TutorModelErrorCode,
} from './tutor-generation.types'

export const TUTOR_INFRASTRUCTURE_RETRY_POLICY = Symbol(
  'TutorInfrastructureRetryPolicy',
)

export const DEFAULT_TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES = 1
export const MAX_TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES = 2

const RETRYABLE_MODEL_ERROR_CODES = new Set<TutorModelErrorCode>([
  TUTOR_MODEL_ERROR_CODE.TIMEOUT,
  TUTOR_MODEL_ERROR_CODE.TRANSPORT_FAILURE,
  TUTOR_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE,
])

@Injectable()
export class TutorInfrastructureRetryPolicy {
  readonly maxRetries: number

  constructor(maxRetries = DEFAULT_TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES) {
    if (!isValidTutorInfrastructureRetryLimit(maxRetries)) {
      throw new TypeError('Invalid tutor infrastructure retry limit')
    }
    this.maxRetries = maxRetries
  }

  canRetry(error: unknown, retriesAlreadyUsed: number): boolean {
    if (retriesAlreadyUsed >= this.maxRetries) {
      return false
    }

    if (!(error instanceof TutorModelError)) {
      return true
    }

    return RETRYABLE_MODEL_ERROR_CODES.has(error.code)
  }
}

export function isValidTutorInfrastructureRetryLimit(
  value: unknown,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES
  )
}
