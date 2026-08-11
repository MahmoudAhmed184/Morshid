import type {
  Embedding,
  EmbeddingDocument,
  EmbeddingProvider,
} from './embedding-provider'
import {
  BlankEmbeddingDocumentTextError,
  BlankEmbeddingQueryError,
  BlankEmbeddingTitleError,
  EMBEDDING_DIMENSIONS,
  EmbeddingDocumentCountMismatchError,
  EmbeddingDocumentTooLongError,
  EmbeddingQueryTooLongError,
  EmbeddingTitleTooLongError,
  EmptyEmbeddingDocumentsError,
  InvalidEmbeddingDocumentVectorError,
  InvalidEmbeddingModelError,
  InvalidEmbeddingQueryVectorError,
  type InvalidEmbeddingVectorReason,
  MAX_EMBEDDING_INPUT_CODE_POINTS,
  MAX_EMBEDDING_MODEL_LENGTH,
  MAX_EMBEDDING_TITLE_CODE_POINTS,
  type EmbeddingRequestOptions,
} from './embedding-provider'

// Enforces the provider contract around any inner provider so no result can
// reach persistence or query use unvalidated, and no invalid input reaches a
// billable upstream call. The factory always composes this wrapper, which keeps
// live adapters covered without duplicating checks inside each implementation.
export class ValidatedEmbeddingProvider implements EmbeddingProvider {
  // Validated once, at construction, and stored. Returning `inner.model`
  // through a getter would validate a value that the inner provider is then
  // free to change, so what was checked and what gets persisted would be two
  // different strings.
  private readonly validatedModel: string

  constructor(private readonly inner: EmbeddingProvider) {
    this.validatedModel = validateEmbeddingModel(inner.model)
  }

  get model(): string {
    return this.validatedModel
  }

  get queryProtocol(): string {
    return this.inner.queryProtocol
  }

  async embedQuery(
    query: string,
    options?: EmbeddingRequestOptions,
  ): Promise<Embedding> {
    if (query.trim() === '') {
      throw new BlankEmbeddingQueryError()
    }
    if (!hasAtMostCodePoints(query, MAX_EMBEDDING_INPUT_CODE_POINTS)) {
      throw new EmbeddingQueryTooLongError()
    }

    const vector =
      options === undefined
        ? await this.inner.embedQuery(query)
        : await this.inner.embedQuery(query, options)

    const reason = readVectorRejection(vector)
    if (reason !== undefined) {
      throw new InvalidEmbeddingQueryVectorError(reason)
    }

    return vector
  }

  async embedDocuments(
    documents: readonly EmbeddingDocument[],
    options?: EmbeddingRequestOptions,
  ): Promise<readonly Embedding[]> {
    if (documents.length === 0) {
      throw new EmptyEmbeddingDocumentsError()
    }

    // Every document is checked before the inner provider is called at all, so
    // one malformed item in a batch cannot cost a partial upstream request.
    documents.forEach((document, documentIndex) => {
      if (document.text.trim() === '') {
        throw new BlankEmbeddingDocumentTextError(documentIndex)
      }
      if (
        !hasAtMostCodePoints(document.text, MAX_EMBEDDING_INPUT_CODE_POINTS)
      ) {
        throw new EmbeddingDocumentTooLongError(documentIndex)
      }
      if (document.title === undefined) {
        return
      }
      if (document.title.trim() === '') {
        throw new BlankEmbeddingTitleError(documentIndex)
      }
      if (
        !hasAtMostCodePoints(document.title, MAX_EMBEDDING_TITLE_CODE_POINTS)
      ) {
        throw new EmbeddingTitleTooLongError(documentIndex)
      }
    })

    const vectors =
      options === undefined
        ? await this.inner.embedDocuments(documents)
        : await this.inner.embedDocuments(documents, options)

    if (!isArray(vectors)) {
      throw new InvalidEmbeddingDocumentVectorError(0, 'shape')
    }
    if (vectors.length !== documents.length) {
      throw new EmbeddingDocumentCountMismatchError(
        documents.length,
        vectors.length,
      )
    }

    vectors.forEach((vector, documentIndex) => {
      const reason = readVectorRejection(vector)
      if (reason !== undefined) {
        throw new InvalidEmbeddingDocumentVectorError(documentIndex, reason)
      }
    })

    return vectors
  }
}

export function validateEmbeddingModel(model: string): string {
  if (model.trim() === '') {
    throw new InvalidEmbeddingModelError('blank')
  }
  if (model.length > MAX_EMBEDDING_MODEL_LENGTH) {
    throw new InvalidEmbeddingModelError('too-long')
  }
  return model
}

// Deliberately returns a plain boolean: narrowing `readonly Embedding[]` through
// `Array.isArray` widens it to `any[]` and would erase the element type from
// everything downstream.
function isArray(value: unknown): boolean {
  return Array.isArray(value)
}

// Returns why the vector is unusable, or undefined when it is fine. Shape is
// checked before dimension because a non-array has no length to compare.
function readVectorRejection(
  vector: unknown,
): InvalidEmbeddingVectorReason | undefined {
  if (!Array.isArray(vector)) {
    return 'shape'
  }
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    return 'dimension'
  }
  if (!vector.every((component) => Number.isFinite(component))) {
    return 'non-finite'
  }
  return undefined
}

// Code points, not UTF-16 units: a surrogate pair is one character to a
// provider and must not count double against the ceiling.
function hasAtMostCodePoints(value: string, maxCodePoints: number): boolean {
  let count = 0
  for (const _ of value) {
    count += 1
    if (count > maxCodePoints) {
      return false
    }
  }
  return true
}
