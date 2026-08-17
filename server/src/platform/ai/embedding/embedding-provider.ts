// P0 locks the embedding contract to exactly 1,536 dimensions; the database
// column is `vector(1536)` and changing this requires a migration plus a full
// re-embedding, never a runtime toggle. Materials indexing keeps its own
// private copy of this constant as an intentional consumer-side guard.
export const EMBEDDING_DIMENSIONS = 1_536

// Mirrors material_chunks.embedding_model VARCHAR(120). A profile longer than
// the column could never be persisted, so it is rejected at the port instead of
// surfacing as a database error mid-ingest.
export const MAX_EMBEDDING_MODEL_LENGTH = 120

/**
 * Local payload ceiling for one embedded text.
 *
 * This reduces the likelihood of exceeding a provider's token limit. It is NOT
 * an exact token count and NOT a guard against silent upstream truncation: code
 * points are not tokens, and the ratio varies by script and by tokenizer. Chunk
 * size is properly constrained upstream in `material-text-chunker.ts` (~1,200
 * characters per chunk); this is a backstop against a caller that bypasses it.
 */
export const MAX_EMBEDDING_INPUT_CODE_POINTS = 16_384

// `Material.title` is VARCHAR(180); the ceiling is set above it so a legitimate
// maximum-length title is never rejected, while an arbitrarily long caller-
// supplied title still cannot inflate a request.
export const MAX_EMBEDDING_TITLE_CODE_POINTS = 512

/**
 * One document to embed.
 *
 * `title` is optional because not every caller has one, and blank is not the
 * same as absent: an absent title means "this caller has none" and each adapter
 * substitutes its own placeholder, while a blank supplied title is a caller bug
 * and is rejected. Adapters that fold the title into the embedded text make it
 * part of their document profile, so changing that formatting requires a new
 * profile and a re-embed.
 */
export interface EmbeddingDocument {
  readonly text: string
  readonly title?: string
}

export type Embedding = readonly number[]

export interface EmbeddingRequestOptions {
  readonly signal?: AbortSignal
}

/**
 * The embedding port.
 *
 * Query and document embedding are separate operations rather than one
 * `embedBatch`, because every live model this project targets is asymmetric:
 * the two sides are prefixed differently and land in the same vector space only
 * when each is embedded as what it is. A single batch method cannot express
 * which side it is embedding, so it cannot be implemented correctly by an
 * asymmetric provider at all.
 */
export interface EmbeddingProvider {
  /**
   * The persisted document profile, written to
   * `material_chunks.embedding_model` (VARCHAR(120)) and filtered on at
   * retrieval. It identifies the vector space of *stored documents*: the
   * model, the dimensions, and the document formatting. Changing any of those
   * requires a new profile and a full re-embed, because vectors from two
   * profiles are not comparable even though they have the same dimensions.
   */
  readonly model: string

  /**
   * The query-side protocol, versioned separately from `model`.
   *
   * Google documents the same document format for both retrieval task types —
   * only the query prefix differs — so folding both into one identifier would
   * make a query-task experiment cost a corpus-wide re-embed for no reason.
   * Separating them means a query-protocol change is free.
   *
   * This is DIAGNOSTIC ONLY. `message_retrievals` has no query-protocol column
   * and adding one is out of scope, so this value goes to structured logs and
   * metrics and nowhere else. It is not provenance: you cannot reconstruct
   * which protocol produced an already-stored answer. The trade-off is that a
   * query-protocol change does not trip the stored-profile filter, so the
   * mixing guard cannot detect it — the logged value is what makes such a
   * change observable at all.
   */
  readonly queryProtocol: string

  embedQuery(
    query: string,
    options?: EmbeddingRequestOptions,
  ): Promise<Embedding>

  /** Returns one vector per document, in input order. */
  embedDocuments(
    documents: readonly EmbeddingDocument[],
    options?: EmbeddingRequestOptions,
  ): Promise<readonly Embedding[]>
}

export const EMBEDDING_PROVIDER_TOKEN = Symbol('EmbeddingProvider')

// Error messages carry only counts and indices — never input text, vector
// values, or provider credentials — so they are safe to log verbatim.
export class EmbeddingProviderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmbeddingProviderError'
  }
}

export class EmptyEmbeddingDocumentsError extends EmbeddingProviderError {
  constructor() {
    super('Embedding documents must contain at least one document')
    this.name = 'EmptyEmbeddingDocumentsError'
  }
}

export class BlankEmbeddingQueryError extends EmbeddingProviderError {
  constructor() {
    super('Embedding query must not be empty or whitespace-only')
    this.name = 'BlankEmbeddingQueryError'
  }
}

export class BlankEmbeddingDocumentTextError extends EmbeddingProviderError {
  constructor(readonly documentIndex: number) {
    super(
      `Embedding document text at index ${String(documentIndex)} must not be empty or whitespace-only`,
    )
    this.name = 'BlankEmbeddingDocumentTextError'
  }
}

// A supplied-but-blank title is a caller bug, distinct from an absent one:
// absent means "this caller has no title" and each adapter substitutes its own
// placeholder, so silently accepting blank would hide the difference.
export class BlankEmbeddingTitleError extends EmbeddingProviderError {
  constructor(readonly documentIndex: number) {
    super(
      `Embedding document title at index ${String(documentIndex)} must not be whitespace-only when supplied`,
    )
    this.name = 'BlankEmbeddingTitleError'
  }
}

export class EmbeddingQueryTooLongError extends EmbeddingProviderError {
  constructor() {
    super(
      `Embedding query must contain at most ${String(MAX_EMBEDDING_INPUT_CODE_POINTS)} code points`,
    )
    this.name = 'EmbeddingQueryTooLongError'
  }
}

export class EmbeddingDocumentTooLongError extends EmbeddingProviderError {
  constructor(readonly documentIndex: number) {
    super(
      `Embedding document text at index ${String(documentIndex)} must contain at most ${String(MAX_EMBEDDING_INPUT_CODE_POINTS)} code points`,
    )
    this.name = 'EmbeddingDocumentTooLongError'
  }
}

export class EmbeddingTitleTooLongError extends EmbeddingProviderError {
  constructor(readonly documentIndex: number) {
    super(
      `Embedding document title at index ${String(documentIndex)} must contain at most ${String(MAX_EMBEDDING_TITLE_CODE_POINTS)} code points`,
    )
    this.name = 'EmbeddingTitleTooLongError'
  }
}

export class InvalidEmbeddingModelError extends EmbeddingProviderError {
  constructor(readonly reason: 'blank' | 'too-long') {
    super(
      `Embedding provider model must be non-blank and at most ${String(MAX_EMBEDDING_MODEL_LENGTH)} characters (rejected: ${reason})`,
    )
    this.name = 'InvalidEmbeddingModelError'
  }
}

export type InvalidEmbeddingVectorReason = 'dimension' | 'non-finite' | 'shape'

// The base class exists so one `catch` still sees every malformed vector,
// whichever side produced it.
export class InvalidEmbeddingVectorError extends EmbeddingProviderError {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidEmbeddingVectorError'
  }
}

export class InvalidEmbeddingQueryVectorError extends InvalidEmbeddingVectorError {
  constructor(readonly reason: InvalidEmbeddingVectorReason) {
    super(
      `Embedding query vector must contain exactly ${String(EMBEDDING_DIMENSIONS)} finite numbers (rejected: ${reason})`,
    )
    this.name = 'InvalidEmbeddingQueryVectorError'
  }
}

export class InvalidEmbeddingDocumentVectorError extends InvalidEmbeddingVectorError {
  constructor(
    readonly documentIndex: number,
    readonly reason: InvalidEmbeddingVectorReason,
  ) {
    super(
      `Embedding vector at index ${String(documentIndex)} must contain exactly ${String(EMBEDDING_DIMENSIONS)} finite numbers (rejected: ${reason})`,
    )
    this.name = 'InvalidEmbeddingDocumentVectorError'
  }
}

export class EmbeddingDocumentCountMismatchError extends EmbeddingProviderError {
  constructor(
    readonly expected: number,
    readonly actual: number,
  ) {
    super(
      `Embedding provider returned ${String(actual)} vectors for ${String(expected)} documents`,
    )
    this.name = 'EmbeddingDocumentCountMismatchError'
  }
}

export class UnsupportedEmbeddingProviderError extends EmbeddingProviderError {
  constructor(readonly provider: string) {
    super(`Unsupported embedding provider: ${provider}`)
    this.name = 'UnsupportedEmbeddingProviderError'
  }
}

export class EmbeddingConfigurationError extends EmbeddingProviderError {
  constructor() {
    super('Embedding configuration is invalid')
    this.name = 'EmbeddingConfigurationError'
  }
}

/**
 * The closed vocabulary for anything an upstream provider does to us.
 *
 * Modelled on the TutorModel error boundary: fixed messages, no `cause`. An
 * upstream error is the one place a provider's own text, status body, or
 * credential could leak into a log, so nothing from it is retained beyond the
 * code.
 */
export const EMBEDDING_ERROR_CODES = [
  'EMBEDDING_CONFIGURATION_INVALID',
  'EMBEDDING_INVALID_INPUT',
  'EMBEDDING_PROVIDER_FAILURE',
  'EMBEDDING_RATE_LIMITED',
  'EMBEDDING_TIMEOUT',
  'EMBEDDING_CANCELLED',
] as const

export type EmbeddingErrorCode = (typeof EMBEDDING_ERROR_CODES)[number]

const SAFE_UPSTREAM_MESSAGES = {
  EMBEDDING_CONFIGURATION_INVALID: 'Embedding configuration is invalid',
  EMBEDDING_INVALID_INPUT: 'Embedding request is invalid',
  EMBEDDING_PROVIDER_FAILURE: 'Embedding provider failed',
  EMBEDDING_RATE_LIMITED: 'Embedding provider rate limit reached',
  EMBEDDING_TIMEOUT: 'Embedding timed out',
  EMBEDDING_CANCELLED: 'Embedding was cancelled',
} as const satisfies Record<EmbeddingErrorCode, string>

export class EmbeddingUpstreamError extends EmbeddingProviderError {
  readonly code: EmbeddingErrorCode

  constructor(code: EmbeddingErrorCode) {
    super(SAFE_UPSTREAM_MESSAGES[code])
    Object.defineProperty(this, 'name', {
      configurable: true,
      value: 'EmbeddingUpstreamError',
    })
    this.code = code
  }
}
