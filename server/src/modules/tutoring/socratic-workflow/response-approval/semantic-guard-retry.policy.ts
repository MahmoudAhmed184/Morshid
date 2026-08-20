import { Injectable } from '@nestjs/common'

import {
  SEMANTIC_GUARD_ERROR_CODE,
  isSemanticGuardModelError,
  type SemanticGuardErrorCode,
} from './semantic-guard.types'

export const SEMANTIC_GUARD_RETRY_POLICY = Symbol('SemanticGuardRetryPolicy')

export const DEFAULT_SEMANTIC_GUARD_MAX_RETRIES = 1
export const MAX_SEMANTIC_GUARD_MAX_RETRIES = 2

const RETRYABLE_GUARD_ERROR_CODES = new Set<SemanticGuardErrorCode>([
  SEMANTIC_GUARD_ERROR_CODE.TIMEOUT,
  SEMANTIC_GUARD_ERROR_CODE.RATE_LIMITED,
  SEMANTIC_GUARD_ERROR_CODE.PROVIDER_UNAVAILABLE,
  SEMANTIC_GUARD_ERROR_CODE.MALFORMED_OUTPUT,
  SEMANTIC_GUARD_ERROR_CODE.UNSUPPORTED_RESPONSE,
  SEMANTIC_GUARD_ERROR_CODE.TRANSPORT_FAILURE,
])

@Injectable()
export class SemanticGuardRetryPolicy {
  readonly maxRetries: number

  constructor(maxRetries = DEFAULT_SEMANTIC_GUARD_MAX_RETRIES) {
    if (!isValidSemanticGuardRetryLimit(maxRetries)) {
      throw new TypeError('Invalid semantic guard retry limit')
    }
    this.maxRetries = maxRetries
  }

  canRetry(error: unknown, retriesAlreadyUsed: number): boolean {
    if (retriesAlreadyUsed >= this.maxRetries) {
      return false
    }

    if (!isSemanticGuardModelError(error)) {
      return true
    }

    return RETRYABLE_GUARD_ERROR_CODES.has(error.code)
  }

  canRetryInvalidStructuredOutput(retriesAlreadyUsed: number): boolean {
    return retriesAlreadyUsed < this.maxRetries
  }
}

export function isValidSemanticGuardRetryLimit(
  value: unknown,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_SEMANTIC_GUARD_MAX_RETRIES
  )
}
