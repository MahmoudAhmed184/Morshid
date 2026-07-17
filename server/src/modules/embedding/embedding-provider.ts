// P0 locks the embedding contract to exactly 1,536 dimensions; the database
// column is `vector(1536)` and changing this requires a migration plus a full
// re-embedding, never a runtime toggle. `rag-persistence` keeps its own
// private copy of this constant as an intentional consumer-side guard.
export const EMBEDDING_DIMENSIONS = 1_536

export interface EmbeddingProvider {
  // Stable identifier persisted into material_chunks.embedding_model
  // (VARCHAR(120)) and used for observability. Implementations must bump it
  // whenever their vector algorithm changes so stored vectors are never mixed
  // across algorithms.
  readonly model: string

  // Returns one vector per input text, in input order. Callers must go
  // through the factory-provided token so results are always validated.
  embedBatch(texts: readonly string[]): Promise<readonly (readonly number[])[]>
}

export const EMBEDDING_PROVIDER = Symbol('EmbeddingProvider')

// Error messages carry only counts and indices — never input text, vector
// values, or provider credentials — so they are safe to log verbatim.
export class EmbeddingProviderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmbeddingProviderError'
  }
}

export class EmptyEmbeddingBatchError extends EmbeddingProviderError {
  constructor() {
    super('Embedding batch must contain at least one text')
    this.name = 'EmptyEmbeddingBatchError'
  }
}

export class BlankEmbeddingTextError extends EmbeddingProviderError {
  constructor(readonly batchIndex: number) {
    super(
      `Embedding batch text at index ${String(batchIndex)} must not be empty or whitespace-only`,
    )
    this.name = 'BlankEmbeddingTextError'
  }
}

export class InvalidEmbeddingVectorError extends EmbeddingProviderError {
  constructor(
    readonly batchIndex: number,
    readonly reason: 'dimension' | 'non-finite',
  ) {
    super(
      `Embedding vector at index ${String(batchIndex)} must contain exactly ${String(EMBEDDING_DIMENSIONS)} finite numbers (rejected: ${reason})`,
    )
    this.name = 'InvalidEmbeddingVectorError'
  }
}

export class EmbeddingBatchSizeMismatchError extends EmbeddingProviderError {
  constructor(
    readonly expected: number,
    readonly actual: number,
  ) {
    super(
      `Embedding provider returned ${String(actual)} vectors for ${String(expected)} texts`,
    )
    this.name = 'EmbeddingBatchSizeMismatchError'
  }
}

export class UnsupportedEmbeddingProviderError extends EmbeddingProviderError {
  constructor(readonly provider: string) {
    super(`Unsupported embedding provider: ${provider}`)
    this.name = 'UnsupportedEmbeddingProviderError'
  }
}
