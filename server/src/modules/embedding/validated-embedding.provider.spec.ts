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
  InvalidEmbeddingVectorError,
  MAX_EMBEDDING_INPUT_CODE_POINTS,
  MAX_EMBEDDING_MODEL_LENGTH,
  MAX_EMBEDDING_TITLE_CODE_POINTS,
} from './embedding-provider'
import { ValidatedEmbeddingProvider } from './validated-embedding.provider'

function buildVector(fill = 0.5): number[] {
  return new Array<number>(EMBEDDING_DIMENSIONS).fill(fill)
}

interface StubOverrides {
  model?: string
  queryProtocol?: string
  queryVector?: unknown
  documentVectors?: unknown
}

function buildStub(overrides: StubOverrides = {}) {
  const embedQuery = jest.fn(() =>
    Promise.resolve((overrides.queryVector ?? buildVector()) as Embedding),
  )
  const embedDocuments = jest.fn((documents: readonly EmbeddingDocument[]) =>
    Promise.resolve(
      (overrides.documentVectors ??
        documents.map(() => buildVector())) as readonly Embedding[],
    ),
  )
  const inner = {
    model: overrides.model ?? 'stub-embedding-v1',
    queryProtocol: overrides.queryProtocol ?? 'stub-embedding/query-v1',
    embedQuery,
    embedDocuments,
  } as unknown as EmbeddingProvider

  return { inner, embedQuery, embedDocuments }
}

describe('ValidatedEmbeddingProvider', () => {
  describe('model validation', () => {
    it.each(['', '   '])('rejects blank model %j at construction', (model) => {
      expect(
        () => new ValidatedEmbeddingProvider(buildStub({ model }).inner),
      ).toThrow(InvalidEmbeddingModelError)
    })

    it('rejects a model longer than the persisted column', () => {
      expect(
        () =>
          new ValidatedEmbeddingProvider(
            buildStub({ model: 'x'.repeat(MAX_EMBEDDING_MODEL_LENGTH + 1) })
              .inner,
          ),
      ).toThrow(InvalidEmbeddingModelError)
    })

    it('accepts a model of exactly the maximum length', () => {
      const model = 'x'.repeat(MAX_EMBEDDING_MODEL_LENGTH)

      expect(
        new ValidatedEmbeddingProvider(buildStub({ model }).inner).model,
      ).toBe(model)
    })

    // A getter delegating to `inner.model` would validate one string and
    // persist another if the inner provider mutated it afterwards.
    it('keeps reporting the value validated at construction', () => {
      const stub = buildStub()
      const provider = new ValidatedEmbeddingProvider(stub.inner)

      const mutable = stub.inner as { model: string }
      mutable.model = ''

      expect(provider.model).toBe('stub-embedding-v1')
    })

    it('passes the query protocol through unvalidated', () => {
      const provider = new ValidatedEmbeddingProvider(
        buildStub({ queryProtocol: 'stub/search-result-v1' }).inner,
      )

      expect(provider.queryProtocol).toBe('stub/search-result-v1')
    })
  })

  describe('embedQuery', () => {
    it('returns the inner vector for a valid query', async () => {
      const stub = buildStub()
      const provider = new ValidatedEmbeddingProvider(stub.inner)

      await expect(provider.embedQuery('what is a variable?')).resolves.toEqual(
        buildVector(),
      )
      expect(stub.embedQuery).toHaveBeenCalledWith('what is a variable?')
    })

    it.each(['', '   ', '\n\t'])(
      'rejects blank query %j without calling inner',
      async (query) => {
        const stub = buildStub()
        const provider = new ValidatedEmbeddingProvider(stub.inner)

        await expect(provider.embedQuery(query)).rejects.toBeInstanceOf(
          BlankEmbeddingQueryError,
        )
        expect(stub.embedQuery).not.toHaveBeenCalled()
      },
    )

    it('rejects an over-length query without calling inner', async () => {
      const stub = buildStub()
      const provider = new ValidatedEmbeddingProvider(stub.inner)

      await expect(
        provider.embedQuery('x'.repeat(MAX_EMBEDDING_INPUT_CODE_POINTS + 1)),
      ).rejects.toBeInstanceOf(EmbeddingQueryTooLongError)
      expect(stub.embedQuery).not.toHaveBeenCalled()
    })

    it('accepts a query of exactly the maximum length', async () => {
      const provider = new ValidatedEmbeddingProvider(buildStub().inner)

      await expect(
        provider.embedQuery('x'.repeat(MAX_EMBEDDING_INPUT_CODE_POINTS)),
      ).resolves.toHaveLength(EMBEDDING_DIMENSIONS)
    })

    // Code points, not UTF-16 units: a surrogate pair is one character to a
    // provider and must not count double against the ceiling.
    it('counts a surrogate pair as one code point', async () => {
      const provider = new ValidatedEmbeddingProvider(buildStub().inner)

      await expect(
        provider.embedQuery('😀'.repeat(MAX_EMBEDDING_INPUT_CODE_POINTS)),
      ).resolves.toHaveLength(EMBEDDING_DIMENSIONS)
    })

    it('rejects a non-array query result', async () => {
      const provider = new ValidatedEmbeddingProvider(
        buildStub({ queryVector: 'not a vector' }).inner,
      )

      await expect(provider.embedQuery('query')).rejects.toBeInstanceOf(
        InvalidEmbeddingQueryVectorError,
      )
    })

    it('rejects a query vector with the wrong dimension', async () => {
      const provider = new ValidatedEmbeddingProvider(
        buildStub({ queryVector: buildVector().slice(0, 1_535) }).inner,
      )

      await expect(provider.embedQuery('query')).rejects.toMatchObject({
        reason: 'dimension',
      })
    })

    it('rejects a query vector with a non-finite component', async () => {
      const vector = buildVector()
      vector[7] = Number.NaN
      const provider = new ValidatedEmbeddingProvider(
        buildStub({ queryVector: vector }).inner,
      )

      await expect(provider.embedQuery('query')).rejects.toMatchObject({
        reason: 'non-finite',
      })
    })
  })

  describe('embedDocuments', () => {
    it('returns one vector per document in order', async () => {
      const stub = buildStub()
      const provider = new ValidatedEmbeddingProvider(stub.inner)

      const documents = [{ text: 'first' }, { text: 'second', title: 'Week 1' }]

      await expect(provider.embedDocuments(documents)).resolves.toHaveLength(2)
      expect(stub.embedDocuments).toHaveBeenCalledWith(documents)
    })

    it('rejects an empty document list without calling inner', async () => {
      const stub = buildStub()
      const provider = new ValidatedEmbeddingProvider(stub.inner)

      await expect(provider.embedDocuments([])).rejects.toBeInstanceOf(
        EmptyEmbeddingDocumentsError,
      )
      expect(stub.embedDocuments).not.toHaveBeenCalled()
    })

    it.each(['', '   ', '\n'])(
      'rejects blank document text %j at its index',
      async (text) => {
        const stub = buildStub()
        const provider = new ValidatedEmbeddingProvider(stub.inner)

        await expect(
          provider.embedDocuments([{ text: 'fine' }, { text }]),
        ).rejects.toMatchObject({ documentIndex: 1 })
        expect(stub.embedDocuments).not.toHaveBeenCalled()
      },
    )

    it('rejects blank document text with the document-specific error', async () => {
      const provider = new ValidatedEmbeddingProvider(buildStub().inner)

      await expect(
        provider.embedDocuments([{ text: '  ' }]),
      ).rejects.toBeInstanceOf(BlankEmbeddingDocumentTextError)
    })

    it('rejects over-length document text without calling inner', async () => {
      const stub = buildStub()
      const provider = new ValidatedEmbeddingProvider(stub.inner)

      await expect(
        provider.embedDocuments([
          { text: 'x'.repeat(MAX_EMBEDDING_INPUT_CODE_POINTS + 1) },
        ]),
      ).rejects.toBeInstanceOf(EmbeddingDocumentTooLongError)
      expect(stub.embedDocuments).not.toHaveBeenCalled()
    })

    // undefined title -> the adapter substitutes its placeholder; supplied
    // blank title -> caller bug. Accepting blank would erase that distinction.
    it('accepts an absent title', async () => {
      const provider = new ValidatedEmbeddingProvider(buildStub().inner)

      await expect(
        provider.embedDocuments([{ text: 'chunk' }]),
      ).resolves.toHaveLength(1)
    })

    it.each(['', '   ', '\t'])(
      'rejects supplied blank title %j',
      async (title) => {
        const stub = buildStub()
        const provider = new ValidatedEmbeddingProvider(stub.inner)

        await expect(
          provider.embedDocuments([{ text: 'chunk', title }]),
        ).rejects.toBeInstanceOf(BlankEmbeddingTitleError)
        expect(stub.embedDocuments).not.toHaveBeenCalled()
      },
    )

    it('rejects an over-length title without calling inner', async () => {
      const stub = buildStub()
      const provider = new ValidatedEmbeddingProvider(stub.inner)

      await expect(
        provider.embedDocuments([
          {
            text: 'chunk',
            title: 'x'.repeat(MAX_EMBEDDING_TITLE_CODE_POINTS + 1),
          },
        ]),
      ).rejects.toBeInstanceOf(EmbeddingTitleTooLongError)
      expect(stub.embedDocuments).not.toHaveBeenCalled()
    })

    it('accepts a title of exactly the maximum length', async () => {
      const provider = new ValidatedEmbeddingProvider(buildStub().inner)

      await expect(
        provider.embedDocuments([
          { text: 'chunk', title: 'x'.repeat(MAX_EMBEDDING_TITLE_CODE_POINTS) },
        ]),
      ).resolves.toHaveLength(1)
    })

    // One invalid item must cost nothing upstream, whatever its position.
    it('checks every document before calling inner', async () => {
      const stub = buildStub()
      const provider = new ValidatedEmbeddingProvider(stub.inner)

      await expect(
        provider.embedDocuments([
          { text: 'fine' },
          { text: 'also fine' },
          { text: 'still fine', title: '   ' },
        ]),
      ).rejects.toMatchObject({ documentIndex: 2 })
      expect(stub.embedDocuments).not.toHaveBeenCalled()
    })

    it('rejects a cardinality mismatch', async () => {
      const provider = new ValidatedEmbeddingProvider(
        buildStub({ documentVectors: [buildVector()] }).inner,
      )

      await expect(
        provider.embedDocuments([{ text: 'a' }, { text: 'b' }]),
      ).rejects.toBeInstanceOf(EmbeddingDocumentCountMismatchError)
    })

    it('rejects a non-array result', async () => {
      const provider = new ValidatedEmbeddingProvider(
        buildStub({ documentVectors: 'not an array' }).inner,
      )

      await expect(
        provider.embedDocuments([{ text: 'a' }]),
      ).rejects.toBeInstanceOf(InvalidEmbeddingDocumentVectorError)
    })

    it('rejects a document vector with the wrong dimension at its index', async () => {
      const provider = new ValidatedEmbeddingProvider(
        buildStub({
          documentVectors: [buildVector(), buildVector().slice(0, 10)],
        }).inner,
      )

      await expect(
        provider.embedDocuments([{ text: 'a' }, { text: 'b' }]),
      ).rejects.toMatchObject({ documentIndex: 1, reason: 'dimension' })
    })

    it('rejects a document vector with a non-finite component', async () => {
      const vector = buildVector()
      vector[3] = Number.POSITIVE_INFINITY
      const provider = new ValidatedEmbeddingProvider(
        buildStub({ documentVectors: [vector] }).inner,
      )

      await expect(
        provider.embedDocuments([{ text: 'a' }]),
      ).rejects.toMatchObject({ documentIndex: 0, reason: 'non-finite' })
    })
  })

  // One `catch (error) { if (error instanceof InvalidEmbeddingVectorError) }`
  // must still see a malformed vector from either side.
  it('reports both sides under one vector-error supertype', async () => {
    const queryProvider = new ValidatedEmbeddingProvider(
      buildStub({ queryVector: [] }).inner,
    )
    const documentProvider = new ValidatedEmbeddingProvider(
      buildStub({ documentVectors: [[]] }).inner,
    )

    await expect(queryProvider.embedQuery('q')).rejects.toBeInstanceOf(
      InvalidEmbeddingVectorError,
    )
    await expect(
      documentProvider.embedDocuments([{ text: 'd' }]),
    ).rejects.toBeInstanceOf(InvalidEmbeddingVectorError)
  })

  it('propagates an inner failure unchanged by identity', async () => {
    const failure = new Error('inner provider exploded')
    const stub = buildStub()
    stub.embedQuery.mockRejectedValue(failure)
    const provider = new ValidatedEmbeddingProvider(stub.inner)

    await expect(provider.embedQuery('query')).rejects.toBe(failure)
  })
})
