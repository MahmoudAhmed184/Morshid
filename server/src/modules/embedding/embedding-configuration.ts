import {
  MAX_EMBEDDING_INPUT_CODE_POINTS,
  MAX_EMBEDDING_MODEL_LENGTH,
  MAX_EMBEDDING_TITLE_CODE_POINTS,
} from './embedding-provider'

// The single embedding vocabulary surface, mirroring `completion-configuration`:
// nothing outside `embedding/` reaches into `embedding/providers/`, and nothing
// inside `embedding/` imports from `completion/`. Provider-specific constants
// are declared next to their adapters and re-exported here.
export {
  MAX_EMBEDDING_INPUT_CODE_POINTS,
  MAX_EMBEDDING_MODEL_LENGTH,
  MAX_EMBEDDING_TITLE_CODE_POINTS,
}

export const DETERMINISTIC_EMBEDDING_PROVIDER = 'deterministic'

/**
 * Three timeout budgets, because one value cannot serve both callers.
 *
 * An interactive chat turn embeds one query and must fail fast; a PDF ingest
 * embeds hundreds of chunks across many sub-requests and legitimately takes far
 * longer. Collapsing them would either abort ingests that were working or leave
 * a student waiting on a dead provider.
 *
 * `EMBEDDING_REQUEST_TIMEOUT_MS` bounds a single upstream sub-batch and is
 * additionally capped by whatever remains of the whole-call budget, so the
 * final request in a long ingest cannot outlive the ingest's own deadline.
 */
export const DEFAULT_EMBEDDING_QUERY_TIMEOUT_MS = 10_000
export const DEFAULT_EMBEDDING_DOCUMENT_TIMEOUT_MS = 120_000
export const DEFAULT_EMBEDDING_REQUEST_TIMEOUT_MS = 30_000

export const MAX_EMBEDDING_QUERY_TIMEOUT_MS = 60_000
export const MAX_EMBEDDING_DOCUMENT_TIMEOUT_MS = 900_000
export const MAX_EMBEDDING_REQUEST_TIMEOUT_MS = 120_000

export interface EmbeddingTimeouts {
  readonly queryTimeoutMs: number
  readonly documentTimeoutMs: number
  readonly requestTimeoutMs: number
}

/**
 * The configuration the factory dispatches on.
 *
 * A discriminated union rather than a bag of optional fields: selecting a
 * provider must make exactly that provider's configuration required and every
 * other provider's configuration unreachable, so a half-configured live
 * provider cannot be constructed at all.
 */
export interface EmbeddingConfiguration {
  readonly provider: typeof DETERMINISTIC_EMBEDDING_PROVIDER
}

export function isValidEmbeddingTimeouts(
  value: unknown,
): value is EmbeddingTimeouts {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<PropertyKey, unknown>
  return (
    isBoundedTimeout(
      Reflect.get(record, 'queryTimeoutMs'),
      MAX_EMBEDDING_QUERY_TIMEOUT_MS,
    ) &&
    isBoundedTimeout(
      Reflect.get(record, 'documentTimeoutMs'),
      MAX_EMBEDDING_DOCUMENT_TIMEOUT_MS,
    ) &&
    isBoundedTimeout(
      Reflect.get(record, 'requestTimeoutMs'),
      MAX_EMBEDDING_REQUEST_TIMEOUT_MS,
    )
  )
}

function isBoundedTimeout(value: unknown, maxMs: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= maxMs
  )
}
