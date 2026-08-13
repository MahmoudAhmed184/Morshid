import {
  TUTOR_MODEL_ERROR_CODE,
  TutorModelError,
} from './tutor-generation.types'
import {
  DEFAULT_TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES,
  MAX_TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES,
  TutorInfrastructureRetryPolicy,
} from './tutor-infrastructure-retry.policy'

describe('TutorInfrastructureRetryPolicy', () => {
  it.each([
    TUTOR_MODEL_ERROR_CODE.TIMEOUT,
    TUTOR_MODEL_ERROR_CODE.TRANSPORT_FAILURE,
    TUTOR_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE,
  ])('allows one bounded retry for transient %s errors', (errorCode) => {
    const policy = new TutorInfrastructureRetryPolicy()

    expect(policy.canRetry(new TutorModelError(errorCode), 0)).toBe(true)
    expect(
      policy.canRetry(
        new TutorModelError(errorCode),
        DEFAULT_TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES,
      ),
    ).toBe(false)
  })

  it.each([
    TUTOR_MODEL_ERROR_CODE.RATE_LIMITED,
    TUTOR_MODEL_ERROR_CODE.CANCELLED,
    TUTOR_MODEL_ERROR_CODE.CONFIGURATION_INVALID,
    TUTOR_MODEL_ERROR_CODE.MALFORMED_OUTPUT,
    TUTOR_MODEL_ERROR_CODE.UNSUPPORTED_RESPONSE,
  ])('does not retry non-transient %s errors', (errorCode) => {
    expect(
      new TutorInfrastructureRetryPolicy().canRetry(
        new TutorModelError(errorCode),
        0,
      ),
    ).toBe(false)
  })

  it('treats an unexpected thrown error as a bounded transport failure', () => {
    const policy = new TutorInfrastructureRetryPolicy()

    expect(policy.canRetry(new Error('socket reset'), 0)).toBe(true)
    expect(policy.canRetry(new Error('socket reset'), 1)).toBe(false)
  })

  it.each([-1, MAX_TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES + 1, 0.5])(
    'rejects invalid retry limit %s',
    (maxRetries) => {
      expect(() => new TutorInfrastructureRetryPolicy(maxRetries)).toThrow(
        /Invalid tutor infrastructure retry limit/,
      )
    },
  )
})
