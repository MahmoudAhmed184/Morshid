import {
  GeminiQuotaService as SharedGeminiQuotaService,
  type GeminiQuotaCaps,
  type GeminiQuotaDeployment,
  type GeminiQuotaNamespace,
  type GeminiQuotaRedisClient,
} from '../../../../common/gemini/gemini-quota.service'

// The guard itself now lives in `common/gemini`, because embedding meters into
// the same shape and a second copy of the Lua could drift from this one. This
// file stays the completion module's entry point so nothing in `completion/`
// has to know where the implementation moved.
export {
  GEMINI_QUOTA_DIMENSIONS,
  GEMINI_QUOTA_RESERVATION_LUA,
  GEMINI_QUOTA_TOKEN_EPSILON,
  GEMINI_QUOTA_UNAVAILABLE_REASONS,
  GeminiQuotaError,
  GeminiQuotaReservationError,
  GeminiQuotaUnavailableError,
  buildGeminiQuotaReservationArguments,
} from '../../../../common/gemini/gemini-quota.service'
export type {
  GeminiQuotaCaps,
  GeminiQuotaDeployment,
  GeminiQuotaDimension,
  GeminiQuotaNamespace,
  GeminiQuotaRedisClient,
  GeminiQuotaReservationCost,
  GeminiQuotaUnavailableReason,
  GeminiQuotaWriteMode,
} from '../../../../common/gemini/gemini-quota.service'

/**
 * Completion's budget family, pinned to the exact prefix and salt this module
 * has always used.
 *
 * These two strings are load-bearing state, not naming: they determine the
 * Redis key every existing deployment's partially spent day and month windows
 * already live under. Changing either silently retires those windows and hands
 * the deployment a fresh budget, so they are pinned by a digest regression test
 * rather than left to be tidied.
 */
export const GEMINI_COMPLETION_QUOTA_NAMESPACE: GeminiQuotaNamespace =
  Object.freeze({
    keyPrefix: 'morshid:completion:gemini:quota:',
    keySalt: 'morshid:completion:gemini:quota-key:v2',
  })

/**
 * The shared guard bound to completion's namespace.
 *
 * The base class requires a namespace precisely so a new caller cannot inherit
 * someone else's budget by accident; binding it here is what keeps every
 * existing completion call site — and its Redis state — unchanged.
 */
export class GeminiQuotaService extends SharedGeminiQuotaService {
  constructor(
    redis: GeminiQuotaRedisClient,
    caps: GeminiQuotaCaps,
    deployment: GeminiQuotaDeployment | string,
  ) {
    super(redis, caps, deployment, GEMINI_COMPLETION_QUOTA_NAMESPACE)
  }
}
