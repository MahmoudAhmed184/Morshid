import type { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../config/env.schema'
import type { EmbeddingProvider } from '../embedding/embedding-provider'
import type { PdfStorage } from '../pdf-storage/pdf-storage'
import type {
  CourseRetrievalRepository,
  RankedChunkRow,
} from './course-retrieval.repository'
import { RetrievalService } from './retrieval.service'

describe('RetrievalService', () => {
  const courseId = '9d1a7c2e-3b4f-4a5d-8e6f-0a1b2c3d4e5f'
  const queryEmbedding = [0.25, 0.5]

  const embeddingModel = 'test-embedding-model'

  let embedQuery: jest.Mock
  let findTopChunksForCourse: jest.Mock
  let findEmbeddingProfileReadiness: jest.Mock
  let service: RetrievalService
  let exists: jest.Mock

  beforeEach(() => {
    embedQuery = jest.fn().mockResolvedValue(queryEmbedding)
    findTopChunksForCourse = jest.fn().mockResolvedValue([])
    findEmbeddingProfileReadiness = jest.fn().mockResolvedValue({
      kind: 'ready',
    })
    exists = jest.fn().mockResolvedValue(true)

    const embeddingProvider = {
      model: embeddingModel,
      queryProtocol: `${embeddingModel}/query-v1`,
      embedQuery,
    } as unknown as EmbeddingProvider
    const repository = {
      findTopChunksForCourse,
      findEmbeddingProfileReadiness,
    } as unknown as CourseRetrievalRepository
    const configService = {
      get: (key: 'RETRIEVAL_TOP_K' | 'RETRIEVAL_MIN_SIMILARITY') =>
        key === 'RETRIEVAL_TOP_K' ? 5 : 0.7,
    } as unknown as ConfigService<AppEnvironment, true>

    const storage = { exists } as unknown as PdfStorage
    service = new RetrievalService(
      embeddingProvider,
      repository,
      configService,
      storage,
    )
  })

  it('embeds the query once and forwards only configured limits with the course id', async () => {
    await service.retrieveCourseEvidence(courseId, 'what is a variable?')

    expect(embedQuery).toHaveBeenCalledTimes(1)
    expect(embedQuery).toHaveBeenCalledWith('what is a variable?')
    expect(findTopChunksForCourse).toHaveBeenCalledTimes(1)
    expect(findTopChunksForCourse).toHaveBeenCalledWith({
      courseId,
      queryEmbedding,
      embeddingModel,
      topK: 5,
      minSimilarity: 0.7,
      offset: 0,
    })
  })

  it('checks profile readiness for the active model before embedding the query', async () => {
    await service.retrieveCourseEvidence(courseId, 'what is a variable?')

    expect(findEmbeddingProfileReadiness).toHaveBeenCalledWith({
      courseId,
      embeddingModel,
    })
    expect(
      findEmbeddingProfileReadiness.mock.invocationCallOrder[0],
    ).toBeLessThan(embedQuery.mock.invocationCallOrder[0])
  })

  it('reports the profile as not ready without spending provider quota', async () => {
    findEmbeddingProfileReadiness.mockResolvedValue({
      kind: 'not_ready',
      incompleteMaterialCount: 2,
      incompleteMaterialIds: ['material-a', 'material-b'],
    })

    await expect(
      service.retrieveCourseEvidence(courseId, 'query'),
    ).resolves.toEqual({
      kind: 'embedding_profile_not_ready',
      expectedModel: embeddingModel,
      incompleteMaterialIds: ['material-a', 'material-b'],
    })
    expect(embedQuery).not.toHaveBeenCalled()
    expect(findTopChunksForCourse).not.toHaveBeenCalled()
  })

  it('reports insufficient evidence when the course has no candidate materials', async () => {
    findEmbeddingProfileReadiness.mockResolvedValue({
      kind: 'no_candidate_materials',
    })

    await expect(
      service.retrieveCourseEvidence(courseId, 'query'),
    ).resolves.toEqual({ kind: 'insufficient_evidence' })
    expect(embedQuery).not.toHaveBeenCalled()
    expect(findTopChunksForCourse).not.toHaveBeenCalled()
  })

  it('maps ranked rows to descending-similarity evidence with dense ranks', async () => {
    const rows: RankedChunkRow[] = [
      {
        chunkId: 'chunk-a',
        materialId: 'material-1',
        materialTitle: 'Python Basics',
        chunkIndex: 3,
        content: 'closest chunk',
        storagePath: '00000000-0000-4000-8000-000000000001.pdf',
        distance: 0.05,
      },
      {
        chunkId: 'chunk-b',
        materialId: 'material-2',
        materialTitle: 'Loops',
        chunkIndex: 0,
        content: 'second chunk',
        storagePath: '00000000-0000-4000-8000-000000000002.pdf',
        distance: 0.2,
      },
    ]
    findTopChunksForCourse.mockResolvedValue(rows)

    const result = await service.retrieveCourseEvidence(courseId, 'query')

    expect(result).toEqual({
      kind: 'evidence',
      chunks: [
        {
          chunkId: 'chunk-a',
          materialId: 'material-1',
          materialTitle: 'Python Basics',
          chunkIndex: 3,
          content: 'closest chunk',
          rank: 1,
          similarityScore: 0.95,
          embeddingModel,
        },
        {
          chunkId: 'chunk-b',
          materialId: 'material-2',
          materialTitle: 'Loops',
          chunkIndex: 0,
          content: 'second chunk',
          rank: 2,
          similarityScore: 0.8,
          embeddingModel,
        },
      ],
    })
  })

  it.each(['', '   ', '\n\t'])(
    'reports insufficient evidence for blank query %j without embedding or querying',
    async (blankQuery) => {
      await expect(
        service.retrieveCourseEvidence(courseId, blankQuery),
      ).resolves.toEqual({ kind: 'insufficient_evidence' })
      expect(embedQuery).not.toHaveBeenCalled()
      expect(findTopChunksForCourse).not.toHaveBeenCalled()
    },
  )

  it('embeds the trimmed query text', async () => {
    await service.retrieveCourseEvidence(courseId, '  what is a variable?  ')

    expect(embedQuery).toHaveBeenCalledWith('what is a variable?')
  })

  it('reports insufficient evidence when no row meets the threshold', async () => {
    findTopChunksForCourse.mockResolvedValue([])

    await expect(
      service.retrieveCourseEvidence(courseId, 'unrelated question'),
    ).resolves.toEqual({ kind: 'insufficient_evidence' })
  })

  it('excludes rows whose backing PDF is unavailable and re-ranks evidence', async () => {
    findTopChunksForCourse.mockResolvedValue([
      {
        chunkId: 'missing-chunk',
        materialId: 'missing-material',
        materialTitle: 'Missing',
        chunkIndex: 0,
        content: 'must not return',
        storagePath: '00000000-0000-4000-8000-000000000001.pdf',
        distance: 0.01,
      },
      {
        chunkId: 'available-chunk',
        materialId: 'available-material',
        materialTitle: 'Available',
        chunkIndex: 0,
        content: 'safe evidence',
        storagePath: '00000000-0000-4000-8000-000000000002.pdf',
        distance: 0.1,
      },
    ])
    exists.mockImplementation((storagePath: string) =>
      Promise.resolve(storagePath.endsWith('2.pdf')),
    )

    await expect(
      service.retrieveCourseEvidence(courseId, 'query'),
    ).resolves.toEqual({
      kind: 'evidence',
      chunks: [
        expect.objectContaining({
          chunkId: 'available-chunk',
          rank: 1,
        }),
      ],
    })
  })

  it('backfills an available rank K+1 candidate after missing top-ranked files', async () => {
    const missingRows = Array.from({ length: 5 }, (_, chunkIndex) => ({
      chunkId: `missing-${String(chunkIndex)}`,
      materialId: 'missing-material',
      materialTitle: 'Missing',
      chunkIndex,
      content: 'unavailable evidence',
      storagePath: 'missing.pdf',
      distance: 0.01 + chunkIndex / 100,
    }))
    const availableRow = {
      chunkId: 'rank-six',
      materialId: 'available-material',
      materialTitle: 'Available',
      chunkIndex: 0,
      content: 'rank K+1 evidence',
      storagePath: 'available.pdf',
      distance: 0.2,
    }
    findTopChunksForCourse
      .mockResolvedValueOnce(missingRows)
      .mockResolvedValueOnce([availableRow])
    exists.mockImplementation((storagePath: string) =>
      Promise.resolve(storagePath === 'available.pdf'),
    )

    await expect(
      service.retrieveCourseEvidence(courseId, 'query'),
    ).resolves.toEqual({
      kind: 'evidence',
      chunks: [expect.objectContaining({ chunkId: 'rank-six', rank: 1 })],
    })
    expect(findTopChunksForCourse).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ offset: 5, topK: 5 }),
    )
    expect(exists).toHaveBeenCalledTimes(2)
  })

  it('bounds unavailable candidate scans and checks each storage path once', async () => {
    findTopChunksForCourse.mockResolvedValue(
      Array.from({ length: 5 }, (_, chunkIndex) => ({
        chunkId: `missing-${String(chunkIndex)}`,
        materialId: 'missing-material',
        materialTitle: 'Missing',
        chunkIndex,
        content: 'unavailable evidence',
        storagePath: 'same-missing.pdf',
        distance: 0.01 + chunkIndex / 100,
      })),
    )
    exists.mockResolvedValue(false)

    await expect(
      service.retrieveCourseEvidence(courseId, 'query'),
    ).resolves.toEqual({ kind: 'insufficient_evidence' })
    expect(findTopChunksForCourse).toHaveBeenCalledTimes(5)
    expect(exists).toHaveBeenCalledTimes(1)
  })

  it('propagates provider failures without querying the repository', async () => {
    embedQuery.mockRejectedValue(new Error('embedding failed'))

    await expect(
      service.retrieveCourseEvidence(courseId, 'query'),
    ).rejects.toThrow('embedding failed')
    expect(findTopChunksForCourse).not.toHaveBeenCalled()
  })
})
