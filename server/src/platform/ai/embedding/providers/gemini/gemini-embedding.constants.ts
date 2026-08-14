import { EMBEDDING_DIMENSIONS } from '../../embedding-provider'

/**
 * The model, pinned in code rather than exposed as an environment variable.
 *
 * `gemini-embedding-2` is GA; `embedding-2-preview` is scheduled to shut down
 * on 2026-08-10. More importantly the model *is* part of the persisted document
 * profile, so an operator who changed it through the environment would silently
 * split the corpus across two vector spaces under one `embedding_model` value.
 * Making it a constant makes that unrepresentable rather than merely validated.
 */
export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-2'

/**
 * The embeddings REST route lives under `v1beta`, and the pinned SDK defaults
 * there. Completion pins `v1`. Neither may be inherited by accident, so both are
 * stated explicitly next to the adapter that sends them.
 */
export const GEMINI_EMBEDDING_API_VERSION = 'v1beta'

/**
 * 1,536 is a recommended MRL rung for this model, and the model
 * **auto-normalizes truncated dimensions** — so no manual L2 normalization is
 * applied here. Re-normalizing an already-normalized vector would be harmless
 * but misleading; normalizing one that was *not* normalized would silently
 * change the metric space. The value is the database column's width, imported
 * rather than restated.
 */
export const GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY = EMBEDDING_DIMENSIONS

/**
 * Inputs per upstream request.
 *
 * A local operational policy, **not** a documented Google maximum. It bounds
 * the blast radius of one failed request and keeps a single response small
 * enough to reason about; raising it is an operational decision that needs a
 * live measurement, not a code comment.
 */
export const GEMINI_EMBEDDING_BATCH_SIZE = 32

/** Upstream requests in flight per `embedDocuments` call. */
export const GEMINI_EMBEDDING_CONCURRENCY = 2

/**
 * The query task, and the version of the query protocol it defines.
 *
 * `taskType` is **unsupported** by this model — Google replaced it with prompt
 * prefixes — so this string is part of the text that gets embedded, not a
 * request field. `question answering` is the selected task; see
 * `docs/gemini-embedding-task-selection.md` for the completed comparison
 * against `search result`.
 */
export const GEMINI_EMBEDDING_QUERY_TASK = 'question answering'

/** Substituted when a caller supplies no title. */
export const GEMINI_EMBEDDING_ABSENT_TITLE = 'none'

/**
 * The persisted document profile.
 *
 * It names everything that determines the stored vector space: provider, model,
 * dimensions, and document formatting version. Changing any of those requires a
 * new value here and a full re-embed.
 */
export const GEMINI_EMBEDDING_DOCUMENT_PROFILE = `gemini/${GEMINI_EMBEDDING_MODEL}/${String(GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY)}/document-v1`

/**
 * The query protocol, versioned separately from the document profile.
 *
 * Both retrieval tasks share one document format, so changing the query task
 * bumps only this string and costs no re-embed.
 */
export const GEMINI_EMBEDDING_QUERY_PROTOCOL = `gemini/${GEMINI_EMBEDDING_MODEL}/question-answering-v1`

/** Redis namespace for the embedding quota budgets. */
export const GEMINI_EMBEDDING_QUOTA_NAMESPACE = Object.freeze({
  keyPrefix: 'morshid:embedding:gemini:quota:',
  keySalt: 'morshid:embedding:gemini:quota-key:v1',
})

export const MAX_GEMINI_EMBEDDING_API_KEY_LENGTH = 512
export const MAX_GEMINI_EMBEDDING_QUOTA_PROJECT_ID_LENGTH = 120

// An opaque deployment label, so it must not look like a credential or carry
// path separators that could confuse a Redis keyspace scan.
const QUOTA_PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,}$/u

export function isValidGeminiEmbeddingQuotaProjectId(
  value: unknown,
): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_GEMINI_EMBEDDING_QUOTA_PROJECT_ID_LENGTH &&
    QUOTA_PROJECT_ID_PATTERN.test(value)
  )
}
