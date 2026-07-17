import type { EmbeddingProvider } from './embedding-provider'
import {
  BlankEmbeddingTextError,
  EMBEDDING_DIMENSIONS,
  EmbeddingBatchSizeMismatchError,
  EmptyEmbeddingBatchError,
  InvalidEmbeddingVectorError,
} from './embedding-provider'

// Enforces the provider contract around any inner provider so no result can
// reach persistence or query use unvalidated. The factory always composes
// this wrapper, which keeps future live adapters covered without duplicating
// checks inside each implementation.
export class ValidatedEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly inner: EmbeddingProvider) {}

  get model(): string {
    return this.inner.model
  }

  async embedBatch(
    texts: readonly string[],
  ): Promise<readonly (readonly number[])[]> {
    if (texts.length === 0) {
      throw new EmptyEmbeddingBatchError()
    }

    texts.forEach((text, batchIndex) => {
      if (text.trim() === '') {
        throw new BlankEmbeddingTextError(batchIndex)
      }
    })

    const vectors = await this.inner.embedBatch(texts)

    if (vectors.length !== texts.length) {
      throw new EmbeddingBatchSizeMismatchError(texts.length, vectors.length)
    }

    vectors.forEach((vector, batchIndex) => {
      if (vector.length !== EMBEDDING_DIMENSIONS) {
        throw new InvalidEmbeddingVectorError(batchIndex, 'dimension')
      }

      if (!vector.every((component) => Number.isFinite(component))) {
        throw new InvalidEmbeddingVectorError(batchIndex, 'non-finite')
      }
    })

    return vectors
  }
}
