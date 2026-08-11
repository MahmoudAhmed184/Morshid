import type { EmbeddingProvider } from '../../platform/ai/embedding/embedding-provider'
import { MaterialChunkEmbeddingService } from './material-chunk-embedding.service'
import type { MaterialChunkRepository } from './material-chunk.repository'

describe('MaterialChunkEmbeddingService', () => {
  const materialId = '4b8d0d5e-9c3a-4f9e-8b21-2f6a1d9c7e10'
  const material = { id: materialId, title: 'Python Basics' }

  let embedDocuments: jest.Mock
  let replaceMaterialChunks: jest.Mock
  let service: MaterialChunkEmbeddingService

  beforeEach(() => {
    embedDocuments = jest.fn()
    replaceMaterialChunks = jest.fn().mockResolvedValue(undefined)

    const embeddingProvider = {
      model: 'test-embedding-model',
      queryProtocol: 'test-embedding-model/query-v1',
      embedDocuments,
    } as unknown as EmbeddingProvider
    const repository = {
      replaceMaterialChunks,
    } as unknown as MaterialChunkRepository

    service = new MaterialChunkEmbeddingService(embeddingProvider, repository)
  })

  it('persists embedded chunks with the provider model recorded', async () => {
    const firstEmbedding = [0.1, 0.2]
    const secondEmbedding = [0.3, 0.4]
    embedDocuments.mockResolvedValue([firstEmbedding, secondEmbedding])

    await service.embedAndReplaceMaterialChunks(material, [
      { chunkIndex: 0, content: 'variables store values' },
      { chunkIndex: 1, content: 'loops repeat statements' },
    ])

    expect(embedDocuments).toHaveBeenCalledTimes(1)
    // The title travels with every document: it is part of the live adapters'
    // document profile, so it must be plumbed now rather than folded in later.
    expect(embedDocuments).toHaveBeenCalledWith([
      { text: 'variables store values', title: 'Python Basics' },
      { text: 'loops repeat statements', title: 'Python Basics' },
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
    embedDocuments.mockResolvedValue([[1], [2], [3]])

    await service.embedAndReplaceMaterialChunks(material, [
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
    await service.embedAndReplaceMaterialChunks(material, [])

    expect(embedDocuments).not.toHaveBeenCalled()
    expect(replaceMaterialChunks).toHaveBeenCalledWith(materialId, [])
  })

  it('propagates provider failures without persisting anything', async () => {
    embedDocuments.mockRejectedValue(new Error('provider unavailable'))

    await expect(
      service.embedAndReplaceMaterialChunks(material, [
        { chunkIndex: 0, content: 'text' },
      ]),
    ).rejects.toThrow('provider unavailable')
    expect(replaceMaterialChunks).not.toHaveBeenCalled()
  })

  it('prepares embedded chunks for atomic processing finalization', async () => {
    embedDocuments.mockResolvedValue([[0.1], [0.2]])

    await expect(
      service.embedMaterialChunks(material, [
        { chunkIndex: 0, content: 'variables' },
        { chunkIndex: 1, content: 'loops' },
      ]),
    ).resolves.toEqual([
      {
        chunkIndex: 0,
        content: 'variables',
        embedding: [0.1],
        embeddingModel: 'test-embedding-model',
      },
      {
        chunkIndex: 1,
        content: 'loops',
        embedding: [0.2],
        embeddingModel: 'test-embedding-model',
      },
    ])
  })
})
