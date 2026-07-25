import type { AppEnvironment } from '../config/env.schema'
import {
  createEmbeddingProvider,
  snapshotEmbeddingConfiguration,
} from './embedding-provider.factory'
import {
  EMBEDDING_DIMENSIONS,
  EmbeddingConfigurationError,
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

describe('gemini selection', () => {
  const geminiCollaborators = {
    gemini: {
      client: { embedContent: () => Promise.resolve({}) },
      quota: { reserveGeneration: () => Promise.resolve() },
      options: {
        queryTimeoutMs: 10_000,
        documentTimeoutMs: 120_000,
        requestTimeoutMs: 30_000,
      },
    },
  }

  it('builds the gemini adapter with validation composed', () => {
    const provider = createEmbeddingProvider('gemini', geminiCollaborators)

    expect(provider.model).toBe('gemini/gemini-embedding-2/1536/document-v1')
    expect(provider.queryProtocol).toBe(
      'gemini/gemini-embedding-2/search-result-v1',
    )
  })

  // The collaborators are network and Redis objects the composition root owns,
  // so a half-built one must fail at selection time rather than at the first
  // embedding call.
  it('rejects missing gemini collaborators at selection time', () => {
    expect(() => createEmbeddingProvider('gemini')).toThrow(
      EmbeddingConfigurationError,
    )
  })

  it('rejects a malformed gemini client at selection time', () => {
    expect(() =>
      createEmbeddingProvider('gemini', {
        gemini: { ...geminiCollaborators.gemini, client: {} },
      }),
    ).toThrow(EmbeddingConfigurationError)
  })

  // Selecting one provider must never demand another's collaborators.
  it('needs no gemini collaborators while deterministic is selected', () => {
    expect(() => createEmbeddingProvider('deterministic')).not.toThrow()
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
