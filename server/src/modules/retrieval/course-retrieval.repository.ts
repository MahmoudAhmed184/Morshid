import { Injectable } from '@nestjs/common'

import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

// Intentional consumer-side guard, duplicated from the embedding module so a
// contract drift there cannot silently send a mismatched vector to Postgres.
const EMBEDDING_DIMENSIONS = 1_536

// Upper bound re-asserted at the repository boundary; the configured value is
// validated to the same range in env.schema.ts.
const MAX_TOP_K = 50

// Course ids are UUIDs; rejecting other shapes here keeps a malformed id from
// surfacing as a raw Postgres ::uuid cast error instead of the typed
// InvalidRetrievalQueryError the rest of the boundary throws.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface CourseChunkQuery {
  courseId: string
  queryEmbedding: readonly number[]
  topK: number
  minSimilarity: number
}

export interface RankedChunkRow {
  chunkId: string
  materialId: string
  materialTitle: string
  chunkIndex: number
  content: string
  storagePath: string
  // Cosine distance; similarity = 1 - distance.
  distance: number
}

export class InvalidRetrievalQueryError extends Error {
  constructor(reason: 'course-id' | 'embedding' | 'top-k' | 'min-similarity') {
    super(`Retrieval query rejected: invalid ${reason}`)
    this.name = 'InvalidRetrievalQueryError'
  }
}

export abstract class CourseRetrievalRepository {
  // Returns at most topK rows from the given course only, ordered by
  // ascending cosine distance (descending similarity), already filtered to
  // READY/WARNING, non-deleted materials and thresholded in SQL. The course
  // predicate is part of the signature; there is no unscoped variant.
  abstract findTopChunksForCourse(
    query: CourseChunkQuery,
  ): Promise<RankedChunkRow[]>
}

@Injectable()
export class PrismaCourseRetrievalRepository extends CourseRetrievalRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  async findTopChunksForCourse(
    query: CourseChunkQuery,
  ): Promise<RankedChunkRow[]> {
    assertValidQuery(query)

    // Every caller-influenced value below is a bind parameter; the predicates,
    // operators, and status literals are static developer-owned SQL, so no
    // client, provider, or prompt input can widen the course boundary or the
    // limits.
    return this.prismaService.$queryRaw<RankedChunkRow[]>(Prisma.sql`
      WITH eligible_chunks AS MATERIALIZED (
        -- MATERIALIZED forces an exact scan over the course-scoped rows
        -- instead of the global HNSW index, which post-filters ANN candidates
        -- and can under-return k (see the 20260716224018 migration comment).
        -- Revisit hnsw.iterative_scan if per-course corpora outgrow P0.
        SELECT
          chunk.id,
          chunk.material_id,
          chunk.chunk_index,
          chunk.content,
          material.title,
          material.storage_path,
          chunk.embedding <=> ${serializeEmbedding(query.queryEmbedding)}::vector(1536) AS distance
        FROM material_chunks AS chunk
        JOIN materials AS material ON material.id = chunk.material_id
        WHERE material.course_id = ${query.courseId}::uuid
          AND material.status IN ('READY'::material_status, 'WARNING'::material_status)
          AND material.deleted_at IS NULL
          AND material.extracted_text_length > 0
          AND material.chunk_count > 0
      )
      SELECT
        id AS "chunkId",
        material_id AS "materialId",
        chunk_index AS "chunkIndex",
        content,
        title AS "materialTitle",
        storage_path AS "storagePath",
        distance
      FROM eligible_chunks
      WHERE 1 - distance >= ${query.minSimilarity}
      ORDER BY distance ASC, material_id ASC, chunk_index ASC
      LIMIT ${query.topK}
    `)
  }
}

function assertValidQuery(query: CourseChunkQuery): void {
  if (!UUID_PATTERN.test(query.courseId)) {
    throw new InvalidRetrievalQueryError('course-id')
  }

  if (
    query.queryEmbedding.length !== EMBEDDING_DIMENSIONS ||
    !query.queryEmbedding.every((component) => Number.isFinite(component))
  ) {
    throw new InvalidRetrievalQueryError('embedding')
  }

  if (
    !Number.isInteger(query.topK) ||
    query.topK < 1 ||
    query.topK > MAX_TOP_K
  ) {
    throw new InvalidRetrievalQueryError('top-k')
  }

  if (
    !Number.isFinite(query.minSimilarity) ||
    query.minSimilarity < 0 ||
    query.minSimilarity > 1
  ) {
    throw new InvalidRetrievalQueryError('min-similarity')
  }
}

function serializeEmbedding(embedding: readonly number[]): string {
  return `[${embedding.join(',')}]`
}
