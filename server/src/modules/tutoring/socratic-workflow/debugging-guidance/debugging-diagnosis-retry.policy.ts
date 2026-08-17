import {
  DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE,
  DebuggingDiagnosisModelError,
  type DebuggingDiagnosisModelErrorCode,
} from './debugging-diagnosis-model.port'

export const DEBUGGING_DIAGNOSIS_RETRY_POLICY = Symbol(
  'DebuggingDiagnosisRetryPolicy',
)

export const DEFAULT_DEBUGGING_DIAGNOSIS_MODEL_MAX_RETRIES = 1
export const MAX_DEBUGGING_DIAGNOSIS_MODEL_MAX_RETRIES = 2

const RETRYABLE_MODEL_ERROR_CODES = new Set<DebuggingDiagnosisModelErrorCode>([
  DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.TIMEOUT,
  DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.RATE_LIMITED,
  DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.TRANSPORT_FAILURE,
  DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE,
])

export class DebuggingDiagnosisRetryPolicy {
  readonly maxRetries: number

  constructor(maxRetries = 0) {
    if (!isValidDebuggingDiagnosisRetryLimit(maxRetries)) {
      throw new TypeError('Invalid debugging diagnosis retry limit')
    }
    this.maxRetries = maxRetries
  }

  canRetry(error: unknown, retriesAlreadyUsed: number): boolean {
    if (retriesAlreadyUsed >= this.maxRetries) {
      return false
    }

    if (!(error instanceof DebuggingDiagnosisModelError)) {
      return true
    }

    return RETRYABLE_MODEL_ERROR_CODES.has(error.code)
  }
}

export function isValidDebuggingDiagnosisRetryLimit(
  value: unknown,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_DEBUGGING_DIAGNOSIS_MODEL_MAX_RETRIES
  )
}
