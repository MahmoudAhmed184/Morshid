import {
  DEFAULT_SEMANTIC_GUARD_MAX_RETRIES,
  MAX_SEMANTIC_GUARD_MAX_RETRIES,
  SemanticGuardRetryPolicy,
  isValidSemanticGuardRetryLimit,
} from './semantic-guard-retry.policy'
import {
  SEMANTIC_GUARD_ERROR_CODE,
  SemanticGuardModelError,
} from './semantic-guard.types'

describe('SemanticGuardRetryPolicy', () => {
  it('allows bounded retry for retryable model errors within limit', () => {
    const policy = new SemanticGuardRetryPolicy()

    expect(
      policy.canRetry(
        new SemanticGuardModelError(
          SEMANTIC_GUARD_ERROR_CODE.MALFORMED_OUTPUT,
          {
            finishReason: 'length',
          },
        ),
        0,
      ),
    ).toBe(true)

    expect(
      policy.canRetry(
        new SemanticGuardModelError(SEMANTIC_GUARD_ERROR_CODE.TIMEOUT),
        0,
      ),
    ).toBe(true)

    expect(
      policy.canRetry(
        new SemanticGuardModelError(SEMANTIC_GUARD_ERROR_CODE.RATE_LIMITED),
        0,
      ),
    ).toBe(true)

    expect(
      policy.canRetry(
        new SemanticGuardModelError(
          SEMANTIC_GUARD_ERROR_CODE.PROVIDER_UNAVAILABLE,
        ),
        0,
      ),
    ).toBe(true)

    expect(
      policy.canRetry(
        new SemanticGuardModelError(
          SEMANTIC_GUARD_ERROR_CODE.TRANSPORT_FAILURE,
        ),
        0,
      ),
    ).toBe(true)
  })

  it('rejects retries when retry count reaches maxRetries', () => {
    const policy = new SemanticGuardRetryPolicy(1)

    expect(
      policy.canRetry(
        new SemanticGuardModelError(
          SEMANTIC_GUARD_ERROR_CODE.MALFORMED_OUTPUT,
          {
            finishReason: 'length',
          },
        ),
        1,
      ),
    ).toBe(false)

    expect(policy.canRetryInvalidStructuredOutput(1)).toBe(false)
  })

  it('disallows non-retryable errors like CANCELLED', () => {
    const policy = new SemanticGuardRetryPolicy()

    expect(
      policy.canRetry(
        new SemanticGuardModelError(SEMANTIC_GUARD_ERROR_CODE.CANCELLED),
        0,
      ),
    ).toBe(false)
  })

  it('validates retry limits strictly', () => {
    expect(isValidSemanticGuardRetryLimit(0)).toBe(true)
    expect(
      isValidSemanticGuardRetryLimit(DEFAULT_SEMANTIC_GUARD_MAX_RETRIES),
    ).toBe(true)
    expect(isValidSemanticGuardRetryLimit(MAX_SEMANTIC_GUARD_MAX_RETRIES)).toBe(
      true,
    )
    expect(isValidSemanticGuardRetryLimit(-1)).toBe(false)
    expect(isValidSemanticGuardRetryLimit(3)).toBe(false)
    expect(isValidSemanticGuardRetryLimit('1')).toBe(false)

    expect(() => new SemanticGuardRetryPolicy(3)).toThrow(
      /Invalid semantic guard retry limit/,
    )
  })
})
