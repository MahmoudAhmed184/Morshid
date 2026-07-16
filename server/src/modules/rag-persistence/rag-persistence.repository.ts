import { Injectable } from '@nestjs/common'

import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

const EMBEDDING_DIMENSIONS = 1_536

export interface MaterialChunkInput {
  chunkIndex: number
  content: string
  embedding: readonly number[]
  embeddingModel: string
}

export interface MaterialChunkRecord extends MaterialChunkInput {
  id: string
  materialId: string
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

export abstract class RagPersistenceRepository {
  abstract insertMaterialChunks(
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
    for (const chunk of chunks) {
      if (!isEmbedding(chunk.embedding)) {
        throw new InvalidMaterialChunkEmbeddingError(chunk.chunkIndex)
      }
    }

    if (chunks.length === 0) {
      return
    }

    const rows = chunks.map(
      (chunk) => Prisma.sql`(
        ${materialId}::uuid,
        ${chunk.chunkIndex},
        ${chunk.content},
        ${serializeEmbedding(chunk.embedding)}::vector(1536),
        ${chunk.embeddingModel}
      )`,
    )

    await this.prismaService.$executeRaw(Prisma.sql`
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

  async findMaterialChunks(materialId: string): Promise<MaterialChunkRecord[]> {
    const rows = await this.prismaService.$queryRaw<MaterialChunkSqlRow[]>(
      Prisma.sql`
        SELECT
          id,
          material_id AS "materialId",
          chunk_index AS "chunkIndex",
          content,
          embedding::text AS "embedding",
          embedding_model AS "embeddingModel",
          created_at AS "createdAt"
        FROM material_chunks
        WHERE material_id = ${materialId}::uuid
        ORDER BY chunk_index ASC
      `,
    )

    return rows.map((row) => ({
      ...row,
      embedding: parseEmbedding(row.embedding),
    }))
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
