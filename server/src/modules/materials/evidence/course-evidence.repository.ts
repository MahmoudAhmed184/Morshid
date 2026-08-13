import { Injectable } from '@nestjs/common'

import { Prisma } from '../../../generated/prisma/client'
import { PrismaService } from '../../../platform/database/prisma.service'

// Intentional consumer-side guard, duplicated from the embedding module so a
// contract drift there cannot silently send a mismatched vector to Postgres.
const EMBEDDING_DIMENSIONS = 1_536

// Upper bound re-asserted at the repository boundary; the configured value is
// validated to the same range in env.schema.ts.
const MAX_TOP_K = 50
const MAX_CANDIDATE_OFFSET = 250

// Mirrors material_chunks.embedding_model VARCHAR(120). A value longer than the
// column can never match a stored row, so rejecting it here keeps a
// misconfigured provider from silently retrieving nothing.
const MAX_EMBEDDING_MODEL_LENGTH = 120

// Course ids are UUIDs; rejecting other shapes here keeps a malformed id from
// surfacing as a raw Postgres ::uuid cast error instead of the typed
// InvalidCourseEvidenceQueryError the rest of the boundary throws.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The one SQL definition of candidate material shared by readiness and
// retrieval. Retrieval adds chunk_count > 0 separately; readiness deliberately
// does not, so it can report a null/zero count as incomplete.
const CANDIDATE_MATERIAL_PREDICATE = Prisma.sql`
  material.status IN ('READY'::material_status, 'WARNING'::material_status)
  AND material.deleted_at IS NULL
  AND material.extracted_text_length > 0
`

export interface CourseEvidenceChunkQuery {
  courseId: string
  queryEmbedding: readonly number[]
  // The active provider's document profile. Vectors from different profiles
  // share the same 1,536 dimensions, so Postgres computes a cosine distance
  // between them happily — mathematically valid, semantically meaningless.
  // Filtering here is what keeps a query vector from being compared against
  // documents embedded in a different vector space.
  embeddingModel: string
  topK: number
  minSimilarity: number
  offset: number
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

export interface CourseEvidenceCoverageQuery {
  courseId: string
  embeddingModel: string
}

// Strict course readiness: one incompletely embedded candidate material blocks
// grounded retrieval for that entire course. Partial coverage would answer from
// whichever materials happened to be migrated first, which is worse than
// declining — the student cannot tell a thin answer from a complete one.
export type CourseEvidenceReadiness =
  | { kind: 'no_candidate_materials' }
  | {
      kind: 'not_ready'
      incompleteMaterialCount: number
      incompleteMaterialIds: readonly string[]
    }
  | { kind: 'ready' }

export class InvalidCourseEvidenceQueryError extends Error {
  constructor(
    reason:
      | 'course-id'
      | 'embedding'
      | 'embedding-model'
      | 'top-k'
      | 'min-similarity'
      | 'offset',
  ) {
    super(`Retrieval query rejected: invalid ${reason}`)
    this.name = 'InvalidCourseEvidenceQueryError'
  }
}

export abstract class CourseEvidenceRepository {
  // Returns at most topK rows after offset from the given course only, ordered by
  // ascending cosine distance (descending similarity), already filtered to
  // READY/WARNING, non-deleted materials and thresholded in SQL. The course
  // predicate is part of the signature; there is no unscoped variant.
  abstract findTopChunksForCourse(
    query: CourseEvidenceChunkQuery,
  ): Promise<RankedChunkRow[]>

  // Reports whether every candidate material in the course is completely
  // covered by the given document profile. Callers run this *before* embedding
  // a query, so a course with no compatible vectors never spends provider
  // quota building a query vector it could not use.
  abstract findCourseEvidenceReadiness(
    query: CourseEvidenceCoverageQuery,
  ): Promise<CourseEvidenceReadiness>
}

@Injectable()
export class PrismaCourseEvidenceRepository extends CourseEvidenceRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  async findTopChunksForCourse(
    query: CourseEvidenceChunkQuery,
  ): Promise<RankedChunkRow[]> {
    assertValidQuery(query)

    // Every caller-influenced value below is a bind parameter; the predicates,
    // operators, and status literals are static developer-owned SQL, so no
    // client, provider, or prompt input can widen the course boundary or the
    // limits.
    return this.prismaService.$queryRaw<RankedChunkRow[]>(Prisma.sql`
      WITH eligible_chunks AS MATERIALIZED (
        -- MATERIALIZED forces an exact scan over the course-scoped rows
        -- so the course predicate is applied before ranking and limiting.
        -- Revisit an ANN strategy only with a course-scoped correctness proof.
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
          AND ${CANDIDATE_MATERIAL_PREDICATE}
          AND material.chunk_count > 0
          AND chunk.embedding_model = ${query.embeddingModel}
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
      OFFSET ${query.offset}
    `)
  }

  async findCourseEvidenceReadiness(
    query: CourseEvidenceCoverageQuery,
  ): Promise<CourseEvidenceReadiness> {
    assertValidCoverageQuery(query)

    // `candidate_materials` is the shared base scope — deliberately *without*
    // the `chunk_count > 0` predicate that retrieval adds. Sharing the full
    // retrieval predicate would make "detect a null or zero chunk_count"
    // unreachable, because such a material is already ineligible for
    // retrieval and would never be counted as incomplete.
    const rows = await this.prismaService.$queryRaw<
      readonly EmbeddingProfileCoverageRow[]
    >(Prisma.sql`
      WITH candidate_materials AS (
        SELECT material.id, material.chunk_count
        FROM materials AS material
        WHERE material.course_id = ${query.courseId}::uuid
          AND ${CANDIDATE_MATERIAL_PREDICATE}
      ),
      coverage AS (
        SELECT
          candidate.id AS material_id,
          candidate.chunk_count,
          (
            SELECT COUNT(*)
            FROM material_chunks AS chunk
            WHERE chunk.material_id = candidate.id
              AND chunk.embedding_model = ${query.embeddingModel}
          ) AS covered_chunk_count
        FROM candidate_materials AS candidate
      ),
      readiness AS (
        SELECT
          material_id,
          (
            chunk_count IS NULL
            OR chunk_count <= 0
            OR covered_chunk_count < chunk_count
          ) AS incomplete
        FROM coverage
      )
      SELECT
        COUNT(*)::int AS "candidateMaterialCount",
        COUNT(*) FILTER (WHERE incomplete)::int AS "incompleteMaterialCount",
        COALESCE(
          ARRAY_AGG(material_id ORDER BY material_id) FILTER (WHERE incomplete),
          ARRAY[]::uuid[]
        ) AS "incompleteMaterialIds"
      FROM readiness
    `)

    // An aggregate over an empty set still returns exactly one row, so a
    // missing row means the query shape changed, not an empty course. Failing
    // closed here keeps a silently reshaped query from reading as "ready".
    if (rows.length === 0) {
      throw new InvalidCourseEvidenceQueryError('embedding-model')
    }

    const [row] = rows
    if (row.candidateMaterialCount === 0) {
      return { kind: 'no_candidate_materials' }
    }

    if (row.incompleteMaterialCount > 0) {
      return {
        kind: 'not_ready',
        incompleteMaterialCount: row.incompleteMaterialCount,
        incompleteMaterialIds: row.incompleteMaterialIds,
      }
    }

    return { kind: 'ready' }
  }
}

interface EmbeddingProfileCoverageRow {
  candidateMaterialCount: number
  incompleteMaterialCount: number
  incompleteMaterialIds: string[]
}

function assertValidQuery(query: CourseEvidenceChunkQuery): void {
  assertValidCoverageQuery(query)

  if (
    query.queryEmbedding.length !== EMBEDDING_DIMENSIONS ||
    !query.queryEmbedding.every((component) => Number.isFinite(component))
  ) {
    throw new InvalidCourseEvidenceQueryError('embedding')
  }

  if (
    !Number.isInteger(query.topK) ||
    query.topK < 1 ||
    query.topK > MAX_TOP_K
  ) {
    throw new InvalidCourseEvidenceQueryError('top-k')
  }

  if (
    !Number.isInteger(query.offset) ||
    query.offset < 0 ||
    query.offset > MAX_CANDIDATE_OFFSET
  ) {
    throw new InvalidCourseEvidenceQueryError('offset')
  }

  if (
    !Number.isFinite(query.minSimilarity) ||
    query.minSimilarity < 0 ||
    query.minSimilarity > 1
  ) {
    throw new InvalidCourseEvidenceQueryError('min-similarity')
  }
}

function assertValidCoverageQuery(query: CourseEvidenceCoverageQuery): void {
  if (!UUID_PATTERN.test(query.courseId)) {
    throw new InvalidCourseEvidenceQueryError('course-id')
  }

  if (
    query.embeddingModel.trim() === '' ||
    query.embeddingModel.length > MAX_EMBEDDING_MODEL_LENGTH
  ) {
    throw new InvalidCourseEvidenceQueryError('embedding-model')
  }
}

function serializeEmbedding(embedding: readonly number[]): string {
  return `[${embedding.join(',')}]`
}
