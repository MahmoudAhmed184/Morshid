import {
  ANALYSIS_MODEL_ERROR_CODE,
  type AnalysisModelErrorCode,
} from './analysis-model.port'
import {
  AnalysisRetryPolicy,
  DEFAULT_ANALYSIS_MODEL_MAX_RETRIES,
  MAX_ANALYSIS_MODEL_MAX_RETRIES,
} from './analysis-retry-policy'

describe('AnalysisRetryPolicy', () => {
  it.each([
    ANALYSIS_MODEL_ERROR_CODE.TIMEOUT,
    ANALYSIS_MODEL_ERROR_CODE.TRANSPORT_FAILURE,
    ANALYSIS_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE,
    ANALYSIS_MODEL_ERROR_CODE.RATE_LIMITED,
    ANALYSIS_MODEL_ERROR_CODE.MALFORMED_OUTPUT,
    ANALYSIS_MODEL_ERROR_CODE.UNSUPPORTED_RESPONSE,
  ] satisfies AnalysisModelErrorCode[])(
    'allows one bounded retry for retryable %s errors by default',
    (errorCode) => {
      const policy = new AnalysisRetryPolicy()

      expect(policy.canRetryProviderError(errorCode, 0)).toBe(true)
      expect(
        policy.canRetryProviderError(
          errorCode,
          DEFAULT_ANALYSIS_MODEL_MAX_RETRIES,
        ),
      ).toBe(false)
    },
  )

  it.each([
    ANALYSIS_MODEL_ERROR_CODE.CANCELLED,
    ANALYSIS_MODEL_ERROR_CODE.CONFIGURATION_INVALID,
  ] satisfies AnalysisModelErrorCode[])(
    'does not retry non-retryable %s errors',
    (errorCode) => {
      expect(
        new AnalysisRetryPolicy().canRetryProviderError(errorCode, 0),
      ).toBe(false)
    },
  )

  it('bounds schema-invalid output retries', () => {
    const policy = new AnalysisRetryPolicy(1)

    expect(policy.canRetryInvalidStructuredOutput(0)).toBe(true)
    expect(policy.canRetryInvalidStructuredOutput(1)).toBe(false)
  })

  it.each([-1, MAX_ANALYSIS_MODEL_MAX_RETRIES + 1, 0.5])(
    'rejects invalid retry limit %s',
    (maxRetries) => {
      expect(() => new AnalysisRetryPolicy(maxRetries)).toThrow(
        /Invalid analysis retry limit/,
      )
    },
  )
})
