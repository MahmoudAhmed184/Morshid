import type { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../config/env.schema'
import type { EmbeddingProvider } from '../embedding/embedding-provider'
import type {
  CourseRetrievalRepository,
  RankedChunkRow,
} from './course-retrieval.repository'
import { RetrievalService } from './retrieval.service'

describe('RetrievalService', () => {
  const courseId = '9d1a7c2e-3b4f-4a5d-8e6f-0a1b2c3d4e5f'
  const queryEmbedding = [0.25, 0.5]

  let embedBatch: jest.Mock
  let findTopChunksForCourse: jest.Mock
  let service: RetrievalService

  beforeEach(() => {
    embedBatch = jest.fn().mockResolvedValue([queryEmbedding])
    findTopChunksForCourse = jest.fn().mockResolvedValue([])

    const embeddingProvider = {
      model: 'test-embedding-model',
      embedBatch,
    } as unknown as EmbeddingProvider
    const repository = {
      findTopChunksForCourse,
    } as unknown as CourseRetrievalRepository
    const configService = {
      get: (key: 'RETRIEVAL_TOP_K' | 'RETRIEVAL_MIN_SIMILARITY') =>
        key === 'RETRIEVAL_TOP_K' ? 5 : 0.7,
    } as unknown as ConfigService<AppEnvironment, true>

    service = new RetrievalService(embeddingProvider, repository, configService)
  })

  it('embeds the query once and forwards only configured limits with the course id', async () => {
    await service.retrieveCourseEvidence(courseId, 'what is a variable?')

    expect(embedBatch).toHaveBeenCalledTimes(1)
    expect(embedBatch).toHaveBeenCalledWith(['what is a variable?'])
    expect(findTopChunksForCourse).toHaveBeenCalledTimes(1)
    expect(findTopChunksForCourse).toHaveBeenCalledWith({
      courseId,
      queryEmbedding,
      topK: 5,
      minSimilarity: 0.7,
    })
  })

  it('maps ranked rows to descending-similarity evidence with dense ranks', async () => {
    const rows: RankedChunkRow[] = [
      {
        chunkId: 'chunk-a',
        materialId: 'material-1',
        materialTitle: 'Python Basics',
        chunkIndex: 3,
        content: 'closest chunk',
        distance: 0.05,
      },
      {
        chunkId: 'chunk-b',
        materialId: 'material-2',
        materialTitle: 'Loops',
        chunkIndex: 0,
        content: 'second chunk',
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
        },
        {
          chunkId: 'chunk-b',
          materialId: 'material-2',
          materialTitle: 'Loops',
          chunkIndex: 0,
          content: 'second chunk',
          rank: 2,
          similarityScore: 0.8,
        },
      ],
    })
  })

  it('reports insufficient evidence when no row meets the threshold', async () => {
    findTopChunksForCourse.mockResolvedValue([])

    await expect(
      service.retrieveCourseEvidence(courseId, 'unrelated question'),
    ).resolves.toEqual({ kind: 'insufficient_evidence' })
  })

  it('propagates provider failures without querying the repository', async () => {
    embedBatch.mockRejectedValue(new Error('embedding failed'))

    await expect(
      service.retrieveCourseEvidence(courseId, 'query'),
    ).rejects.toThrow('embedding failed')
    expect(findTopChunksForCourse).not.toHaveBeenCalled()
  })
})
