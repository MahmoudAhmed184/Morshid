import type { EmbeddingProvider } from '../embedding/embedding-provider'
import { MaterialChunkEmbeddingService } from './material-chunk-embedding.service'
import type { RagPersistenceRepository } from './rag-persistence.repository'

describe('MaterialChunkEmbeddingService', () => {
  const materialId = '4b8d0d5e-9c3a-4f9e-8b21-2f6a1d9c7e10'

  let embedBatch: jest.Mock
  let replaceMaterialChunks: jest.Mock
  let service: MaterialChunkEmbeddingService

  beforeEach(() => {
    embedBatch = jest.fn()
    replaceMaterialChunks = jest.fn().mockResolvedValue(undefined)

    const embeddingProvider = {
      model: 'test-embedding-model',
      embedBatch,
    } as unknown as EmbeddingProvider
    const repository = {
      replaceMaterialChunks,
    } as unknown as RagPersistenceRepository

    service = new MaterialChunkEmbeddingService(embeddingProvider, repository)
  })

  it('persists embedded chunks with the provider model recorded', async () => {
    const firstEmbedding = [0.1, 0.2]
    const secondEmbedding = [0.3, 0.4]
    embedBatch.mockResolvedValue([firstEmbedding, secondEmbedding])

    await service.embedAndReplaceMaterialChunks(materialId, [
      { chunkIndex: 0, content: 'variables store values' },
      { chunkIndex: 1, content: 'loops repeat statements' },
    ])

    expect(embedBatch).toHaveBeenCalledTimes(1)
    expect(embedBatch).toHaveBeenCalledWith([
      'variables store values',
      'loops repeat statements',
    ])
    expect(replaceMaterialChunks).toHaveBeenCalledWith(materialId, [
      {
        chunkIndex: 0,
        content: 'variables store values',
        embedding: firstEmbedding,
        embeddingModel: 'test-embedding-model',
      },
      {
        chunkIndex: 1,
        content: 'loops repeat statements',
        embedding: secondEmbedding,
        embeddingModel: 'test-embedding-model',
      },
    ])
  })

  it('preserves the pairing between chunk indexes and embeddings', async () => {
    embedBatch.mockResolvedValue([[1], [2], [3]])

    await service.embedAndReplaceMaterialChunks(materialId, [
      { chunkIndex: 7, content: 'seventh' },
      { chunkIndex: 2, content: 'second' },
      { chunkIndex: 9, content: 'ninth' },
    ])

    const [, persistedChunks] = replaceMaterialChunks.mock.calls[0] as [
      string,
      { chunkIndex: number; content: string; embedding: number[] }[],
    ]
    expect(persistedChunks.map((chunk) => chunk.chunkIndex)).toEqual([7, 2, 9])
    expect(persistedChunks.map((chunk) => chunk.embedding)).toEqual([
      [1],
      [2],
      [3],
    ])
  })

  it('replaces with zero chunks without invoking the provider', async () => {
    await service.embedAndReplaceMaterialChunks(materialId, [])

    expect(embedBatch).not.toHaveBeenCalled()
    expect(replaceMaterialChunks).toHaveBeenCalledWith(materialId, [])
  })

  it('propagates provider failures without persisting anything', async () => {
    embedBatch.mockRejectedValue(new Error('provider unavailable'))

    await expect(
      service.embedAndReplaceMaterialChunks(materialId, [
        { chunkIndex: 0, content: 'text' },
      ]),
    ).rejects.toThrow('provider unavailable')
    expect(replaceMaterialChunks).not.toHaveBeenCalled()
  })
})
