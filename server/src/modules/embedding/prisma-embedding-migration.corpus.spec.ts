import type { PrismaService } from '../prisma/prisma.service'
import { PrismaEmbeddingMigrationCorpus } from './prisma-embedding-migration.corpus'

describe('PrismaEmbeddingMigrationCorpus', () => {
  let findMany: jest.Mock
  let count: jest.Mock
  let corpus: PrismaEmbeddingMigrationCorpus

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([])
    count = jest.fn().mockResolvedValue(0)
    corpus = new PrismaEmbeddingMigrationCorpus({
      material: { findMany },
      materialChunk: { count },
    } as unknown as PrismaService)
  })

  // The same base scope readiness uses. Adding `chunk_count > 0` here would hide
  // exactly the material an operator most needs reported: one that claims to be
  // ready but has no chunks to migrate.
  it('scopes to candidate materials without the retrieval chunk-count predicate', async () => {
    await corpus.listCandidateMaterials()

    const [query] = findMany.mock.calls[0] as [
      {
        where: Record<string, unknown>
        orderBy: unknown
        select: Record<string, unknown>
      },
    ]
    expect(query.where).toEqual({
      status: { in: ['READY', 'WARNING'] },
      deletedAt: null,
      extractedTextLength: { gt: 0 },
    })
    expect(query.where).not.toHaveProperty('chunkCount')
  })

  // Not what makes resumption safe — rescanning coverage is — but it keeps the
  // progress report comparable across runs.
  it('walks the corpus in a stable order', async () => {
    await corpus.listCandidateMaterials()

    const [query] = findMany.mock.calls[0] as [{ orderBy: unknown }]
    expect(query.orderBy).toEqual({ id: 'asc' })
  })

  it('selects the title the target provider needs to re-embed', async () => {
    await corpus.listCandidateMaterials()

    const [query] = findMany.mock.calls[0] as [
      { select: Record<string, unknown> },
    ]
    expect(query.select).toEqual({ id: true, title: true, chunkCount: true })
  })

  it('returns the materials the query produced', async () => {
    findMany.mockResolvedValue([
      { id: 'material-a', title: 'Week 1', chunkCount: 3 },
    ])

    await expect(corpus.listCandidateMaterials()).resolves.toEqual([
      { id: 'material-a', title: 'Week 1', chunkCount: 3 },
    ])
  })

  it('counts only the target profile for one material', async () => {
    count.mockResolvedValue(4)

    await expect(
      corpus.countChunksForProfile(
        'material-a',
        'gemini/gemini-embedding-2/1536/document-v1',
      ),
    ).resolves.toBe(4)
    expect(count).toHaveBeenCalledWith({
      where: {
        materialId: 'material-a',
        embeddingModel: 'gemini/gemini-embedding-2/1536/document-v1',
      },
    })
  })
})
