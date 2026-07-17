import { Injectable } from '@nestjs/common'

import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

const EMBEDDING_DIMENSIONS = 1_536

// Each row binds 5 parameters and PostgreSQL caps a statement at 65,535 bind
// parameters, so batches must stay well under 13,107 rows. 1,000 keeps the
// per-statement memory footprint small while remaining efficient.
export const MAX_INSERT_BATCH_ROWS = 1_000

export interface MaterialChunkInput {
  chunkIndex: number
  content: string
  embedding: readonly number[]
  embeddingModel: string
}

export interface MaterialChunkRecord extends MaterialChunkInput {
  id: string
  materialId: string
  // Embeddings are stored as pgvector float4 components, so readback is a lossy
  // round-trip: values that are not exactly representable in float4 come back
  // close to, but not identical to, the inserted value. Consumers must compare
  // with a tolerance rather than for exact equality.
  embedding: number[]
  createdAt: Date
}

export class InvalidMaterialChunkEmbeddingError extends Error {
  constructor(chunkIndex: number) {
    super(
      `Material chunk ${String(chunkIndex)} embedding must contain exactly ${String(EMBEDDING_DIMENSIONS)} finite numbers`,
    )
    this.name = 'InvalidMaterialChunkEmbeddingError'
  }
}

type PrismaTransactionClient = Parameters<
  Parameters<PrismaService['$transaction']>[0]
>[0]

export abstract class RagPersistenceRepository {
  abstract insertMaterialChunks(
    materialId: string,
    chunks: readonly MaterialChunkInput[],
  ): Promise<void>

  abstract replaceMaterialChunks(
    materialId: string,
    chunks: readonly MaterialChunkInput[],
  ): Promise<void>

  abstract findMaterialChunks(
    materialId: string,
  ): Promise<MaterialChunkRecord[]>
}

@Injectable()
export class PrismaRagPersistenceRepository extends RagPersistenceRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  async insertMaterialChunks(
    materialId: string,
    chunks: readonly MaterialChunkInput[],
  ): Promise<void> {
    this.assertValidEmbeddings(chunks)

    if (chunks.length === 0) {
      return
    }

    await this.prismaService.$transaction(async (tx) => {
      await this.insertChunkBatches(tx, materialId, chunks)
    })
  }

  async replaceMaterialChunks(
    materialId: string,
    chunks: readonly MaterialChunkInput[],
  ): Promise<void> {
    this.assertValidEmbeddings(chunks)

    await this.prismaService.$transaction(async (tx) => {
      // message_retrievals.chunk_id is ON DELETE SET NULL, so removing the old
      // chunks preserves historical retrieval provenance while allowing a
      // material to be re-ingested with a different chunker or embedding model.
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM material_chunks
        WHERE material_id = ${materialId}::uuid
      `)

      if (chunks.length > 0) {
        await this.insertChunkBatches(tx, materialId, chunks)
      }
    })
  }

  async findMaterialChunks(materialId: string): Promise<MaterialChunkRecord[]> {
    const rows = await this.prismaService.$queryRaw<MaterialChunkSqlRow[]>(
      Prisma.sql`
        SELECT
          chunk.id,
          chunk.material_id AS "materialId",
          chunk.chunk_index AS "chunkIndex",
          chunk.content,
          chunk.embedding::text AS "embedding",
          chunk.embedding_model AS "embeddingModel",
          chunk.created_at AS "createdAt"
        FROM material_chunks AS chunk
        JOIN materials AS material ON material.id = chunk.material_id
        WHERE chunk.material_id = ${materialId}::uuid
          AND material.deleted_at IS NULL
        ORDER BY chunk.chunk_index ASC
      `,
    )

    return rows.map((row) => ({
      ...row,
      embedding: parseEmbedding(row.embedding),
    }))
  }

  private assertValidEmbeddings(chunks: readonly MaterialChunkInput[]): void {
    for (const chunk of chunks) {
      if (!isEmbedding(chunk.embedding)) {
        throw new InvalidMaterialChunkEmbeddingError(chunk.chunkIndex)
      }
    }
  }

  private async insertChunkBatches(
    tx: PrismaTransactionClient,
    materialId: string,
    chunks: readonly MaterialChunkInput[],
  ): Promise<void> {
    for (
      let offset = 0;
      offset < chunks.length;
      offset += MAX_INSERT_BATCH_ROWS
    ) {
      const batch = chunks.slice(offset, offset + MAX_INSERT_BATCH_ROWS)
      const rows = batch.map(
        (chunk) => Prisma.sql`(
          ${materialId}::uuid,
          ${chunk.chunkIndex},
          ${chunk.content},
          ${serializeEmbedding(chunk.embedding)}::vector(1536),
          ${chunk.embeddingModel}
        )`,
      )

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO material_chunks (
          material_id,
          chunk_index,
          content,
          embedding,
          embedding_model
        )
        VALUES ${Prisma.join(rows)}
      `)
    }
  }
}

interface MaterialChunkSqlRow {
  id: string
  materialId: string
  chunkIndex: number
  content: string
  embedding: string
  embeddingModel: string
  createdAt: Date
}

function isEmbedding(value: readonly number[]): boolean {
  return (
    value.length === EMBEDDING_DIMENSIONS &&
    value.every((component) => Number.isFinite(component))
  )
}

function serializeEmbedding(embedding: readonly number[]): string {
  return `[${embedding.join(',')}]`
}

function parseEmbedding(value: string): number[] {
  const parsed: unknown = JSON.parse(value)

  if (
    !Array.isArray(parsed) ||
    !parsed.every((component): component is number =>
      Number.isFinite(component),
    ) ||
    parsed.length !== EMBEDDING_DIMENSIONS
  ) {
    throw new Error('Stored material chunk embedding is invalid')
  }

  return parsed
}
