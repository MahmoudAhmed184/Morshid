import type { Prisma } from '../../generated/prisma/client'
import type { PrismaService } from '../prisma/prisma.service'
import {
  InvalidRetrievalQueryError,
  PrismaCourseRetrievalRepository,
  type CourseChunkQuery,
} from './course-retrieval.repository'

describe('PrismaCourseRetrievalRepository', () => {
  const courseId = '0f0a3f39-2f6a-4a0e-9a8e-5b9a3a1c2d4e'

  let queryRaw: jest.Mock
  let repository: PrismaCourseRetrievalRepository

  beforeEach(() => {
    queryRaw = jest.fn().mockResolvedValue([])
    repository = new PrismaCourseRetrievalRepository({
      $queryRaw: queryRaw,
    } as unknown as PrismaService)
  })

  function buildQuery(overrides: Partial<CourseChunkQuery> = {}) {
    return {
      courseId,
      queryEmbedding: buildEmbedding(),
      topK: 5,
      minSimilarity: 0.7,
      ...overrides,
    }
  }

  it('binds exactly the vector, course id, threshold, and limit as parameters', async () => {
    const embedding = buildEmbedding()
    await repository.findTopChunksForCourse(
      buildQuery({ queryEmbedding: embedding }),
    )

    expect(queryRaw).toHaveBeenCalledTimes(1)
    const [statement] = queryRaw.mock.calls[0] as [Prisma.Sql]
    expect(statement.values).toEqual([
      `[${embedding.join(',')}]`,
      courseId,
      0.7,
      5,
    ])
  })

  it('hardcodes the course, status, and deletion predicates in static SQL', async () => {
    await repository.findTopChunksForCourse(buildQuery())

    const [statement] = queryRaw.mock.calls[0] as [Prisma.Sql]
    const staticSql = statement.strings.join('?')
    expect(staticSql).toContain('material.course_id = ?::uuid')
    expect(staticSql).toContain(
      "material.status IN ('READY'::material_status, 'WARNING'::material_status)",
    )
    expect(staticSql).toContain('material.deleted_at IS NULL')
    expect(staticSql).toContain('material.extracted_text_length > 0')
    expect(staticSql).toContain('material.chunk_count > 0')
    expect(staticSql).toContain('1 - distance >= ?')
    expect(staticSql).toContain('LIMIT ?')
    expect(staticSql).toContain('ORDER BY distance ASC')
  })

  it.each([
    '',
    'not-a-uuid',
    "0f0a3f39'; DROP TABLE materials; --",
    '0f0a3f39-2f6a-4a0e-9a8e-5b9a3a1c2d4', // one hex digit short
  ])('rejects course id %j without touching the database', async (badId) => {
    await expect(
      repository.findTopChunksForCourse(buildQuery({ courseId: badId })),
    ).rejects.toThrow(InvalidRetrievalQueryError)
    expect(queryRaw).not.toHaveBeenCalled()
  })

  it.each([0, 1.5, 51, -1])(
    'rejects top-k %p without touching the database',
    async (topK) => {
      await expect(
        repository.findTopChunksForCourse(buildQuery({ topK })),
      ).rejects.toThrow(InvalidRetrievalQueryError)
      expect(queryRaw).not.toHaveBeenCalled()
    },
  )

  it.each([-0.1, 1.1, Number.NaN])(
    'rejects minimum similarity %p without touching the database',
    async (minSimilarity) => {
      await expect(
        repository.findTopChunksForCourse(buildQuery({ minSimilarity })),
      ).rejects.toThrow(InvalidRetrievalQueryError)
      expect(queryRaw).not.toHaveBeenCalled()
    },
  )

  it('rejects an embedding with the wrong dimension', async () => {
    await expect(
      repository.findTopChunksForCourse(
        buildQuery({ queryEmbedding: buildEmbedding().slice(0, 1_535) }),
      ),
    ).rejects.toThrow(InvalidRetrievalQueryError)
    expect(queryRaw).not.toHaveBeenCalled()
  })

  it('rejects an embedding containing non-finite components', async () => {
    const embedding = buildEmbedding()
    embedding[10] = Number.NaN

    await expect(
      repository.findTopChunksForCourse(
        buildQuery({ queryEmbedding: embedding }),
      ),
    ).rejects.toThrow(InvalidRetrievalQueryError)
    expect(queryRaw).not.toHaveBeenCalled()
  })

  it('returns the rows produced by the query in order', async () => {
    const rows = [
      {
        chunkId: 'chunk-1',
        materialId: 'material-1',
        materialTitle: 'Python Basics',
        chunkIndex: 0,
        content: 'first',
        storagePath: '00000000-0000-4000-8000-000000000001.pdf',
        distance: 0.05,
      },
      {
        chunkId: 'chunk-2',
        materialId: 'material-1',
        materialTitle: 'Python Basics',
        chunkIndex: 1,
        content: 'second',
        storagePath: '00000000-0000-4000-8000-000000000001.pdf',
        distance: 0.1,
      },
    ]
    queryRaw.mockResolvedValue(rows)

    await expect(
      repository.findTopChunksForCourse(buildQuery()),
    ).resolves.toEqual(rows)
  })
})

function buildEmbedding(): number[] {
  const embedding = new Array<number>(1_536).fill(0)
  embedding[0] = 1
  return embedding
}
