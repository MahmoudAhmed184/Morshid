import type { AppEnvironment } from '../config/env.schema'
import { createEmbeddingProvider } from './embedding-provider.factory'
import {
  EMBEDDING_DIMENSIONS,
  EmptyEmbeddingBatchError,
  UnsupportedEmbeddingProviderError,
} from './embedding-provider'

describe('createEmbeddingProvider', () => {
  it('selects the deterministic provider with validation composed', async () => {
    const provider = createEmbeddingProvider('deterministic')

    expect(provider.model).toBe('deterministic-embedding-v1')

    const [vector] = await provider.embedBatch(['course material chunk'])
    expect(vector).toHaveLength(EMBEDDING_DIMENSIONS)

    // Rejecting the empty batch proves the ValidatedEmbeddingProvider wrapper
    // is in place, not just the bare deterministic adapter.
    await expect(provider.embedBatch([])).rejects.toBeInstanceOf(
      EmptyEmbeddingBatchError,
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
