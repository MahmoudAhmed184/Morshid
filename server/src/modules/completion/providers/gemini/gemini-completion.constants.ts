import { MAX_COMPLETION_OUTPUT_CODE_POINTS } from '../../validated-completion.provider'

// The provider name lives in `completion-configuration` with the other two.
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite'
export const GEMINI_API_VERSION = 'v1'
export const MAX_GEMINI_MODEL_ID_LENGTH = 120
export const MAX_GEMINI_API_KEY_LENGTH = 512

// A byte-pair token can cost more than one code point of Arabic script or an
// emoji, so a one-token-per-code-point ceiling would truncate answers the
// result validator would have accepted. Doubling covers that worst case.
const OUTPUT_TOKENS_PER_CODE_POINT = 2

/**
 * The output ceiling sent with every generation.
 *
 * `gemini-3.5-flash-lite` permits 65,536 output tokens
 * (docs/research/gemini-free-tier-quotas-2026-07-23.md) while
 * `ValidatedCompletionProvider` discards any answer above
 * `MAX_COMPLETION_OUTPUT_CODE_POINTS`. Without a ceiling a runaway generation
 * is billed by Google in full and then thrown away here, so the bound is
 * derived from the ceiling the answer actually has to satisfy rather than from
 * the model's capability. It is deliberately a constant and not an environment
 * variable: an operator cannot raise it past the point where the result
 * validator rejects the answer anyway.
 */
export const GEMINI_MAX_OUTPUT_TOKENS =
  MAX_COMPLETION_OUTPUT_CODE_POINTS * OUTPUT_TOKENS_PER_CODE_POINT
