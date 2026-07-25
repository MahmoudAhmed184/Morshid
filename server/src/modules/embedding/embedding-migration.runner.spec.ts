import type { MaterialChunkRecord } from '../rag-persistence/rag-persistence.repository'
import {
  migrateEmbeddings,
  type EmbeddingMigrationCorpus,
  type EmbeddingMigrationEvent,
  type MigratableMaterial,
} from './embedding-migration.runner'
import {
  EMBEDDING_DIMENSIONS,
  type EmbeddingProvider,
} from './embedding-provider'

function buildVector(): number[] {
  return new Array<number>(EMBEDDING_DIMENSIONS).fill(0.25)
}

function buildChunk(
  materialId: string,
  chunkIndex: number,
  embeddingModel: string,
): MaterialChunkRecord {
  return {
    id: `${materialId}-chunk-${String(chunkIndex)}`,
    materialId,
    chunkIndex,
    content: `content ${String(chunkIndex)}`,
    embedding: buildVector(),
    embeddingModel,
    createdAt: new Date(0),
  }
}

interface Harness {
  target: EmbeddingProvider
  corpus: EmbeddingMigrationCorpus
  persistence: {
    findMaterialChunks: jest.Mock
    replaceMaterialChunks: jest.Mock
  }
  embedDocuments: jest.Mock
  coverage: Map<string, number>
}

function buildHarness(materials: readonly MigratableMaterial[]): Harness {
  const coverage = new Map<string, number>()
  const embedDocuments = jest.fn((documents: readonly unknown[]) =>
    Promise.resolve(documents.map(() => buildVector())),
  )
  const target = {
    model: 'gemini/gemini-embedding-2/1536/document-v1',
    queryProtocol: 'gemini/gemini-embedding-2/search-result-v1',
    embedQuery: () => Promise.resolve(buildVector()),
    embedDocuments,
  } as unknown as EmbeddingProvider

  const persistence = {
    findMaterialChunks: jest.fn((materialId: string) =>
      Promise.resolve([
        buildChunk(materialId, 0, 'deterministic-embedding-v1'),
        buildChunk(materialId, 1, 'deterministic-embedding-v1'),
      ]),
    ),
    replaceMaterialChunks: jest.fn(
      (materialId: string, chunks: readonly unknown[]) => {
        coverage.set(materialId, chunks.length)
        return Promise.resolve()
      },
    ),
  }

  const corpus: EmbeddingMigrationCorpus = {
    listCandidateMaterials: () => Promise.resolve(materials),
    countChunksForProfile: (materialId) =>
      Promise.resolve(coverage.get(materialId) ?? 0),
  }

  return { target, corpus, persistence, embedDocuments, coverage }
}

const twoMaterials: MigratableMaterial[] = [
  { id: 'material-a', title: 'Week 1', chunkCount: 2 },
  { id: 'material-b', title: 'Week 2', chunkCount: 2 },
]

describe('migrateEmbeddings', () => {
  it('re-embeds every candidate material under the target profile', async () => {
    const harness = buildHarness(twoMaterials)

    const summary = await migrateEmbeddings(harness)

    expect(summary).toMatchObject({
      targetModel: 'gemini/gemini-embedding-2/1536/document-v1',
      candidateCount: 2,
      migratedCount: 2,
      skippedCount: 0,
      failedMaterialIds: [],
      complete: true,
    })
    expect(harness.persistence.replaceMaterialChunks).toHaveBeenCalledTimes(2)
  })

  it('records the target profile on every replaced chunk', async () => {
    const harness = buildHarness([twoMaterials[0]])

    await migrateEmbeddings(harness)

    const [, chunks] = harness.persistence.replaceMaterialChunks.mock
      .calls[0] as [string, { embeddingModel: string; chunkIndex: number }[]]
    expect(chunks.map(({ embeddingModel }) => embeddingModel)).toEqual([
      'gemini/gemini-embedding-2/1536/document-v1',
      'gemini/gemini-embedding-2/1536/document-v1',
    ])
    expect(chunks.map(({ chunkIndex }) => chunkIndex)).toEqual([0, 1])
  })

  // Re-extraction could change chunk boundaries if the extractor or chunker has
  // evolved, silently turning a provider migration into a content migration.
  it('re-embeds the persisted chunk text and the material title', async () => {
    const harness = buildHarness([twoMaterials[0]])

    await migrateEmbeddings(harness)

    expect(harness.embedDocuments).toHaveBeenCalledWith([
      { text: 'content 0', title: 'Week 1' },
      { text: 'content 1', title: 'Week 1' },
    ])
  })

  it('skips a material already completely covered without embedding it', async () => {
    const harness = buildHarness(twoMaterials)
    harness.coverage.set('material-a', 2)

    const summary = await migrateEmbeddings(harness)

    expect(summary).toMatchObject({ migratedCount: 1, skippedCount: 1 })
    expect(harness.embedDocuments).toHaveBeenCalledTimes(1)
    expect(harness.persistence.replaceMaterialChunks).toHaveBeenCalledWith(
      'material-b',
      expect.anything(),
    )
  })

  it('re-embeds a partially covered material', async () => {
    const harness = buildHarness([twoMaterials[0]])
    harness.coverage.set('material-a', 1)

    const summary = await migrateEmbeddings(harness)

    expect(summary).toMatchObject({ migratedCount: 1, skippedCount: 0 })
  })

  it('carries on past a failing material and reports it', async () => {
    const harness = buildHarness(twoMaterials)
    harness.embedDocuments.mockImplementationOnce(() =>
      Promise.reject(new Error('provider unavailable')),
    )

    const summary = await migrateEmbeddings(harness)

    expect(summary).toMatchObject({
      migratedCount: 1,
      failedMaterialIds: ['material-a'],
      complete: false,
    })
  })

  // The unsafe alternative is a cursor: if A fails and B succeeds, a cursor
  // advances past A and a resumed run skips it permanently.
  it('retries only the still-incomplete materials on a resumed run', async () => {
    const harness = buildHarness(twoMaterials)
    harness.embedDocuments.mockImplementationOnce(() =>
      Promise.reject(new Error('provider unavailable')),
    )

    const first = await migrateEmbeddings(harness)
    expect(first.failedMaterialIds).toEqual(['material-a'])

    harness.embedDocuments.mockClear()
    harness.persistence.replaceMaterialChunks.mockClear()

    const second = await migrateEmbeddings(harness)

    expect(second).toMatchObject({
      migratedCount: 1,
      skippedCount: 1,
      failedMaterialIds: [],
      complete: true,
    })
    expect(harness.persistence.replaceMaterialChunks).toHaveBeenCalledTimes(1)
    expect(harness.persistence.replaceMaterialChunks).toHaveBeenCalledWith(
      'material-a',
      expect.anything(),
    )
  })

  it('reports incomplete when a replacement did not land', async () => {
    const harness = buildHarness([twoMaterials[0]])
    harness.persistence.replaceMaterialChunks.mockImplementation(() =>
      Promise.resolve(),
    )

    const summary = await migrateEmbeddings(harness)

    expect(summary).toMatchObject({
      migratedCount: 0,
      failedMaterialIds: ['material-a'],
      complete: false,
    })
  })

  // A candidate material with no persisted chunks needs reprocessing, not
  // migration: there is no source text for this runner to re-embed.
  it('reports a candidate material with no chunks as incomplete', async () => {
    const harness = buildHarness([twoMaterials[0]])
    harness.persistence.findMaterialChunks.mockResolvedValue([])

    const summary = await migrateEmbeddings(harness)

    expect(summary).toMatchObject({
      failedMaterialIds: ['material-a'],
      complete: false,
    })
    expect(harness.embedDocuments).not.toHaveBeenCalled()
  })

  // Mid-migration a material legitimately holds rows in two profiles; embedding
  // the same chunk index twice would violate (material_id, chunk_index).
  it('deduplicates mixed-profile rows by chunk index', async () => {
    const harness = buildHarness([twoMaterials[0]])
    harness.persistence.findMaterialChunks.mockResolvedValue([
      buildChunk('material-a', 0, 'deterministic-embedding-v1'),
      buildChunk('material-a', 0, 'gemini/gemini-embedding-2/1536/document-v1'),
      buildChunk('material-a', 1, 'deterministic-embedding-v1'),
    ])

    await migrateEmbeddings(harness)

    const [, chunks] = harness.persistence.replaceMaterialChunks.mock
      .calls[0] as [string, { chunkIndex: number }[]]
    expect(chunks.map(({ chunkIndex }) => chunkIndex)).toEqual([0, 1])
  })

  it('emits progress events for reporting only', async () => {
    const harness = buildHarness(twoMaterials)
    harness.coverage.set('material-a', 2)
    const report = jest.fn()

    await migrateEmbeddings({ ...harness, report })

    const events = (report.mock.calls as [EmbeddingMigrationEvent][]).map(
      ([event]) => event,
    )
    expect(events).toEqual([
      { kind: 'skipped_complete', materialId: 'material-a', chunkCount: 2 },
      { kind: 'migrated', materialId: 'material-b', chunkCount: 2 },
    ])
  })

  it('reports an empty corpus as complete', async () => {
    const harness = buildHarness([])

    await expect(migrateEmbeddings(harness)).resolves.toMatchObject({
      candidateCount: 0,
      complete: true,
    })
  })
})
