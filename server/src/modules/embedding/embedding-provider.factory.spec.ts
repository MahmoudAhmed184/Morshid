import type { AppEnvironment } from '../config/env.schema'
import {
  createEmbeddingProvider,
  snapshotEmbeddingConfiguration,
} from './embedding-provider.factory'
import {
  EMBEDDING_DIMENSIONS,
  EmptyEmbeddingDocumentsError,
  UnsupportedEmbeddingProviderError,
} from './embedding-provider'

describe('createEmbeddingProvider', () => {
  it('selects the deterministic provider with validation composed', async () => {
    const provider = createEmbeddingProvider('deterministic')

    expect(provider.model).toBe('deterministic-embedding-v1')

    const [vector] = await provider.embedDocuments([
      { text: 'course material chunk' },
    ])
    expect(vector).toHaveLength(EMBEDDING_DIMENSIONS)

    const queryVector = await provider.embedQuery('course material chunk')
    expect(queryVector).toHaveLength(EMBEDDING_DIMENSIONS)

    // Rejecting the empty document list proves the ValidatedEmbeddingProvider
    // wrapper is in place, not just the bare deterministic adapter.
    await expect(provider.embedDocuments([])).rejects.toBeInstanceOf(
      EmptyEmbeddingDocumentsError,
    )
  })

  it('exposes the query protocol through the wrapper', () => {
    expect(createEmbeddingProvider('deterministic').queryProtocol).toBe(
      'deterministic-embedding-v1',
    )
  })

  it('fails at selection time for an unimplemented provider', () => {
    expect(() =>
      createEmbeddingProvider(
        'unimplemented' as AppEnvironment['EMBEDDING_PROVIDER'],
      ),
    ).toThrow(UnsupportedEmbeddingProviderError)
  })
})

describe('snapshotEmbeddingConfiguration', () => {
  it('returns the deterministic variant', () => {
    expect(
      snapshotEmbeddingConfiguration({ EMBEDDING_PROVIDER: 'deterministic' }),
    ).toEqual({ provider: 'deterministic' })
  })

  it('rejects a provider outside the compile-time enum', () => {
    expect(() =>
      snapshotEmbeddingConfiguration({
        EMBEDDING_PROVIDER:
          'unimplemented' as AppEnvironment['EMBEDDING_PROVIDER'],
      }),
    ).toThrow(UnsupportedEmbeddingProviderError)
  })
})
